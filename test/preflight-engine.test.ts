import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PreFlightEngine } from '../src/core/PreFlightEngine.js';
import { FrameworkDetector } from '../src/core/FrameworkDetector.js';

describe('PreFlightEngine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-engine-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('correctly parses raw TypeScript compiler error output', () => {
    const rawTscOutput = [
      "src/components/Header.tsx(12,18): error TS2307: Cannot find module '@/components/Button' or its corresponding type declarations.",
      "src/pages/index.tsx(45,3): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/utils/math.ts:10:5 - error TS7006: Parameter 'x' implicitly has an 'any' type.",
      "src/config.ts(5,1): warning TS2578: Unused '@ts-expect-error' directive.",
    ].join('\n');

    const diagnostics = PreFlightEngine.parseTypeScriptOutput(rawTscOutput, tempDir);

    expect(diagnostics).toHaveLength(4);

    expect(diagnostics[0]).toEqual({
      file: 'src/components/Header.tsx',
      line: 12,
      column: 18,
      code: 'TS2307',
      rawMessage: "Cannot find module '@/components/Button' or its corresponding type declarations.",
      severity: 'error',
    });

    expect(diagnostics[1].code).toBe('TS2322');
    expect(diagnostics[2].code).toBe('TS7006');
    expect(diagnostics[3].severity).toBe('warning');
  });

  it('detects Next.js client environment leaks (missing NEXT_PUBLIC_ prefix)', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { next: '^14.0.0' },
      })
    );

    const appDir = path.join(tempDir, 'app');
    fs.mkdirSync(appDir, { recursive: true });

    const clientCompPath = path.join(appDir, 'ClientWidget.tsx');
    fs.writeFileSync(
      clientCompPath,
      [
        "'use client';",
        "import React from 'react';",
        "export function ClientWidget() {",
        "  const secret = process.env.STRIPE_SECRET_KEY;",
        "  return <div>{secret}</div>;",
        "}",
      ].join('\n')
    );

    const info = {
      framework: 'nextjs' as const,
      displayName: 'Next.js',
      packageManager: 'npm' as const,
      hasTypeScript: true,
      defaultPort: 3000,
    };

    const issues = PreFlightEngine.auditEnvironmentVariables(tempDir, info);
    expect(issues).toHaveLength(1);
    // A secret-looking name must never get a "make it public" fix.
    expect(issues[0].code).toBe('ENV_SECRET_IN_CLIENT');
    expect(issues[0].line).toBe(4);
    expect(issues[0].rawMessage).toContain('STRIPE_SECRET_KEY');
    expect(issues[0].healerId).toBeUndefined();
  });

  it('flags non-secret client env reads as explain-only findings', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { next: '^14.0.0' } }));
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'app', 'Footer.tsx'),
      "\"use client\";\nexport const Footer = () => <a href={process.env.SITE_URL}>Home</a>;\n"
    );

    const info = FrameworkDetector.detect(tempDir);
    const issues = PreFlightEngine.auditEnvironmentVariables(tempDir, info);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('ENV_LEAK_OR_UNDEFINED');
    expect(issues[0].healerId).toBeUndefined();
    expect(issues[0].proposedFix).toContain('NEXT_PUBLIC_SITE_URL');
  });

  describe('TypeScript dry run never reports a false all-clear', () => {
    const writeFakeTsc = (script: string) => {
      const binDir = path.join(tempDir, 'node_modules', 'typescript', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'tsc'), script);
    };

    beforeEach(() => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ devDependencies: { typescript: '^5.0.0' } }));
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    });

    it('reports TS_NOT_INSTALLED instead of passing when TypeScript is missing', async () => {
      // Guard: the temp dir must not sit under a folder that has TypeScript installed.
      if (PreFlightEngine.resolveTypeScriptCompiler(tempDir)) return;

      const report = await PreFlightEngine.run({ projectRoot: tempDir, skipEnvAudit: true });
      expect(report.passed).toBe(false);
      expect(report.errors[0].code).toBe('TS_NOT_INSTALLED');
    });

    it('reports PREFLIGHT_TIMEOUT instead of passing when the compiler hangs', async () => {
      writeFakeTsc('setTimeout(() => {}, 60000);');
      const report = await PreFlightEngine.run({ projectRoot: tempDir, skipEnvAudit: true, timeoutMs: 800 });
      expect(report.passed).toBe(false);
      expect(report.errors[0].code).toBe('PREFLIGHT_TIMEOUT');
    });

    it('reports TSC_UNPARSED when the compiler fails with unreadable output', async () => {
      writeFakeTsc("console.log('This is not the tsc command you are looking for'); process.exit(1);");
      const report = await PreFlightEngine.run({ projectRoot: tempDir, skipEnvAudit: true });
      expect(report.passed).toBe(false);
      expect(report.errors[0].code).toBe('TSC_UNPARSED');
      expect(report.errors[0].rawMessage).toContain('not the tsc command');
    });

    it('parses location-less config errors such as TS18003', async () => {
      writeFakeTsc("console.log('error TS18003: No inputs were found in config file.'); process.exit(2);");
      const report = await PreFlightEngine.run({ projectRoot: tempDir, skipEnvAudit: true });
      expect(report.passed).toBe(false);
      expect(report.errors[0].code).toBe('TS18003');
      expect(report.errors[0].file).toBe('tsconfig.json');
      expect(report.errors[0].healerId).toBe('fix-tsconfig-include');
    });

    it('catches a real type error with the real compiler', async () => {
      const realTsc = path.resolve(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
      writeFakeTsc(`require(${JSON.stringify(realTsc)});`);
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src'] }));
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'a.ts'), 'export const n: number = "x";\n');

      const report = await PreFlightEngine.run({ projectRoot: tempDir, skipEnvAudit: true });
      expect(report.passed).toBe(false);
      expect(report.errors[0].code).toBe('TS2322');
    }, 30000);

    it('passes only when the compiler exits cleanly', async () => {
      writeFakeTsc('process.exit(0);');
      const report = await PreFlightEngine.run({ projectRoot: tempDir, skipEnvAudit: true });
      expect(report.passed).toBe(true);
    });
  });

  it('detects Vite process.env misuse in client files', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-vite',
        devDependencies: { vite: '^5.0.0' },
      })
    );

    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    const mainPath = path.join(srcDir, 'main.ts');
    fs.writeFileSync(
      mainPath,
      "const apiUrl = process.env.API_URL || 'http://localhost';"
    );

    const info = {
      framework: 'vite' as const,
      displayName: 'Vite',
      packageManager: 'npm' as const,
      hasTypeScript: true,
      defaultPort: 5173,
    };

    const issues = PreFlightEngine.auditEnvironmentVariables(tempDir, info);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('VITE_PROCESS_ENV_USAGE');
    expect(issues[0].proposedFix).toBe('Use import.meta.env.VITE_API_URL');
  });

  it('generates a clean pre-flight report when no errors are found', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'clean-app',
        devDependencies: { vite: '^5.0.0' },
      })
    );

    const report = await PreFlightEngine.run({
      projectRoot: tempDir,
      skipTypeCheck: true,
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.summaryText).toContain('All clear');
  });
});
