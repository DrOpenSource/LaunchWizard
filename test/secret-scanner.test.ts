import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SecretScanner } from '../src/core/SecretScanner.js';

// Fake credentials are assembled at runtime so this file never contains a literal secret
// (GitHub push protection would otherwise block commits).
const join = (...parts: string[]) => parts.join('');
const STRIPE = join('sk_', 'live_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3');
const AWS = join('AKIA', 'IOSFODNN7EXAMPLE');
const OPENAI = join('sk-', 'proj-', 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z');
const ANTHROPIC = join('sk-', 'ant-', 'api03-Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4zAA');
const jwt = (payload: object) =>
  join('eyJhbGciOiJIUzI1NiJ9', '.', Buffer.from(JSON.stringify(payload)).toString('base64url'), '.', 'c2lnbmF0dXJlLXZhbHVl');

describe('SecretScanner', () => {
  it('finds common hard-coded credentials and masks them', () => {
    const code = [
      `const stripe = "${STRIPE}";`,
      `const aws = '${AWS}';`,
      `const ai = "${OPENAI}";`,
      `const claude = "${ANTHROPIC}";`,
    ].join('\n');
    const findings = SecretScanner.scanText(code, 'src/pay.ts');
    expect(findings.map((f) => f.ruleId)).toEqual(['stripe-secret', 'aws-access-key', 'openai-key', 'anthropic-key']);
    expect(findings[0].preview).toBe('sk_liv…m3');
    expect(findings.every((f) => !f.preview.includes(STRIPE))).toBe(true);
  });

  it('only flags Supabase JWTs that carry the service_role claim', () => {
    const service = jwt({ role: 'service_role', iss: 'supabase' });
    const anon = jwt({ role: 'anon', iss: 'supabase' });
    expect(SecretScanner.scanText(`k="${service}"`, 'a.ts').map((f) => f.ruleId)).toEqual(['supabase-service-role']);
    expect(SecretScanner.scanText(`k="${anon}"`, 'a.ts')).toHaveLength(0);
  });

  it('flags database URLs with a real password but not placeholders', () => {
    expect(SecretScanner.scanText(join('postgres://app:', 'Sup3rS3cret', '@db.example.com/main'), 'a.ts')).toHaveLength(1);
    expect(SecretScanner.scanText('postgres://user:password@localhost/db', 'a.ts')).toHaveLength(0);
    expect(SecretScanner.scanText('postgres://user:${DB_PASS}@localhost/db', 'a.ts')).toHaveLength(0);
  });

  it('respects the ignore marker', () => {
    const code = `// launchwizard-ignore-secret\nconst testKey = "${STRIPE}";`;
    expect(SecretScanner.scanText(code, 'test.ts')).toHaveLength(0);
  });

  it('flags secret-looking public variable names in .env files', () => {
    const env = 'NEXT_PUBLIC_STRIPE_SECRET_KEY=x\nNEXT_PUBLIC_SUPABASE_ANON_KEY=y\nSTRIPE_SECRET_KEY=z\nVITE_API_TOKEN=t\n';
    const names = SecretScanner.scanEnvFileNames(env, '.env').map((f) => f.preview);
    expect(names).toEqual(['NEXT_PUBLIC_STRIPE_SECRET_KEY', 'VITE_API_TOKEN']);
  });

  describe('project scan', () => {
    let root: string;
    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-secrets-'));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('scans source and build output, skips node_modules and .env values', () => {
      fs.mkdirSync(path.join(root, 'src'));
      fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
      fs.mkdirSync(path.join(root, 'dist', 'assets'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src', 'clean.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'index.js'), `"${AWS}"`);
      fs.writeFileSync(path.join(root, 'dist', 'assets', 'index-abc.js'), `var k="${STRIPE}";`);
      fs.writeFileSync(path.join(root, '.env'), `STRIPE_SECRET_KEY=${STRIPE}\n`);

      const findings = SecretScanner.scanProject(root);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ ruleId: 'stripe-secret', inBuildOutput: true });
      expect(findings[0].file.replace(/\\/g, '/')).toBe('dist/assets/index-abc.js');
    });
  });
});
