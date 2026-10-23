import { spawn, execSync } from 'node:child_process';

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  /** Needed for .cmd shims (npm, npx, pnpm) on Windows. Never pass user-controlled args with shell: true. */
  shell?: boolean;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  spawnError?: string;
}

const MAX_CAPTURE = 1024 * 1024;

/**
 * Kills a process and all of its children. Child processes started through a shell or npx
 * would otherwise survive a plain kill() on Windows.
 */
export function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      // Children share the process group because we spawn detached on POSIX.
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already exited
    }
  }
}

/**
 * Runs a command to completion with a timeout and optional cancellation, capturing output.
 * Never rejects: failures are reported through the result fields.
 */
export function runProcess(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let settled = false;

    const append = (current: string, chunk: string): string => {
      const next = current + chunk;
      return next.length > MAX_CAPTURE ? next.slice(next.length - MAX_CAPTURE) : next;
    };

    // With a shell, pass one command line (Node deprecates args + shell). Args are quoted when they contain spaces.
    const quote = (a: string) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
    const spawnCommand = options.shell ? [command, ...args].map(quote).join(' ') : command;
    const spawnArgs = options.shell ? [] : args;

    let child;
    try {
      child = spawn(spawnCommand, spawnArgs, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: options.shell ?? false,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({ code: null, stdout, stderr, timedOut, aborted, spawnError: err instanceof Error ? err.message : String(err) });
      return;
    }

    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, options.timeoutMs);

    const onAbort = () => {
      aborted = true;
      killProcessTree(child.pid);
    };
    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout = append(stdout, text);
      options.onOutput?.(text);
    });
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr = append(stderr, text);
      options.onOutput?.(text);
    });

    child.on('error', (err) => {
      finish({ code: null, stdout, stderr, timedOut, aborted, spawnError: err.message });
    });

    child.on('close', (code) => {
      finish({ code, stdout, stderr, timedOut, aborted });
    });
  });
}
