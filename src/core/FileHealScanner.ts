import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PreFlightError, SupportedFramework } from '../shared/types.js';

export interface ScanContext {
  projectRoot: string;
  framework: SupportedFramework;
}

const CODE_FILE = /\.(tsx|jsx|ts|js|mjs)$/;
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.scss', '.svg'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.output', '.svelte-kit', '.vercel', 'coverage']);

/**
 * Finds deterministic, file-local build traps that the TypeScript compiler does not report
 * (or reports only on some operating systems):
 * - Next.js components that use hooks or event handlers without 'use client'
 * - Import paths whose letter case differs from the file on disk (breaks Linux builds on Vercel)
 * - .env values silently cut off at an unquoted '#'
 */
export class FileHealScanner {
  /** Scans one file. Used on save and by the lightbulb provider. */
  public static scanFile(filePath: string, content: string, ctx: ScanContext): PreFlightError[] {
    const rel = path.relative(ctx.projectRoot, filePath) || path.basename(filePath);
    const base = path.basename(filePath);

    if (/^\.env(\..+)?$/.test(base)) {
      return this.findEnvHashTruncation(rel, content);
    }

    if (!CODE_FILE.test(base)) {
      return [];
    }

    const findings: PreFlightError[] = [];
    const useClient = this.detectMissingUseClient(rel, content, ctx.framework);
    if (useClient) {
      findings.push(useClient);
    }
    findings.push(...this.findImportCaseMismatches(filePath, rel, content, ctx.projectRoot));
    return findings;
  }

  /** Scans the whole project (bounded) as part of the pre-flight check. */
  public static scanProject(ctx: ScanContext, maxFiles = 3000): PreFlightError[] {
    const files: string[] = [];
    this.collect(ctx.projectRoot, files, maxFiles, 0);
    const findings: PreFlightError[] = [];
    for (const file of files) {
      try {
        findings.push(...this.scanFile(file, fs.readFileSync(file, 'utf-8'), ctx));
      } catch {
        // Unreadable file
      }
    }
    return findings;
  }

  // --- 'use client' ---------------------------------------------------------

  public static detectMissingUseClient(
    relPath: string,
    content: string,
    framework: SupportedFramework
  ): PreFlightError | null {
    if (framework !== 'nextjs' || !/\.(tsx|jsx)$/.test(relPath)) {
      return null;
    }

    const segments = relPath.split(/[\\/]/);
    const inAppTree = segments.includes('app') || segments.includes('components');
    if (!inAppTree) {
      return null;
    }

    if (/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*['"]use (client|server)['"]/.test(content)) {
      return null;
    }

    // Files that must stay server components: adding 'use client' would break them.
    const serverOnly =
      /export\s+(const|async\s+function|function)\s+(metadata|generateMetadata|generateStaticParams|viewport|revalidate|dynamic)\b/.test(content) ||
      /export\s+default\s+async\s+function/.test(content) ||
      /from\s+['"](server-only|next\/headers|fs|node:fs)['"]|import\s+['"]server-only['"]/.test(content);
    if (serverOnly) {
      return null;
    }

    const lines = content.split(/\r?\n/);
    const hookPattern = /\buse(?:State|Effect|LayoutEffect|Reducer|Ref|Context|Transition|Optimistic|ActionState|FormStatus|Router|Pathname|SearchParams|Params|Callback|Memo|Id|ImperativeHandle|SyncExternalStore|DeferredValue|InsertionEffect)\s*\(/;
    const handlerPattern = /\son[A-Z][A-Za-z]+=\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hook = line.match(hookPattern);
      const handler = line.match(handlerPattern);
      const hit = hook ?? handler;
      if (hit) {
        return {
          file: relPath,
          line: i + 1,
          column: (hit.index ?? 0) + 1,
          code: 'USE_CLIENT_MISSING',
          rawMessage: hook
            ? `This component calls "${hook[0].replace(/\s*\($/, '')}" but the file has no 'use client' directive. Next.js renders it on the server, where hooks are not allowed.`
            : `This component attaches an event handler ("${handler![0].trim().replace(/=\{$/, '')}") but the file has no 'use client' directive. Next.js renders it on the server, where event handlers are not allowed.`,
          severity: 'error',
          healerId: 'add-use-client',
        };
      }
    }
    return null;
  }

  // --- Import path letter case ---------------------------------------------

  public static findImportCaseMismatches(
    filePath: string,
    relPath: string,
    content: string,
    projectRoot: string
  ): PreFlightError[] {
    const findings: PreFlightError[] = [];
    const lines = content.split(/\r?\n/);
    const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;
    const aliasRoot = this.resolveAtAlias(projectRoot);

    for (let i = 0; i < lines.length; i++) {
      for (const match of lines[i].matchAll(importPattern)) {
        const spec = match[2];
        let baseDir: string;
        let rest: string;
        let prefix: string;

        if (spec.startsWith('./') || spec.startsWith('../')) {
          baseDir = path.dirname(filePath);
          rest = spec;
          prefix = '';
        } else if (spec.startsWith('@/') && aliasRoot) {
          baseDir = aliasRoot;
          rest = spec.slice(2);
          prefix = '@/';
        } else {
          continue;
        }

        const corrected = this.correctCase(baseDir, rest);
        if (corrected && corrected !== rest) {
          const fixedSpec = prefix + corrected;
          findings.push({
            file: relPath,
            line: i + 1,
            column: (match.index ?? 0) + match[0].indexOf(spec),
            code: 'IMPORT_CASE_MISMATCH',
            rawMessage: `Import "${spec}" only works on Windows and macOS. The file on disk is "${fixedSpec}", and Linux build servers (Vercel, Cloudflare) treat different letter case as a missing file.`,
            severity: 'error',
            healerId: 'fix-import-case',
            proposedFix: `Change the import to "${fixedSpec}"`,
            healData: { spec, fixedSpec },
          });
        }
      }
    }
    return findings;
  }

  /**
   * Returns the specifier with on-disk letter case, or null when the path is already exact,
   * cannot be found, or matches more than one entry (ambiguous: never guess).
   */
  public static correctCase(baseDir: string, spec: string): string | null {
    const parts = spec.split('/');
    let dir = baseDir;
    const out: string[] = [];
    let changed = false;

    for (let idx = 0; idx < parts.length; idx++) {
      const part = parts[idx];
      if (part === '.' || part === '..' || part === '') {
        out.push(part);
        dir = path.join(dir, part);
        continue;
      }

      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return null;
      }

      const isLast = idx === parts.length - 1;
      if (entries.includes(part)) {
        out.push(part);
        dir = path.join(dir, part);
        continue;
      }
      if (isLast && entries.some((e) => RESOLVE_EXTENSIONS.some((ext) => e === part + ext))) {
        out.push(part);
        continue;
      }

      const lower = part.toLowerCase();
      const candidates = entries.filter((e) => {
        const el = e.toLowerCase();
        return el === lower || (isLast && RESOLVE_EXTENSIONS.some((ext) => el === lower + ext));
      });
      if (candidates.length !== 1) {
        return null;
      }

      const hit = candidates[0];
      // "Button.tsx" matched an extension-less "button": keep the specifier extension-less.
      const matchedByAddedExtension = hit.toLowerCase() !== lower;
      const fixedPart = matchedByAddedExtension ? hit.slice(0, part.length) : hit;
      out.push(fixedPart);
      dir = path.join(dir, hit);
      changed = true;
    }

    return changed ? out.join('/') : null;
  }

  private static resolveAtAlias(projectRoot: string): string | null {
    try {
      const raw = fs.readFileSync(path.join(projectRoot, 'tsconfig.json'), 'utf-8');
      // tsconfig is JSONC: drop comments (outside strings) and trailing commas.
      const stripped = raw
        .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str: string | undefined) => str ?? '')
        .replace(/,(\s*[}\]])/g, '$1');
      const json = JSON.parse(stripped) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };
      const target = json.compilerOptions?.paths?.['@/*']?.[0];
      if (!target) return null;
      const baseUrl = json.compilerOptions?.baseUrl ?? '.';
      return path.resolve(projectRoot, baseUrl, target.replace(/\/\*$/, ''));
    } catch {
      return null;
    }
  }

  // --- .env values cut at '#' -----------------------------------------------

  public static findEnvHashTruncation(relPath: string, content: string): PreFlightError[] {
    const findings: PreFlightError[] = [];
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const parsed = this.parseUnquotedEnvLine(lines[i]);
      if (!parsed) continue;
      const hashIdx = parsed.value.indexOf('#');
      if (hashIdx > 0) {
        findings.push({
          file: relPath,
          line: i + 1,
          column: parsed.prefix.length + 1,
          code: 'ENV_VALUE_TRUNCATED',
          rawMessage: `The value of ${parsed.key} contains "#" without quotes. Next.js, Vite and dotenv treat everything after "#" as a comment, so the app only sees "${parsed.value.slice(0, hashIdx)}".`,
          severity: 'warning',
          healerId: 'quote-env-value',
          proposedFix: `Wrap the value in quotes: ${parsed.key}="${parsed.value}"`,
          healData: { key: parsed.key },
        });
      }
    }
    return findings;
  }

  /**
   * Splits `KEY=value  # comment` into its parts when the value is unquoted.
   * A '#' preceded by whitespace starts a real comment and is left alone.
   */
  public static parseUnquotedEnvLine(line: string): { prefix: string; key: string; value: string; suffix: string } | null {
    const m = line.match(/^(\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*)(.*)$/);
    if (!m) return null;
    const [, prefix, key, rest] = m;
    if (!rest || /^['"`]/.test(rest)) return null;
    const comment = rest.search(/\s#/);
    const value = (comment >= 0 ? rest.slice(0, comment) : rest).trimEnd();
    const suffix = rest.slice(value.length);
    if (!value) return null;
    return { prefix, key, value, suffix };
  }

  private static collect(dir: string, out: string[], max: number, depth: number): void {
    if (out.length >= max || depth > 12) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= max) return;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          this.collect(path.join(dir, entry.name), out, max, depth + 1);
        }
      } else if (CODE_FILE.test(entry.name) || /^\.env(\..+)?$/.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
}
