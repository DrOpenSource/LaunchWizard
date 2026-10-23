import * as fs from 'node:fs';
import * as path from 'node:path';
import { EnvRules } from './EnvRules.js';

export interface SecretFinding {
  file: string;
  line: number;
  column: number;
  ruleId: string;
  label: string;
  /** Masked sample, safe to show on screen. */
  preview: string;
  severity: 'error' | 'warning';
  /** True when found in build output that ships to browsers. */
  inBuildOutput: boolean;
  advice: string;
}

interface SecretRule {
  id: string;
  label: string;
  pattern: RegExp;
  severity: 'error' | 'warning';
  advice: string;
  /** Extra check on the matched text, e.g. decoding a JWT. */
  confirm?: (match: string) => boolean;
}

const SOURCE_SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.wrangler', 'coverage', '.turbo', '.cache']);
const BUILD_DIRS = ['.next/static', 'dist', 'build', 'out', '.output/public', '.svelte-kit/output/client', 'public/build'];
const TEXT_FILE = /\.(m?[jt]sx?|cjs|json|html?|css|vue|svelte|astro|ya?ml|toml|txt|md)$/i;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const IGNORE_MARKER = 'launchwizard-ignore-secret';

const ROTATE = 'Remove it from the code, rotate (regenerate) it in the provider dashboard, and load it from server-side environment variables instead.';

/**
 * Pro "Secret Leak Guard": finds hard-coded credentials before a link is shared or a deploy ships.
 * Runs locally with regular expressions only.
 */
export class SecretScanner {
  public static readonly RULES: SecretRule[] = [
    { id: 'private-key', label: 'Private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g, severity: 'error', advice: ROTATE },
    { id: 'aws-access-key', label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, severity: 'error', advice: ROTATE },
    { id: 'stripe-secret', label: 'Stripe live secret key', pattern: /\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}\b/g, severity: 'error', advice: ROTATE },
    { id: 'anthropic-key', label: 'Anthropic API key', pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}/g, severity: 'error', advice: ROTATE },
    { id: 'openai-key', label: 'OpenAI API key', pattern: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g, severity: 'error', advice: ROTATE, confirm: (m) => !m.startsWith('sk-ant-') },
    { id: 'github-token', label: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g, severity: 'error', advice: ROTATE },
    { id: 'slack-token', label: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, severity: 'error', advice: ROTATE },
    { id: 'sendgrid-key', label: 'SendGrid API key', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, severity: 'error', advice: ROTATE },
    { id: 'twilio-key', label: 'Twilio API key', pattern: /\bSK[0-9a-f]{32}\b/g, severity: 'error', advice: ROTATE },
    {
      id: 'supabase-service-role',
      label: 'Supabase service-role key',
      pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      severity: 'error',
      advice: 'This key bypasses all database security rules. Never use it in browser code: use the anon key there, rotate this one, and keep it on the server.',
      confirm: (m) => {
        try {
          return Buffer.from(m.split('.')[1], 'base64url').toString('utf-8').includes('"service_role"');
        } catch {
          return false;
        }
      },
    },
    {
      id: 'database-url',
      label: 'Database URL with password',
      pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^\s:'"@/]+:[^\s'"@/]+@[^\s'"]+/g,
      severity: 'error',
      advice: ROTATE,
      confirm: (m) => !/:\/\/[^:]+:(password|pass|\*+|<[^>]+>|\$\{[^}]+\})@/i.test(m),
    },
    {
      id: 'google-api-key',
      label: 'Google API key',
      pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
      severity: 'warning',
      advice: 'Firebase web keys are designed to be public, but other Google keys are not. Make sure this key is restricted to your domains in Google Cloud Console.',
    },
  ];

  public static mask(secret: string): string {
    if (secret.length <= 10) return '••••';
    return `${secret.slice(0, 6)}…${secret.slice(-2)}`;
  }

  public static scanText(content: string, file: string, inBuildOutput = false): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const taken = new Set<string>();
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 20000 && !inBuildOutput) continue;
      if (line.includes(IGNORE_MARKER) || (i > 0 && lines[i - 1].includes(IGNORE_MARKER))) continue;

      for (const rule of this.RULES) {
        rule.pattern.lastIndex = 0;
        for (const match of line.matchAll(rule.pattern)) {
          const key = `${i}:${match.index}`;
          if (taken.has(key)) continue;
          if (rule.confirm && !rule.confirm(match[0])) continue;
          taken.add(key);
          findings.push({
            file,
            line: i + 1,
            column: (match.index ?? 0) + 1,
            ruleId: rule.id,
            label: rule.label,
            preview: this.mask(match[0]),
            severity: rule.severity,
            inBuildOutput,
            advice: rule.advice,
          });
        }
      }
    }
    return findings;
  }

  /**
   * .env files are where secrets belong, so their values are not flagged. Their NAMES are:
   * NEXT_PUBLIC_ / VITE_ variables are bundled into browser code, so a secret-looking public name is a leak.
   */
  public static scanEnvFileNames(content: string, file: string): SecretFinding[] {
    const findings: SecretFinding[] = [];
    content.split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/^\s*(?:export\s+)?((?:NEXT_PUBLIC_|VITE_|PUBLIC_|NUXT_PUBLIC_)[A-Za-z0-9_]+)\s*=/);
      if (m && EnvRules.isSecretLikeName(m[1]) && !/PUBLISHABLE|ANON|PUBLIC_KEY$|SITE_KEY/i.test(m[1])) {
        findings.push({
          file,
          line: i + 1,
          column: 1,
          ruleId: 'public-secret-name',
          label: 'Secret exposed through a public variable',
          preview: m[1],
          severity: 'error',
          inBuildOutput: false,
          advice: `Variables starting with ${m[1].split('_')[0]}_ are copied into the browser bundle for every visitor. If ${m[1]} is private, rename it without the public prefix, read it only on the server, and rotate it.`,
        });
      }
    });
    return findings;
  }

  /** Scans source files, .env names, and any existing client build output. */
  public static scanProject(projectRoot: string, maxFiles = 5000): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const sourceFiles: string[] = [];
    const buildRoots = BUILD_DIRS.map((d) => path.join(projectRoot, d)).filter((d) => fs.existsSync(d));
    const buildRootSet = new Set(buildRoots.map((d) => path.normalize(d)));

    this.collect(projectRoot, sourceFiles, maxFiles, buildRootSet);
    for (const file of sourceFiles) {
      const rel = path.relative(projectRoot, file);
      const base = path.basename(file);
      try {
        const content = fs.readFileSync(file, 'utf-8');
        if (/^\.env(\..+)?$/.test(base)) {
          if (!/\.(example|sample|template)$/.test(base)) {
            findings.push(...this.scanEnvFileNames(content, rel));
          }
        } else {
          findings.push(...this.scanText(content, rel, false));
        }
      } catch {
        // Unreadable file
      }
    }

    for (const buildRoot of buildRoots) {
      const buildFiles: string[] = [];
      this.collect(buildRoot, buildFiles, maxFiles, new Set());
      for (const file of buildFiles) {
        if (/\.map$/.test(file)) continue;
        try {
          findings.push(...this.scanText(fs.readFileSync(file, 'utf-8'), path.relative(projectRoot, file), true));
        } catch {
          // Unreadable file
        }
      }
    }

    return findings;
  }

  private static collect(dir: string, out: string[], max: number, skip: Set<string>, depth = 0): void {
    if (out.length >= max || depth > 14) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= max) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SOURCE_SKIP_DIRS.has(entry.name) || skip.has(path.normalize(full)) || entry.name === '.next' || entry.name === '.svelte-kit' || entry.name === '.output') continue;
        this.collect(full, out, max, skip, depth + 1);
      } else if (TEXT_FILE.test(entry.name) || /^\.env(\..+)?$/.test(entry.name)) {
        try {
          if (fs.statSync(full).size <= MAX_FILE_BYTES) out.push(full);
        } catch {
          // Vanished file
        }
      }
    }
  }
}
