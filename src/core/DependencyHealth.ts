import { runProcess } from './ProcessRunner.js';
import type { PackageManager } from '../shared/types.js';

export type VulnSeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

export interface VulnerablePackage {
  name: string;
  severity: VulnSeverity;
  fixAvailable: boolean;
  title?: string;
}

export interface OutdatedFramework {
  name: string;
  current: string;
  latest: string;
  majorsBehind: number;
}

export interface DependencyHealthReport {
  supported: boolean;
  message: string;
  counts: Record<VulnSeverity, number>;
  vulnerable: VulnerablePackage[];
  outdated: OutdatedFramework[];
  fixCommand?: string;
}

const FRAMEWORK_PACKAGES = new Set([
  'next', 'react', 'react-dom', 'vite', 'astro', '@sveltejs/kit', 'svelte', 'nuxt', 'vue',
  '@remix-run/react', '@remix-run/node', 'typescript', 'react-scripts',
]);
const SEVERITY_ORDER: VulnSeverity[] = ['critical', 'high', 'moderate', 'low', 'info'];

const emptyCounts = (): Record<VulnSeverity, number> => ({ critical: 0, high: 0, moderate: 0, low: 0, info: 0 });

/**
 * Pro "Dependency Health": `npm audit` / `npm outdated` (or pnpm) translated to plain English.
 * Uses the public npm registry; free, no account.
 */
export class DependencyHealth {
  public static async run(
    projectRoot: string,
    pm: PackageManager,
    options: { timeoutMs?: number; signal?: AbortSignal } = {}
  ): Promise<DependencyHealthReport> {
    if (pm !== 'npm' && pm !== 'pnpm') {
      return {
        supported: false,
        message: `Dependency Health supports npm and pnpm projects. This project uses ${pm}; run "${pm} audit" in a terminal instead.`,
        counts: emptyCounts(),
        vulnerable: [],
        outdated: [],
      };
    }

    const timeoutMs = options.timeoutMs ?? 120000;
    const shell = process.platform === 'win32';
    const audit = await runProcess(pm, ['audit', '--json'], { cwd: projectRoot, timeoutMs, shell, signal: options.signal });
    const outdatedArgs = pm === 'npm' ? ['outdated', '--json'] : ['outdated', '--format', 'json'];
    const outdated = await runProcess(pm, outdatedArgs, { cwd: projectRoot, timeoutMs, shell, signal: options.signal });

    if (audit.timedOut || audit.spawnError) {
      return {
        supported: true,
        message: audit.timedOut ? 'The security audit timed out. Check your connection and try again.' : `Could not run ${pm}: ${audit.spawnError}`,
        counts: emptyCounts(),
        vulnerable: [],
        outdated: [],
      };
    }

    const parsedAudit = this.parseAudit(audit.stdout);
    const parsedOutdated = this.parseOutdated(outdated.stdout);
    const total = SEVERITY_ORDER.reduce((n, s) => n + parsedAudit.counts[s], 0);

    return {
      supported: true,
      message: this.summarize(parsedAudit.counts, parsedOutdated, total),
      counts: parsedAudit.counts,
      vulnerable: parsedAudit.vulnerable,
      outdated: parsedOutdated,
      fixCommand: total > 0 ? `${pm} audit fix` : undefined,
    };
  }

  /** Parses npm v7+ ("vulnerabilities") and pnpm/npm v6 ("advisories") audit JSON. */
  public static parseAudit(json: string): { counts: Record<VulnSeverity, number>; vulnerable: VulnerablePackage[] } {
    const counts = emptyCounts();
    const vulnerable: VulnerablePackage[] = [];
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(json) as Record<string, unknown>;
    } catch {
      return { counts, vulnerable };
    }

    const meta = (data.metadata as { vulnerabilities?: Partial<Record<VulnSeverity, number>> } | undefined)?.vulnerabilities;
    if (meta) {
      for (const s of SEVERITY_ORDER) counts[s] = meta[s] ?? 0;
    }

    if (data.vulnerabilities && typeof data.vulnerabilities === 'object') {
      for (const [name, v] of Object.entries(data.vulnerabilities as Record<string, { severity: VulnSeverity; fixAvailable?: unknown; via?: unknown[] }>)) {
        const title = (v.via ?? []).find((x): x is { title: string } => typeof x === 'object' && x !== null && 'title' in x)?.title;
        vulnerable.push({ name, severity: v.severity, fixAvailable: Boolean(v.fixAvailable), title });
      }
    } else if (data.advisories && typeof data.advisories === 'object') {
      for (const adv of Object.values(data.advisories as Record<string, { module_name: string; severity: VulnSeverity; title?: string; patched_versions?: string }>)) {
        vulnerable.push({ name: adv.module_name, severity: adv.severity, title: adv.title, fixAvailable: Boolean(adv.patched_versions && adv.patched_versions !== '<0.0.0') });
      }
    }

    vulnerable.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    return { counts, vulnerable };
  }

  /** Parses `npm outdated --json` / `pnpm outdated --format json`, keeping only framework packages. */
  public static parseOutdated(json: string): OutdatedFramework[] {
    let data: Record<string, { current?: string; latest?: string }>;
    try {
      data = JSON.parse(json || '{}') as Record<string, { current?: string; latest?: string }>;
    } catch {
      return [];
    }
    const out: OutdatedFramework[] = [];
    for (const [name, info] of Object.entries(data)) {
      if (!FRAMEWORK_PACKAGES.has(name) || !info.current || !info.latest) continue;
      const majorsBehind = this.major(info.latest) - this.major(info.current);
      if (majorsBehind > 0) {
        out.push({ name, current: info.current, latest: info.latest, majorsBehind });
      }
    }
    return out.sort((a, b) => b.majorsBehind - a.majorsBehind);
  }

  private static major(version: string): number {
    return Number.parseInt(version.replace(/^[^\d]*/, '').split('.')[0], 10) || 0;
  }

  private static summarize(counts: Record<VulnSeverity, number>, outdated: OutdatedFramework[], total: number): string {
    const parts: string[] = [];
    if (total === 0) {
      parts.push('No known security holes in your dependencies.');
    } else {
      const serious = counts.critical + counts.high;
      parts.push(
        `${total} package${total === 1 ? ' has' : 's have'} known security holes` +
          (serious > 0 ? ` (${serious} serious: ${counts.critical} critical, ${counts.high} high).` : ' (none serious).')
      );
    }
    if (outdated.length > 0) {
      parts.push(`${outdated.map((o) => `${o.name} is ${o.majorsBehind} major version${o.majorsBehind > 1 ? 's' : ''} behind`).join('; ')}.`);
    }
    return parts.join(' ');
  }
}
