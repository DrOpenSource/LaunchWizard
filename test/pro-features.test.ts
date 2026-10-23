import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ShareCards } from '../src/core/ShareCards.js';
import { DependencyHealth } from '../src/core/DependencyHealth.js';
import { BuildRunner } from '../src/core/BuildRunner.js';
import { BundleAnalyzer } from '../src/core/BundleAnalyzer.js';
import { DeployManager } from '../src/core/DeployManager.js';
import { NamedTunnelSetup } from '../src/core/NamedTunnelSetup.js';
import { ErrorTranslator } from '../src/core/ErrorTranslator.js';
import type { FrameworkInfo, PreFlightReport } from '../src/shared/types.js';

const report = (over: Partial<PreFlightReport> = {}): PreFlightReport => ({
  framework: 'nextjs',
  frameworkName: 'Next.js',
  packageManager: 'npm',
  hasTypeScript: true,
  passed: true,
  errors: [],
  warnings: [],
  durationMs: 2300,
  timestamp: Date.UTC(2026, 9, 23, 10, 0),
  summaryText: '',
  ...over,
});

const nextInfo: FrameworkInfo = { framework: 'nextjs', displayName: 'Next.js', packageManager: 'npm', hasTypeScript: true, defaultPort: 3000 };

describe('ShareCards', () => {
  const git = { branch: 'feat/checkout', commit: 'a1b2c3d', commitMessage: 'Add checkout', dirty: true };

  it('builds a Markdown team preview card with passcode and expiry', () => {
    const md = ShareCards.previewCardMarkdown({
      projectName: 'shop',
      url: 'https://x.trycloudflare.com/?lw=tok',
      git,
      report: report(),
      isProtected: true,
      passcode: '4821-7730',
      expiresAt: 1_000_000 + 90 * 60000,
      now: 1_000_000,
      extraLinks: [{ label: 'API', url: 'https://api.trycloudflare.com' }],
    });
    expect(md).toContain('**Open:** https://x.trycloudflare.com/?lw=tok');
    expect(md).toContain('**API:** https://api.trycloudflare.com');
    expect(md).toContain('`4821-7730`');
    expect(md).toContain('`feat/checkout` (with uncommitted changes)');
    expect(md).toContain('**Build check:** Passing');
    expect(md).toContain('in 1 h 30 min');
  });

  it('builds a Slack card without leaking the token into the link text', () => {
    const slack = ShareCards.previewCardSlack({ projectName: 'shop', url: 'https://x.trycloudflare.com/?lw=tok', git, report: report({ passed: false, errors: [{ file: 'a', line: 1, column: 1, code: 'TS2322', rawMessage: 'x', severity: 'error' }] }) });
    expect(slack).toContain('<https://x.trycloudflare.com/?lw=tok|https://x.trycloudflare.com/>');
    expect(slack).toContain('1 build blocker(s)');
  });

  it('exports a report as Markdown and escaped HTML', () => {
    const errors = [{ file: 'app/page.tsx', line: 3, column: 1, code: 'TS2322', rawMessage: "Type '<b>' | 'x'", severity: 'error' as const }];
    const input = { projectName: 'shop', report: report({ passed: false, errors }), translated: ErrorTranslator.translateBatch(errors), git };
    const md = ShareCards.reportMarkdown(input);
    expect(md).toContain('🚨 1 build blocker(s)');
    expect(md).toContain('`app/page.tsx:3`');
    expect(md).toContain("'<b>' \\| 'x'");
    const html = ShareCards.reportHtml(input);
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain("'<b>'");
  });
});

describe('DependencyHealth parsing', () => {
  it('parses npm v7+ audit JSON', () => {
    const json = JSON.stringify({
      vulnerabilities: {
        lodash: { severity: 'high', fixAvailable: true, via: [{ title: 'Prototype Pollution' }] },
        minimist: { severity: 'critical', fixAvailable: false, via: ['lodash'] },
      },
      metadata: { vulnerabilities: { critical: 1, high: 1, moderate: 0, low: 0, info: 0 } },
    });
    const parsed = DependencyHealth.parseAudit(json);
    expect(parsed.counts.critical).toBe(1);
    expect(parsed.vulnerable[0]).toMatchObject({ name: 'minimist', severity: 'critical' });
    expect(parsed.vulnerable[1]).toMatchObject({ name: 'lodash', title: 'Prototype Pollution', fixAvailable: true });
  });

  it('parses pnpm advisories JSON', () => {
    const json = JSON.stringify({ advisories: { 1: { module_name: 'semver', severity: 'moderate', title: 'ReDoS', patched_versions: '>=7.5.2' } }, metadata: { vulnerabilities: { moderate: 1 } } });
    expect(DependencyHealth.parseAudit(json).vulnerable).toEqual([{ name: 'semver', severity: 'moderate', title: 'ReDoS', fixAvailable: true }]);
  });

  it('reports only framework packages that are a major version behind', () => {
    const json = JSON.stringify({
      next: { current: '13.5.1', wanted: '13.5.6', latest: '15.2.0' },
      react: { current: '18.3.1', latest: '18.3.1' },
      lodash: { current: '3.0.0', latest: '4.17.21' },
      vite: { current: '5.4.0', latest: '5.4.10' },
    });
    expect(DependencyHealth.parseOutdated(json)).toEqual([{ name: 'next', current: '13.5.1', latest: '15.2.0', majorsBehind: 2 }]);
  });

  it('survives garbage output', () => {
    expect(DependencyHealth.parseAudit('npm ERR! code ENOLOCK').vulnerable).toEqual([]);
    expect(DependencyHealth.parseOutdated('')).toEqual([]);
  });
});

describe('BuildRunner output parsing', () => {
  it('parses Next.js type errors, missing modules, Vite resolve failures and prerender crashes', () => {
    const output = [
      'Failed to compile.',
      './app/page.tsx:12:5',
      "Type error: Type 'string' is not assignable to type 'number'.",
      './app/layout.tsx',
      "Module not found: Can't resolve '../components/Navbar'",
      '[vite]: Rollup failed to resolve import "lodash-es" from "src/main.ts".',
      'Error occurred prerendering page "/about". Read more: https://nextjs.org/docs/messages/prerender-error',
      'ReferenceError: window is not defined',
    ].join('\n');
    const errors = BuildRunner.parseBuildOutput(output);
    expect(errors.map((e) => e.code)).toEqual(['NEXT_TYPE_ERROR', 'TS2307', 'ROLLUP_UNRESOLVED_IMPORT', 'SSR_WINDOW_UNDEFINED']);
    expect(errors[0]).toMatchObject({ file: 'app/page.tsx', line: 12 });
    expect(errors[1].file).toBe('app/layout.tsx');
    expect(ErrorTranslator.translate(errors[1]).friendlyTitle).toBe('Cannot Find Module or File');
  });
});

describe('BundleAnalyzer', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-bundle-'));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('measures client JS and flags growth and budget overruns', () => {
    fs.mkdirSync(path.join(root, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'assets', 'index.js'), 'console.log(1);'.repeat(200));
    fs.writeFileSync(path.join(root, 'dist', 'assets', 'index.js.map'), 'x'.repeat(100000));
    fs.writeFileSync(path.join(root, 'dist', 'index.css'), 'body{}');

    const snap = BundleAnalyzer.measure(root, 'vite', 1)!;
    expect(snap.outputDir).toBe('dist');
    expect(snap.fileCount).toBe(2);
    expect(snap.jsGzipBytes).toBeGreaterThan(0);
    expect(snap.jsGzipBytes).toBeLessThan(snap.jsBytes);

    const prev = { ...snap, jsGzipBytes: Math.round(snap.jsGzipBytes / 2) };
    const cmp = BundleAnalyzer.compare(snap, prev, 0.01);
    expect(cmp.findings.map((f) => f.code)).toEqual(['BUNDLE_GROWTH', 'BUNDLE_OVER_BUDGET']);
    expect(BundleAnalyzer.compare(snap, snap, 0).findings).toEqual([]);
  });

  it('returns null when nothing has been built', () => {
    expect(BundleAnalyzer.measure(root, 'vite')).toBeNull();
  });
});

describe('DeployManager', () => {
  it('builds Vercel commands with preview by default and keeps the token out of argv', () => {
    expect(DeployManager.vercelCommand(false).args).toEqual(['--yes', 'vercel@latest', 'deploy', '--yes']);
    expect(DeployManager.vercelCommand(true).args).toContain('--prod');
    expect(DeployManager.vercelCommand(true).args.join(' ')).not.toMatch(/token/i);
  });

  it('never deploys a Pages preview to the production branch', () => {
    expect(DeployManager.pagesBranch(false, 'main')).toBe('launchwizard-preview');
    expect(DeployManager.pagesBranch(false, 'feat/new ui')).toBe('feat-new-ui');
    expect(DeployManager.pagesBranch(true, 'feat/x')).toBe('main');
    const cmds = DeployManager.pagesCommands('dist', 'shop', 'launchwizard-preview');
    expect(cmds.deploy.args).toEqual(['--yes', 'wrangler@4', 'pages', 'deploy', 'dist', '--project-name=shop', '--branch=launchwizard-preview', '--commit-dirty=true']);
  });

  it('parses deploy URLs and sanitizes project names', () => {
    expect(DeployManager.parseDeployUrl('vercel', 'Inspect: https://vercel.com/x\nPreview: https://shop-abc123-me.vercel.app [3s]')).toBe('https://shop-abc123-me.vercel.app');
    expect(DeployManager.parseDeployUrl('cloudflare-pages', '✨ Deployment complete! Take a peek over at https://1a2b3c.shop.pages.dev')).toBe('https://1a2b3c.shop.pages.dev');
    expect(DeployManager.sanitizeProjectName('@acme/My Shop!!')).toBe('my-shop');
  });

  it('explains why a deploy cannot run', () => {
    const root = os.tmpdir();
    expect(DeployManager.validate({ target: 'vercel', credentials: { token: '' }, info: nextInfo, projectRoot: root })).toContain('Connect Vercel');
    expect(DeployManager.validate({ target: 'cloudflare-pages', credentials: { token: 't' }, info: nextInfo, projectRoot: root })).toContain('Account ID');
    expect(DeployManager.validate({ target: 'cloudflare-pages', credentials: { token: 't', accountId: 'a' }, info: nextInfo, projectRoot: root })).toContain('Deploy it to Vercel');
    expect(DeployManager.validate({ target: 'vercel', credentials: { token: 't' }, info: nextInfo, projectRoot: root })).toBeNull();
  });
});

describe('NamedTunnelSetup', () => {
  it('only accepts subdomains, never an apex domain', () => {
    expect(NamedTunnelSetup.validateHostname('preview.example.com')).toBeNull();
    expect(NamedTunnelSetup.validateHostname('example.com')).toContain('subdomain');
    expect(NamedTunnelSetup.validateHostname('not a host')).toContain('preview.example.com');
  });

  it('never treats an existing DNS record as success', () => {
    expect(NamedTunnelSetup.interpretRoute(0, '', 'p.example.com').ok).toBe(true);
    expect(NamedTunnelSetup.interpretRoute(1, 'INF p.example.com is already configured to route to your tunnel', 'p.example.com').ok).toBe(true);
    const clash = NamedTunnelSetup.interpretRoute(1, 'Failed to add route: code: 1003, reason: An A, AAAA, or CNAME record with that host already exists.', 'p.example.com');
    expect(clash.ok).toBe(false);
    expect(clash.message).toContain("won't overwrite");
  });

  it('parses the tunnel list and names tunnels deterministically', () => {
    const json = JSON.stringify([{ id: '1', name: 'launchwizard-p-example-com', deleted_at: '0001-01-01T00:00:00Z' }, { id: '2', name: 'old', deleted_at: '2025-01-01T00:00:00Z' }]);
    expect(NamedTunnelSetup.parseTunnelList(json)).toEqual([{ id: '1', name: 'launchwizard-p-example-com' }]);
    expect(NamedTunnelSetup.tunnelNameFor('P.Example.com')).toBe('launchwizard-p-example-com');
  });
});
