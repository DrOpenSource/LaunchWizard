import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AutoHealer } from '../src/core/AutoHealer.js';
import type { PreFlightError } from '../src/shared/types.js';

describe('AutoHealer', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-healer-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('prepends "use client"; directive to top of interactive React files', () => {
    const raw = "import { useState } from 'react';\n\nexport function Counter() {}";
    const patched = AutoHealer.applyUseClientFix(raw);
    expect(patched.startsWith("'use client';\n\n")).toBe(true);
    expect(patched).toContain("import { useState } from 'react';");
  });

  it('does not duplicate "use client"; if already present', () => {
    const raw = "'use client';\nimport { useState } from 'react';";
    const patched = AutoHealer.applyUseClientFix(raw);
    expect(patched).toBe(raw);
  });

  it('replaces client environment variable with NEXT_PUBLIC_ prefix', () => {
    const raw = "const key = process.env.STRIPE_KEY;";
    const patched = AutoHealer.applyNextPublicPrefix(raw, 'STRIPE_KEY');
    expect(patched).toBe("const key = process.env.NEXT_PUBLIC_STRIPE_KEY;");
  });

  it('replaces Vite client process.env with import.meta.env.VITE_', () => {
    const raw = "const url = process.env.API_URL;";
    const patched = AutoHealer.applyViteEnvFix(raw, 'API_URL');
    expect(patched).toBe("const url = import.meta.env.VITE_API_URL;");
  });

  it('inserts safe optional chaining (?.) on the target property line', () => {
    const raw = "const user = null;\nconsole.log(user.profile.avatar);\nreturn true;";
    const patched = AutoHealer.applyOptionalChaining(raw, 2, 'avatar');
    expect(patched).toContain("user.profile?.avatar");
  });

  it('applies patch to disk and reliably rolls back with zero data corruption', () => {
    const testFile = path.join(tempDir, 'Button.tsx');
    const initialContent = "import { useState } from 'react';\nexport function Button() {}";
    fs.writeFileSync(testFile, initialContent, 'utf-8');

    const error: PreFlightError = {
      file: 'Button.tsx',
      line: 1,
      column: 1,
      code: 'USE_CLIENT_MISSING',
      rawMessage: "You're importing a component that needs useState.",
      severity: 'error',
      healerId: 'add-use-client',
    };

    // 1. Generate patches
    const patches = AutoHealer.generatePatches(tempDir, [error]);
    expect(patches).toHaveLength(1);
    expect(patches[0].diff).toBeDefined();

    // 2. Apply patch
    const result = AutoHealer.applyPatches(patches);
    expect(result.success).toBe(true);
    expect(result.healedCount).toBe(1);

    const onDisk = fs.readFileSync(testFile, 'utf-8');
    expect(onDisk.startsWith("'use client';")).toBe(true);

    // 3. Rollback
    const rolledBack = AutoHealer.rollback(testFile);
    expect(rolledBack).toBe(true);

    const restoredOnDisk = fs.readFileSync(testFile, 'utf-8');
    expect(restoredOnDisk).toBe(initialContent);
  });
});
