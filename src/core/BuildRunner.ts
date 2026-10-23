import * as fs from 'node:fs';
import * as path from 'node:path';
import { runProcess } from './ProcessRunner.js';
import { PreFlightEngine } from './PreFlightEngine.js';
import type { FrameworkInfo, PreFlightError } from '../shared/types.js';

export interface BuildResult {
  ran: boolean;
  success: boolean;
  durationMs: number;
  errors: PreFlightError[];
  /** Last lines of output, for the log view. */
  outputTail: string;
  message: string;
}

/**
 * The full production build check (`<pm> run build`): catches bundler-only errors that a
 * type check misses. It writes the framework's normal build output (.next, dist, ...) but
 * never touches source files. Free for everyone, like the other manual checks.
 */
export class BuildRunner {
  public static async run(
    projectRoot: string,
    info: FrameworkInfo,
    options: { timeoutMs?: number; signal?: AbortSignal; onOutput?: (chunk: string) => void } = {}
  ): Promise<BuildResult> {
    const start = Date.now();
    if (!this.hasBuildScript(projectRoot)) {
      return {
        ran: false,
        success: false,
        durationMs: 0,
        errors: [],
        outputTail: '',
        message: 'This project has no "build" script in package.json, so there is no production build to check.',
      };
    }

    const result = await runProcess(info.packageManager, ['run', 'build'], {
      cwd: projectRoot,
      timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
      shell: true,
      signal: options.signal,
      // CI=1 keeps frameworks from prompting (e.g. Next telemetry notice) and disables spinners.
      env: { ...process.env, CI: '1', FORCE_COLOR: '0', NEXT_TELEMETRY_DISABLED: '1' },
      onOutput: options.onOutput,
    });

    const output = `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');
    const outputTail = output.split(/\r?\n/).filter((l) => l.trim()).slice(-25).join('\n');
    const durationMs = Date.now() - start;

    if (result.aborted) {
      return { ran: true, success: false, durationMs, errors: [], outputTail, message: 'Build check cancelled.' };
    }
    if (result.timedOut) {
      return {
        ran: true,
        success: false,
        durationMs,
        errors: [{ file: 'package.json', line: 1, column: 1, code: 'BUILD_TIMEOUT', rawMessage: 'The production build did not finish in time.', severity: 'error' }],
        outputTail,
        message: 'The production build timed out.',
      };
    }
    if (result.code === 0) {
      return { ran: true, success: true, durationMs, errors: [], outputTail, message: `Production build passed in ${(durationMs / 1000).toFixed(0)} s.` };
    }

    const errors = this.parseBuildOutput(output, projectRoot);
    if (errors.length === 0) {
      errors.push({
        file: 'package.json',
        line: 1,
        column: 1,
        code: 'BUILD_FAILED',
        rawMessage: `The production build failed (exit code ${result.code}). Last output: ${outputTail.split('\n').slice(-3).join(' | ')}`,
        severity: 'error',
      });
    }
    return { ran: true, success: false, durationMs, errors, outputTail, message: `Production build failed with ${errors.length} problem(s).` };
  }

  public static hasBuildScript(projectRoot: string): boolean {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> };
      return Boolean(pkg.scripts?.build);
    } catch {
      return false;
    }
  }

  /** Parses tsc-style, Next.js, webpack and Vite/Rollup error formats. */
  public static parseBuildOutput(output: string, projectRoot?: string): PreFlightError[] {
    const errors = PreFlightEngine.parseTypeScriptOutput(output, projectRoot).filter((e) => e.severity === 'error');
    const lines = output.split(/\r?\n/);
    const seen = new Set(errors.map((e) => `${e.file}:${e.line}`));
    const push = (e: PreFlightError) => {
      const key = `${e.file}:${e.line}:${e.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(e);
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Next.js: "./app/page.tsx:12:5" followed by "Type error: ..."
      const loc = line.match(/^\.\/(.+?):(\d+):(\d+)$/);
      if (loc) {
        const next = (lines[i + 1] ?? '').trim();
        const msg = next.match(/^(Type error|Error):\s*(.+)$/);
        if (msg) {
          push({ file: loc[1], line: Number(loc[2]), column: Number(loc[3]), code: msg[1] === 'Type error' ? 'NEXT_TYPE_ERROR' : 'BUILD_ERROR', rawMessage: msg[2], severity: 'error' });
        }
        continue;
      }

      // webpack / Next.js: "./app/page.tsx" then "Module not found: Can't resolve '../x'"
      const missing = line.match(/Module not found: (?:Error: )?Can't resolve '([^']+)'/);
      if (missing) {
        const fileLine = (lines[i - 1] ?? '').trim().match(/^\.\/(\S+)/);
        push({ file: fileLine?.[1] ?? 'unknown', line: 1, column: 1, code: 'TS2307', rawMessage: `Cannot find module '${missing[1]}' (the bundler could not resolve it).`, severity: 'error' });
        continue;
      }

      // Vite / Rollup: Rollup failed to resolve import "x" from "src/main.ts".
      const rollup = line.match(/failed to resolve import "([^"]+)" from "([^"]+)"/i);
      if (rollup) {
        push({ file: rollup[2], line: 1, column: 1, code: 'ROLLUP_UNRESOLVED_IMPORT', rawMessage: `Could not resolve import "${rollup[1]}".`, severity: 'error' });
        continue;
      }

      // Next.js prerender failures: "Error occurred prerendering page "/about"" + ReferenceError: window is not defined
      const prerender = line.match(/Error occurred prerendering page "([^"]+)"/);
      if (prerender) {
        const detail = lines.slice(i + 1, i + 6).map((l) => l.trim()).find((l) => /Error:/.test(l)) ?? 'see the build log';
        push({ file: `page ${prerender[1]}`, line: 1, column: 1, code: /window|document|localStorage/.test(detail) ? 'SSR_WINDOW_UNDEFINED' : 'BUILD_ERROR', rawMessage: `Page "${prerender[1]}" crashed while pre-rendering: ${detail}`, severity: 'error' });
      }
    }
    return errors;
  }
}
