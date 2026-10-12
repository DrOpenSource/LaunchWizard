import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { FrameworkDetector } from './FrameworkDetector.js';
import type {
  FrameworkInfo,
  PreFlightError,
  PreFlightReport,
} from '../shared/types.js';

const execAsync = promisify(exec);

export interface PreFlightOptions {
  projectRoot: string;
  skipTypeCheck?: boolean;
  skipEnvAudit?: boolean;
  timeoutMs?: number;
}

export class PreFlightEngine {
  /**
   * Runs non-destructive pre-flight checks against the target project workspace.
   */
  public static async run(options: PreFlightOptions): Promise<PreFlightReport> {
    const startTime = Date.now();
    const info = FrameworkDetector.detect(options.projectRoot);
    const errors: PreFlightError[] = [];
    const warnings: PreFlightError[] = [];

    // 1. TypeScript / Compiler Verification
    if (info.hasTypeScript && !options.skipTypeCheck) {
      const tsDiagnostics = await this.runTypeScriptDryRun(options.projectRoot, options.timeoutMs ?? 15000);
      for (const diag of tsDiagnostics) {
        if (diag.severity === 'error') {
          errors.push(diag);
        } else {
          warnings.push(diag);
        }
      }
    }

    // 2. Client-Side Env Leak & Missing Env Verification
    if (!options.skipEnvAudit) {
      const envDiagnostics = this.auditEnvironmentVariables(options.projectRoot, info);
      for (const diag of envDiagnostics) {
        if (diag.severity === 'error') {
          errors.push(diag);
        } else {
          warnings.push(diag);
        }
      }
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
   * Executes tsc --noEmit safely in child process and parses compiler errors.
   */
  public static async runTypeScriptDryRun(
    projectRoot: string,
    timeoutMs = 15000
  ): Promise<PreFlightError[]> {
    const tscCmd = 'npx tsc --noEmit --pretty false';
    try {
      await execAsync(tscCmd, { cwd: projectRoot, timeout: timeoutMs });
      return [];
    } catch (err: unknown) {
      const execError = err as { stdout?: string; stderr?: string };
      const combinedOutput = `${execError.stdout || ''}\n${execError.stderr || ''}`;
      return this.parseTypeScriptOutput(combinedOutput, projectRoot);
    }
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
        });
      }
    }

    return diagnostics;
  }

  /**
   * Audits source files for common client/server env mistakes:
   * 1. Next.js: Accessing process.env.XYZ without NEXT_PUBLIC_ inside client files.
   * 2. Vite: Accessing process.env instead of import.meta.env.
   */
  public static auditEnvironmentVariables(
    projectRoot: string,
    info: FrameworkInfo
  ): PreFlightError[] {
    const diagnostics: PreFlightError[] = [];
    const searchDirs = ['src', 'app', 'pages', 'components'].filter((d) =>
      fs.existsSync(path.join(projectRoot, d))
    );

    if (searchDirs.length === 0 && !fs.existsSync(path.join(projectRoot, 'index.ts'))) {
      return diagnostics;
    }

    const filesToScan: string[] = [];
    for (const dir of searchDirs) {
      this.collectCodeFiles(path.join(projectRoot, dir), filesToScan);
    }

    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(projectRoot, filePath);
        const lines = content.split(/\r?\n/);

        // Next.js: Check if file has 'use client' and uses secret process.env
        const isClientComponent =
          content.includes("'use client'") || content.includes('"use client"');

        lines.forEach((lineText, idx) => {
          const lineNum = idx + 1;

          // Next.js client env check
          if (info.framework === 'nextjs' && isClientComponent) {
            const secretEnvMatch = lineText.match(/process\.env\.([A-Z0-9_]+)/g);
            if (secretEnvMatch) {
              for (const matchStr of secretEnvMatch) {
                const varName = matchStr.replace('process.env.', '');
                if (
                  !varName.startsWith('NEXT_PUBLIC_') &&
                  varName !== 'NODE_ENV'
                ) {
                  diagnostics.push({
                    file: relPath,
                    line: lineNum,
                    column: lineText.indexOf(matchStr) + 1,
                    code: 'ENV_LEAK_OR_UNDEFINED',
                    rawMessage: `Environment variable "${varName}" is accessed in a client component but lacks the "NEXT_PUBLIC_" prefix. It will be undefined in production.`,
                    severity: 'error',
                    healerId: 'prefix-next-public',
                    proposedFix: `Rename to NEXT_PUBLIC_${varName}`,
                  });
                }
              }
            }
          }

          // Vite process.env check
          if (info.framework === 'vite') {
            const viteProcessEnv = lineText.match(/process\.env\.([A-Z0-9_]+)/);
            if (viteProcessEnv && !lineText.includes('process.env.NODE_ENV')) {
              diagnostics.push({
                file: relPath,
                line: lineNum,
                column: lineText.indexOf('process.env') + 1,
                code: 'VITE_PROCESS_ENV_USAGE',
                rawMessage: `Vite client code uses "process.env.${viteProcessEnv[1]}". In Vite, client env variables must use "import.meta.env.VITE_${viteProcessEnv[1]}".`,
                severity: 'error',
                healerId: 'fix-vite-env',
                proposedFix: `Use import.meta.env.VITE_${viteProcessEnv[1]}`,
              });
            }
          }
        });
      } catch {
        // Skip unreadable files
      }
    }

    return diagnostics;
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
