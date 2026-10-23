import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { PrePushHook } from '../src/core/PrePushHook.js';
import { GitInfo } from '../src/core/GitInfo.js';

const gitAvailable = GitInfo.run(process.cwd(), ['--version']) !== null;

describe.runIf(gitAvailable)('PrePushHook', () => {
  let repo: string;
  let cliSource: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-hook-'));
    git('init', '-q');
    cliSource = path.join(repo, 'fake-cli.cjs');
    fs.writeFileSync(cliSource, 'process.exit(0);');
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  const hookFile = () => path.join(repo, '.git', 'hooks', 'pre-push');

  it('installs, reports status, and uninstalls cleanly', () => {
    expect(PrePushHook.status(repo)).toBe('not-installed');
    const result = PrePushHook.install(repo, cliSource);
    expect(result.ok).toBe(true);
    expect(PrePushHook.status(repo)).toBe('installed');
    expect(fs.readFileSync(hookFile(), 'utf-8')).toContain(PrePushHook.MARKER);
    expect(fs.existsSync(path.join(repo, '.git', 'launchwizard', 'preflight.cjs'))).toBe(true);

    expect(PrePushHook.uninstall(repo).ok).toBe(true);
    expect(fs.existsSync(hookFile())).toBe(false);
    expect(fs.existsSync(path.join(repo, '.git', 'launchwizard'))).toBe(false);
  });

  it('never overwrites or removes a hook it did not write', () => {
    fs.mkdirSync(path.dirname(hookFile()), { recursive: true });
    fs.writeFileSync(hookFile(), '#!/bin/sh\necho mine\n');
    expect(PrePushHook.status(repo)).toBe('foreign-hook');
    expect(PrePushHook.install(repo, cliSource).ok).toBe(false);
    expect(PrePushHook.uninstall(repo).ok).toBe(false);
    expect(fs.readFileSync(hookFile(), 'utf-8')).toContain('echo mine');
  });

  it('leaves custom hooks folders (Husky) alone', () => {
    git('config', 'core.hooksPath', '.husky');
    expect(PrePushHook.status(repo)).toBe('custom-hooks-path');
    const result = PrePushHook.install(repo, cliSource);
    expect(result.status).toBe('custom-hooks-path');
    expect(result.message).toContain(PrePushHook.MANUAL_HOOK_LINE);
    expect(fs.existsSync(path.join(repo, '.git', 'launchwizard', 'preflight.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(repo, '.husky'))).toBe(false);
  });

  it('refreshes the copied checker after an update', () => {
    PrePushHook.install(repo, cliSource);
    expect(PrePushHook.refreshCli(repo, cliSource)).toBe(false);
    fs.writeFileSync(cliSource, 'process.exit(1);');
    expect(PrePushHook.refreshCli(repo, cliSource)).toBe(true);
  });

  it('reports non-repos', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-norepo-'));
    try {
      // A temp dir can sit inside another repo on some machines; only assert when it doesn't.
      if (GitInfo.commonDir(plain) === null) {
        expect(PrePushHook.status(plain)).toBe('not-a-repo');
      }
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });
});
