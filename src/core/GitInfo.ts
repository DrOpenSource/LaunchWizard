import { execFileSync } from 'node:child_process';

export interface GitSnapshot {
  branch?: string;
  commit?: string;
  commitMessage?: string;
  dirty?: boolean;
}

/** Read-only git helpers. Every call fails soft: no git or no repo just means no info. */
export class GitInfo {
  public static run(cwd: string, args: string[]): string | null {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, windowsHide: true }).trim();
    } catch {
      return null;
    }
  }

  public static snapshot(cwd: string): GitSnapshot {
    const branch = this.run(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? undefined;
    if (!branch) return {};
    const log = this.run(cwd, ['log', '-1', '--format=%h%x09%s']);
    const [commit, commitMessage] = log ? log.split('\t') : [undefined, undefined];
    const status = this.run(cwd, ['status', '--porcelain']);
    return { branch, commit, commitMessage, dirty: status !== null && status.length > 0 };
  }

  /** The shared .git directory (correct for worktrees too), or null outside a repo. */
  public static commonDir(cwd: string): string | null {
    return this.run(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  }

  public static topLevel(cwd: string): string | null {
    return this.run(cwd, ['rev-parse', '--show-toplevel']);
  }

  public static hooksPath(cwd: string): string | null {
    return this.run(cwd, ['config', '--get', 'core.hooksPath']);
  }
}
