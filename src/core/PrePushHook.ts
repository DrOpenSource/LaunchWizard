import * as fs from 'node:fs';
import * as path from 'node:path';
import { GitInfo } from './GitInfo.js';

export type HookStatus =
  | 'installed'
  | 'not-installed'
  | 'foreign-hook'
  | 'custom-hooks-path'
  | 'not-a-repo';

export interface HookResult {
  ok: boolean;
  status: HookStatus;
  message: string;
}

/**
 * Pro "Pre-Push Gate": a git pre-push hook that runs the pre-flight check and blocks pushes
 * with build blockers. It never overwrites a hook it didn't write, and it fails open
 * (lets the push through) when Node or the checker is missing.
 */
export class PrePushHook {
  public static readonly MARKER = '# launchwizard-pre-push v1';
  public static readonly CLI_NAME = 'preflight.cjs';

  public static script(): string {
    return [
      '#!/bin/sh',
      this.MARKER,
      '# Installed by LaunchWizard. It runs the pre-flight check before every push.',
      '# Skip it once with: git push --no-verify',
      'GIT_COMMON_DIR="$(git rev-parse --git-common-dir)"',
      `CLI="$GIT_COMMON_DIR/launchwizard/${this.CLI_NAME}"`,
      'if [ ! -f "$CLI" ]; then exit 0; fi',
      'if ! command -v node >/dev/null 2>&1; then',
      '  echo "LaunchWizard: Node.js not found on PATH, skipping the pre-push check."',
      '  exit 0',
      'fi',
      'node "$CLI" --root "$(git rev-parse --show-toplevel)" --hook',
      '',
    ].join('\n');
  }

  /** The line to add to a pre-push hook that LaunchWizard doesn't manage (e.g. Husky). */
  public static readonly MANUAL_HOOK_LINE = `node "$(git rev-parse --git-common-dir)/launchwizard/preflight.cjs" --root "$(git rev-parse --show-toplevel)" --hook`;

  private static locate(repoDir: string): { hookFile: string; cliDir: string } | HookResult {
    const commonDir = GitInfo.commonDir(repoDir);
    if (!commonDir) {
      return { ok: false, status: 'not-a-repo', message: 'This folder is not a git repository, so there is nothing to protect yet.' };
    }
    const customPath = GitInfo.hooksPath(repoDir);
    if (customPath) {
      return {
        ok: false,
        status: 'custom-hooks-path',
        message: `Your repo uses a custom hooks folder (core.hooksPath = "${customPath}", often Husky), which LaunchWizard won't edit.`,
      };
    }
    return { hookFile: path.join(commonDir, 'hooks', 'pre-push'), cliDir: path.join(commonDir, 'launchwizard') };
  }

  private static copyCli(repoDir: string, cliSourcePath: string): boolean {
    const commonDir = GitInfo.commonDir(repoDir);
    if (!commonDir) return false;
    const cliDir = path.join(commonDir, 'launchwizard');
    fs.mkdirSync(cliDir, { recursive: true });
    fs.copyFileSync(cliSourcePath, path.join(cliDir, this.CLI_NAME));
    return true;
  }

  public static status(repoDir: string): HookStatus {
    const loc = this.locate(repoDir);
    if ('status' in loc) return loc.status;
    if (!fs.existsSync(loc.hookFile)) return 'not-installed';
    return fs.readFileSync(loc.hookFile, 'utf-8').includes(this.MARKER) ? 'installed' : 'foreign-hook';
  }

  /**
   * Installs the hook and copies the stand-alone checker next to it (so extension updates
   * never break the hook).
   */
  public static install(repoDir: string, cliSourcePath: string): HookResult {
    const loc = this.locate(repoDir);
    if ('status' in loc) {
      if (loc.status === 'custom-hooks-path' && this.copyCli(repoDir, cliSourcePath)) {
        return { ...loc, message: `${loc.message} The checker is ready; add this line to your pre-push hook to turn the gate on:\n${this.MANUAL_HOOK_LINE}` };
      }
      return loc;
    }

    if (fs.existsSync(loc.hookFile) && !fs.readFileSync(loc.hookFile, 'utf-8').includes(this.MARKER)) {
      return {
        ok: false,
        status: 'foreign-hook',
        message: 'This repo already has a pre-push hook that LaunchWizard did not write, so it was left untouched.',
      };
    }

    fs.mkdirSync(path.dirname(loc.hookFile), { recursive: true });
    fs.mkdirSync(loc.cliDir, { recursive: true });
    fs.copyFileSync(cliSourcePath, path.join(loc.cliDir, this.CLI_NAME));
    fs.writeFileSync(loc.hookFile, this.script(), { encoding: 'utf-8', mode: 0o755 });
    try {
      fs.chmodSync(loc.hookFile, 0o755);
    } catch {
      // Windows: git for Windows runs hooks through sh regardless of mode bits
    }
    return { ok: true, status: 'installed', message: 'Pre-Push Gate is on: pushes with build blockers will be stopped. Skip once with "git push --no-verify".' };
  }

  /** Refreshes the copied checker after an extension update (only if our hook is installed). */
  public static refreshCli(repoDir: string, cliSourcePath: string): boolean {
    const commonDir = GitInfo.commonDir(repoDir);
    if (!commonDir) return false;
    const target = path.join(commonDir, 'launchwizard', this.CLI_NAME);
    // Only refresh a checker we installed earlier (managed hook or the Husky manual line).
    if (!fs.existsSync(target)) return false;
    const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const next = fs.readFileSync(cliSourcePath);
    if (current && current.equals(next)) return false;
    fs.writeFileSync(target, next);
    return true;
  }

  public static uninstall(repoDir: string): HookResult {
    const loc = this.locate(repoDir);
    if ('status' in loc) return loc;
    if (!fs.existsSync(loc.hookFile)) {
      return { ok: true, status: 'not-installed', message: 'Pre-Push Gate was not installed.' };
    }
    if (!fs.readFileSync(loc.hookFile, 'utf-8').includes(this.MARKER)) {
      return { ok: false, status: 'foreign-hook', message: 'The pre-push hook here was not written by LaunchWizard, so it was left untouched.' };
    }
    fs.rmSync(loc.hookFile, { force: true });
    fs.rmSync(loc.cliDir, { recursive: true, force: true });
    return { ok: true, status: 'not-installed', message: 'Pre-Push Gate is off.' };
  }
}
