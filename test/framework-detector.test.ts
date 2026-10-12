import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FrameworkDetector } from '../src/core/FrameworkDetector.js';

describe('FrameworkDetector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects Next.js projects with pnpm package manager', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'my-next-app',
        scripts: { dev: 'next dev', build: 'next build' },
        dependencies: { next: '^14.2.0', react: '^18.3.0' },
      })
    );
    fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    const result = FrameworkDetector.detect(tempDir);
    expect(result.framework).toBe('nextjs');
    expect(result.displayName).toBe('Next.js');
    expect(result.packageManager).toBe('pnpm');
    expect(result.hasTypeScript).toBe(true);
    expect(result.defaultPort).toBe(3000);
    expect(result.devScript).toBe('pnpm run dev');
  });

  it('detects Vite projects with Bun package manager', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'my-vite-app',
        scripts: { dev: 'vite', build: 'vite build' },
        devDependencies: { vite: '^5.2.0' },
      })
    );
    fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');

    const result = FrameworkDetector.detect(tempDir);
    expect(result.framework).toBe('vite');
    expect(result.displayName).toBe('Vite');
    expect(result.packageManager).toBe('bun');
    expect(result.defaultPort).toBe(5173);
  });

  it('detects Astro projects with default npm', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'my-astro-blog',
        dependencies: { astro: '^4.5.0' },
      })
    );

    const result = FrameworkDetector.detect(tempDir);
    expect(result.framework).toBe('astro');
    expect(result.displayName).toBe('Astro');
    expect(result.packageManager).toBe('npm');
    expect(result.defaultPort).toBe(4321);
  });

  it('identifies generic TypeScript project when only tsconfig exists', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'cli-tool',
        devDependencies: { typescript: '^5.0.0' },
      })
    );
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    const result = FrameworkDetector.detect(tempDir);
    expect(result.framework).toBe('vanilla-ts');
    expect(result.hasTypeScript).toBe(true);
  });
});
