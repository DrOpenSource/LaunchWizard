import * as fs from 'node:fs';
import * as path from 'node:path';
import { FrameworkDetector } from './FrameworkDetector.js';
import { EnvRules } from './EnvRules.js';
import { FileHealScanner } from './FileHealScanner.js';
import { runProcess } from './ProcessRunner.js';
import type {
  FrameworkInfo,
  PreFlightError,
  PreFlightReport,
} from '../shared/types.js';

export interface PreFlightOptions {
  projectRoot: string;
  skipTypeCheck?: boolean;
  skipEnvAudit?: boolean;
  skipFileScan?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export const DEFAULT_PREFLIGHT_TIMEOUT_MS = 60000;

/** Compiler codes with a deterministic healer. */
const HEALABLE_TS_CODES: Record<string, string> = {
  TS18003: 'fix-tsconfig-include',
};

export class PreFlightEngine {
  /**
   * Runs non-destructive pre-flight checks against the target project workspace.
   */
  public static async run(options: PreFlightOptions): Promise<PreFlightReport> {
    const startTime = Date.now();
    const info = FrameworkDetector.detect(options.projectRoot);
    const errors: PreFlightError[] = [];
    const warnings: PreFlightError[] = [];

    const sortInto = (diagnostics: PreFlightError[]) => {
      for (const diag of diagnostics) {
        if (diag.severity === 'error') {
          errors.push(diag);
        } else {
          warnings.push(diag);
        }
      }
    };

    // 1. TypeScript / Compiler Verification
    if (info.hasTypeScript && !options.skipTypeCheck) {
      sortInto(
        await this.runTypeScriptDryRun(
          options.projectRoot,
          options.timeoutMs ?? DEFAULT_PREFLIGHT_TIMEOUT_MS,
          options.signal
        )
      );
    }

    // 2. Client-Side Env Leak & Missing Env Verification
    if (!options.skipEnvAudit) {
      sortInto(this.auditEnvironmentVariables(options.projectRoot, info));
    }

    // 3. File-level traps tsc doesn't report everywhere ('use client', import case, .env '#')
    if (!options.skipFileScan) {
      const seen = new Set([...errors, ...warnings].map((d) => `${path.normalize(d.file)}:${d.line}`));
      sortInto(
        FileHealScanner.scanProject({ projectRoot: options.projectRoot, framework: info.framework })
          .filter((d) => !seen.has(`${path.normalize(d.file)}:${d.line}`))
      );
    }

    const durationMs = Date.now() - startTime;
    const passed = errors.length === 0;

    let summaryText = `All clear! Your ${info.displayName} project is clean and ready to ship.`;
    if (!passed) {
      summaryText = `Found ${errors.length} build blocker${errors.length > 1 ? 's' : ''} that will fail Vercel/Cloudflare deployment.`;
    } else if (warnings.length > 0) {
      summaryText = `Ready to ship with ${warnings.length} advisory warning${warnings.length > 1 ? 's' : ''}.`;
    }

    return {
      framework: info.framework,
      frameworkName: info.displayName,
      packageManager: info.packageManager,
      hasTypeScript: info.hasTypeScript,
      passed,
      errors,
      warnings,
      durationMs,
      timestamp: Date.now(),
      summaryText,
    };
  }

  /**
   * Finds the project's own TypeScript compiler, walking up for hoisted monorepo installs.
   * Returns null when TypeScript is not installed: `npx tsc` must never be used as a fallback,
   * because it downloads an unrelated npm package named "tsc" that reports no errors.
   */
  public static resolveTypeScriptCompiler(projectRoot: string): string | null {
    let dir = path.resolve(projectRoot);
    for (;;) {
      const candidate = path.join(dir, 'node_modules', 'typescript', 'bin', 'tsc');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        return null;
      }
      dir = parent;
    }
  }

  /**
   * Runs the project's own `tsc --noEmit` and parses its diagnostics.
   * Anything other than a clean exit is reported as a blocker; this method never returns
   * an empty list for a run that did not succeed.
   */
  public static async runTypeScriptDryRun(
    projectRoot: string,
    timeoutMs = DEFAULT_PREFLIGHT_TIMEOUT_MS,
    signal?: AbortSignal
  ): Promise<PreFlightError[]> {
    const tscPath = this.resolveTypeScriptCompiler(projectRoot);
    if (!tscPath) {
      return [
        {
          file: 'package.json',
          line: 1,
          column: 1,
          code: 'TS_NOT_INSTALLED',
          rawMessage: 'TypeScript is not installed in this project, so the type check could not run. Run your package manager install (e.g. "npm install") and check again.',
          severity: 'error',
        },
      ];
    }

    // process.execPath is the Electron binary inside VS Code; ELECTRON_RUN_AS_NODE makes it behave as Node.
    const result = await runProcess(process.execPath, [tscPath, '--noEmit', '--pretty', 'false'], {
      cwd: projectRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      timeoutMs,
      signal,
    });

    if (result.aborted) {
      return [];
    }

    if (result.timedOut) {
      return [
        {
          file: 'tsconfig.json',
          line: 1,
          column: 1,
          code: 'PREFLIGHT_TIMEOUT',
          rawMessage: `The TypeScript check did not finish within ${Math.round(timeoutMs / 1000)} seconds, so LaunchWizard cannot confirm the project is safe to ship. Increase "launchwizard.preflightTimeoutSeconds" for large projects.`,
          severity: 'error',
        },
      ];
    }

    if (result.spawnError) {
      return [
        {
          file: 'package.json',
          line: 1,
          column: 1,
          code: 'TSC_UNPARSED',
          rawMessage: `The TypeScript compiler could not be started: ${result.spawnError}`,
          severity: 'error',
        },
      ];
    }

    if (result.code === 0) {
      return [];
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    const diagnostics = this.parseTypeScriptOutput(combinedOutput, projectRoot);
    if (diagnostics.some((d) => d.severity === 'error')) {
      return diagnostics;
    }

    const tail = combinedOutput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-5)
      .join(' | ');
    return [
      ...diagnostics,
      {
        file: 'tsconfig.json',
        line: 1,
        column: 1,
        code: 'TSC_UNPARSED',
        rawMessage: `The TypeScript check failed (exit code ${result.code}) with output LaunchWizard could not read: ${tail || '(no output)'}`,
        severity: 'error',
      },
    ];
  }

  /**
   * Parses compiler standard output and error lines into structured PreFlightError items.
   */
  public static parseTypeScriptOutput(rawOutput: string, projectRoot?: string): PreFlightError[] {
    const diagnostics: PreFlightError[] = [];
    const lines = rawOutput.split(/\r?\n/);

    // Matches standard tsc line format:
    // src/App.tsx(14,5): error TS2322: Type 'string' is not assignable to type 'number'.
    // or src/App.tsx:14:5 - error TS2322: Type 'string' is not assignable to type 'number'.
    const tsPattern1 = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
    const tsPattern2 = /^(.+?):(\d+):(\d+)\s+-\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
    // Config-level errors carry no location, e.g. "error TS18003: No inputs were found in config file".
    const tsPatternNoLocation = /^(error|warning)\s+(TS\d+):\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(tsPattern1) || line.match(tsPattern2);
      if (match) {
        const [, rawFile, lineStr, colStr, severityStr, code, message] = match;
        const normalizedFile = projectRoot && path.isAbsolute(rawFile)
          ? path.relative(projectRoot, rawFile)
          : rawFile.trim();

        diagnostics.push({
          file: normalizedFile,
          line: Number.parseInt(lineStr, 10),
          column: Number.parseInt(colStr, 10),
          code,
          rawMessage: message.trim(),
          severity: severityStr === 'warning' ? 'warning' : 'error',
          healerId: HEALABLE_TS_CODES[code],
        });
        continue;
      }

      const bare = line.trim().match(tsPatternNoLocation);
      if (bare) {
        const [, severityStr, code, message] = bare;
        diagnostics.push({
          file: 'tsconfig.json',
          line: 1,
          column: 1,
          code,
          rawMessage: message.trim(),
          severity: severityStr === 'warning' ? 'warning' : 'error',
          healerId: HEALABLE_TS_CODES[code],
        });
      }
    }

    return diagnostics;
  }

  /**
   * Audits source files for common client/server env mistakes:
   * 1. Next.js: Accessing process.env.XYZ without NEXT_PUBLIC_ inside client files.
   * 2. Vite: Accessing process.env instead of import.meta.env.
   * Findings are explain-only: a public prefix publishes the value, so it is never applied in bulk.
   */
  public static auditEnvironmentVariables(
    projectRoot: string,
    info: FrameworkInfo
  ): PreFlightError[] {
    const diagnostics: PreFlightError[] = [];
    if (info.framework !== 'nextjs' && info.framework !== 'vite') {
      return diagnostics;
    }

    const searchDirs = ['src', 'app', 'pages', 'components'].filter((d) =>
      fs.existsSync(path.join(projectRoot, d))
    );

    const filesToScan: string[] = [];
    for (const dir of searchDirs) {
      this.collectCodeFiles(path.join(projectRoot, dir), filesToScan);
    }

    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(projectRoot, filePath);
        const lines = content.split(/\r?\n/);

        const isClientComponent = /^\s*['"]use client['"]/m.test(content);

        lines.forEach((lineText, idx) => {
          const lineNum = idx + 1;

          // Next.js client env check
          if (info.framework === 'nextjs' && isClientComponent) {
            for (const match of lineText.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
              const varName = match[1];
              if (varName.startsWith('NEXT_PUBLIC_') || EnvRules.isAlwaysAvailable(varName)) {
                continue;
              }
              diagnostics.push(this.envFinding(relPath, lineNum, (match.index ?? 0) + 1, varName, 'nextjs'));
            }
          }

          // Vite process.env check
          if (info.framework === 'vite') {
            for (const match of lineText.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
              const varName = match[1];
              if (EnvRules.isAlwaysAvailable(varName)) {
                continue;
              }
              diagnostics.push(this.envFinding(relPath, lineNum, (match.index ?? 0) + 1, varName, 'vite'));
            }
          }
        });
      } catch {
        // Skip unreadable files
      }
    }

    return diagnostics;
  }

  private static envFinding(
    file: string,
    line: number,
    column: number,
    varName: string,
    framework: 'nextjs' | 'vite'
  ): PreFlightError {
    if (EnvRules.isSecretLikeName(varName)) {
      return {
        file,
        line,
        column,
        code: 'ENV_SECRET_IN_CLIENT',
        rawMessage: `Browser code reads "${varName}", which looks like a secret. It is undefined in the browser, and adding a ${framework === 'nextjs' ? 'NEXT_PUBLIC_' : 'VITE_'} prefix would publish it to every visitor. Move this read into server code instead.`,
        severity: 'error',
      };
    }

    if (framework === 'nextjs') {
      return {
        file,
        line,
        column,
        code: 'ENV_LEAK_OR_UNDEFINED',
        rawMessage: `Environment variable "${varName}" is accessed in a client component but lacks the "NEXT_PUBLIC_" prefix. It will be undefined in production.`,
        severity: 'error',
        proposedFix: `If this value is safe to show publicly, rename it to NEXT_PUBLIC_${varName} in your code and in .env. Otherwise read it in server code.`,
      };
    }

    return {
      file,
      line,
      column,
      code: 'VITE_PROCESS_ENV_USAGE',
      rawMessage: `Vite client code uses "process.env.${varName}". In Vite, client env variables must use "import.meta.env.VITE_${varName}".`,
      severity: 'error',
      proposedFix: `Use import.meta.env.VITE_${varName}`,
    };
  }

  private static collectCodeFiles(dir: string, collected: string[]): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist') {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.collectCodeFiles(full, collected);
        } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(entry.name)) {
          collected.push(full);
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }
}
