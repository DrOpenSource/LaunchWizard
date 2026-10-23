import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileHealScanner } from '../src/core/FileHealScanner.js';
import { AutoHealer } from '../src/core/AutoHealer.js';
import { Diff } from '../src/core/Diff.js';

describe('FileHealScanner', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-scan-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe("'use client' detection", () => {
    const scan = (rel: string, content: string) =>
      FileHealScanner.detectMissingUseClient(rel, content, 'nextjs');

    it('flags hooks in an app component without the directive', () => {
      const finding = scan('app/Counter.tsx', "import { useState } from 'react';\nexport function Counter() {\n  const [n] = useState(0);\n  return <b>{n}</b>;\n}");
      expect(finding?.code).toBe('USE_CLIENT_MISSING');
      expect(finding?.line).toBe(3);
      expect(finding?.healerId).toBe('add-use-client');
    });

    it('flags JSX event handlers', () => {
      expect(scan('components/Buy.tsx', 'export const Buy = () => <button onClick={() => 1}>Buy</button>;')).not.toBeNull();
    });

    it('ignores files that already have a directive (either quote style)', () => {
      expect(scan('app/A.tsx', '"use client";\nconst [a] = useState(1);')).toBeNull();
      expect(scan('app/A.tsx', "'use server';\nconst [a] = useState(1);")).toBeNull();
    });

    it('never touches server-only files (metadata, async components, next/headers)', () => {
      expect(scan('app/page.tsx', "export const metadata = {};\nconst [a] = useState(1);")).toBeNull();
      expect(scan('app/page.tsx', 'export default async function Page() { return <div onClick={x} />; }')).toBeNull();
      expect(scan('app/x.tsx', "import { cookies } from 'next/headers';\nconst [a] = useState(1);")).toBeNull();
    });

    it('ignores non-Next projects and non-component files', () => {
      expect(FileHealScanner.detectMissingUseClient('app/A.tsx', 'useState(1)', 'vite')).toBeNull();
      expect(scan('app/util.ts', 'useState(1)')).toBeNull();
      expect(scan('lib/A.tsx', 'useState(1)')).toBeNull();
    });
  });

  describe('import letter case', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(root, 'src', 'components'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src', 'components', 'Button.tsx'), 'export {}');
    });

    it('finds a case mismatch and proposes the on-disk spelling', () => {
      const file = path.join(root, 'src', 'App.tsx');
      const content = "import { Button } from './components/button';\n";
      const findings = FileHealScanner.findImportCaseMismatches(file, 'src/App.tsx', content, root);
      expect(findings).toHaveLength(1);
      expect(findings[0].healData).toEqual({ spec: './components/button', fixedSpec: './components/Button' });
    });

    it('resolves the @/ alias from tsconfig paths', () => {
      fs.writeFileSync(path.join(root, 'tsconfig.json'), '{ // comment\n "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }');
      const findings = FileHealScanner.findImportCaseMismatches(path.join(root, 'src', 'App.tsx'), 'src/App.tsx', "import B from '@/Components/Button';", root);
      expect(findings[0].healData?.fixedSpec).toBe('@/components/Button');
    });

    it('leaves exact and unresolvable imports alone, and never guesses between two matches', () => {
      expect(FileHealScanner.correctCase(path.join(root, 'src'), './components/Button')).toBeNull();
      expect(FileHealScanner.correctCase(path.join(root, 'src'), './nope/Thing')).toBeNull();
      fs.mkdirSync(path.join(root, 'amb'));
      fs.writeFileSync(path.join(root, 'amb', 'Card.tsx'), '');
      fs.writeFileSync(path.join(root, 'amb', 'CARD.ts'), '');
      // Only meaningful on case-sensitive filesystems, where both files can exist.
      if (fs.readdirSync(path.join(root, 'amb')).length === 2) {
        expect(FileHealScanner.correctCase(root, './amb/card')).toBeNull();
      }
    });
  });

  describe('.env "#" truncation', () => {
    it('flags an unquoted # that dotenv would treat as a comment', () => {
      const findings = FileHealScanner.findEnvHashTruncation('.env', 'DB_PASS=abc#123\nOK=fine # real comment\nQ="a#b"\n');
      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(1);
      expect(findings[0].rawMessage).toContain('"abc"');
    });

    it('quotes the value and keeps a trailing comment', () => {
      expect(AutoHealer.applyEnvQuoteFix('A=x#y # note\n', 1)).toBe('A="x#y" # note\n');
      expect(AutoHealer.applyEnvQuoteFix('A=say"hi"#1\n', 1)).toBe("A='say\"hi\"#1'\n");
    });
  });
});

describe('AutoHealer patches and rollback planning', () => {
  it('combines several fixes in one file and produces a real diff', () => {
    const content = "import B from './b';\nexport const C = () => <i onClick={f} />;\n";
    const patches = AutoHealer.generatePatches('/proj', [
      { file: 'app/C.tsx', line: 1, column: 1, code: 'IMPORT_CASE_MISMATCH', rawMessage: '', severity: 'error', healerId: 'fix-import-case', healData: { spec: './b', fixedSpec: './B' } },
      { file: 'app/C.tsx', line: 2, column: 1, code: 'USE_CLIENT_MISSING', rawMessage: '', severity: 'error', healerId: 'add-use-client' },
    ], () => content);

    expect(patches).toHaveLength(1);
    expect(patches[0].patchedContent).toBe("'use client';\n\nimport B from './B';\nexport const C = () => <i onClick={f} />;\n");
    expect(patches[0].diff).toContain("-import B from './b';");
    expect(patches[0].diff).toContain("+import B from './B';");
    expect(patches[0].diff).toContain("+'use client';");
  });

  it('plans a rollback only for files untouched since the heal', () => {
    const checkpoint = {
      createdAt: 0,
      files: [
        { filePath: 'a', before: 'A0', after: 'A1' },
        { filePath: 'b', before: 'B0', after: 'B1' },
        { filePath: 'c', before: 'C0', after: 'C1' },
      ],
    };
    const current: Record<string, string> = { a: 'A1', b: 'B2 edited later', c: 'C0' };
    const plan = AutoHealer.planRollback(checkpoint, (p) => current[p]);
    expect(plan.restore).toEqual([{ filePath: 'a', content: 'A0' }]);
    expect(plan.conflicts).toEqual(['b']);
  });

  it('classifies healer safety', () => {
    expect(AutoHealer.safetyOf('add-use-client')).toBe('safe');
    expect(AutoHealer.safetyOf('optional-chaining')).toBe('review');
    expect(AutoHealer.safetyOf('unknown')).toBe('review');
  });
});

describe('Diff', () => {
  it('produces hunks with context', () => {
    const diff = Diff.unified('a\nb\nc\nd\ne\nf\ng\nh\n', 'a\nb\nc\nD\ne\nf\ng\nh\n', 'x.ts', 1);
    expect(diff).toBe(['--- a/x.ts', '+++ b/x.ts', '@@ -3,3 +3,3 @@', ' c', '-d', '+D', ' e'].join('\n'));
  });
});

describe('Healer idempotence', () => {
  it('applying each safe healer twice changes nothing the second time', () => {
    const once = AutoHealer.applyUseClientFix('export const a = 1;\n');
    expect(AutoHealer.applyUseClientFix(once)).toBe(once);
    const env = AutoHealer.applyEnvQuoteFix('PASS=ab#1\n', 1);
    expect(AutoHealer.applyEnvQuoteFix(env, 1)).toBe(env);
    const imp = AutoHealer.applyImportCaseFix("import B from './b';\n", 1, './b', './B');
    expect(AutoHealer.applyImportCaseFix(imp, 1, './b', './B')).toBe(imp);
  });
});
