import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { __mock, makeDocument } from './mocks/vscode.js';
import { activate, deactivate } from '../src/extension/extension.js';
import { LaunchWizardCodeActionProvider } from '../src/extension/CodeActions.js';
import { PreFlightEngine } from '../src/core/PreFlightEngine.js';
import { LicenseManager } from '../src/core/LicenseManager.js';
import { SecretScanner } from '../src/core/SecretScanner.js';

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')) as {
  contributes: { commands: Array<{ command: string }>; configuration: { properties: Record<string, unknown> } };
};

let root: string;
let storage: string;

const activateExtension = async () => {
  const context = __mock.makeContext(path.join(__dirname, '..'), storage);
  await activate(context as unknown as vscode.ExtensionContext);
  return context;
};

const storeProLicense = () => {
  __mock.secrets.set(
    'launchwizard.license',
    JSON.stringify({ key: '6F0E4C97-B72A4E69-A11BF6C4-AF6517E7', machineIdHash: LicenseManager.hashMachineId('test-machine'), activatedAt: Date.now(), verifiedAt: Date.now(), uses: 1 })
  );
};

beforeEach(() => {
  __mock.reset();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-ext-'));
  storage = fs.mkdtempSync(path.join(os.tmpdir(), 'launchwizard-storage-'));
  __mock.workspaceRoot = root;
});

afterEach(() => {
  deactivate();
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(storage, { recursive: true, force: true });
});

describe('extension activation', () => {
  it('registers exactly the commands declared in package.json', async () => {
    await activateExtension();
    const declared = manifest.contributes.commands.map((c) => c.command).sort();
    expect([...__mock.registry.keys()].sort()).toEqual(declared);
  });

  it('declares every setting the code reads', () => {
    const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension', 'Settings.ts'), 'utf-8');
    const used = [...settingsSource.matchAll(/get<\w+>\('([^']+)'/g)].map((m) => `launchwizard.${m[1]}`);
    for (const key of used) {
      expect(manifest.contributes.configuration.properties).toHaveProperty([key]);
    }
  });
});

describe('Pro gating (free tier stays nag-free)', () => {
  it('a free user asking for a Pro tool gets one calm message and nothing runs', async () => {
    const scan = vi.spyOn(SecretScanner, 'scanProject');
    await activateExtension();
    await vscode.commands.executeCommand('launchwizard.scanSecrets');
    expect(scan).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(vscode.window.showInformationMessage).mock.calls[0][0])).toContain('$9.99 once');
  });

  it('activation itself shows no messages to free users', async () => {
    await activateExtension();
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('a Pro user runs the tool directly', async () => {
    storeProLicense();
    const scan = vi.spyOn(SecretScanner, 'scanProject').mockReturnValue([]);
    await activateExtension();
    await vscode.commands.executeCommand('launchwizard.scanSecrets');
    expect(scan).toHaveBeenCalledOnce();
  });
});

describe('save pipeline (B9)', () => {
  it('debounces background checks: five quick saves run one check', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      storeProLicense();
      __mock.config.set('healOnSave', false);
      const run = vi.spyOn(PreFlightEngine, 'run').mockResolvedValue({
        framework: 'unknown', frameworkName: 'App', packageManager: 'npm', hasTypeScript: false, passed: true,
        errors: [], warnings: [], durationMs: 1, timestamp: Date.now(), summaryText: 'ok',
      });
      await activateExtension();
      const doc = makeDocument(path.join(root, 'a.ts'), 'export {}');
      for (let i = 0; i < 5; i++) {
        await __mock.saveListeners[0](doc);
        await vi.advanceTimersByTimeAsync(200);
      }
      await vi.advanceTimersByTimeAsync(2000);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('free users get no background check on save', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const run = vi.spyOn(PreFlightEngine, 'run');
      await activateExtension();
      await __mock.saveListeners[0](makeDocument(path.join(root, 'a.ts'), 'export {}'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(run).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('lightbulb fixes (B8)', () => {
  const provider = new LaunchWizardCodeActionProvider();
  const writePkg = (deps: Record<string, string>) => fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: deps }));
  const actionsFor = (rel: string, text: string, line: number) => {
    const doc = makeDocument(path.join(root, rel), text);
    provider.invalidate();
    return provider.provideCodeActions(doc as unknown as vscode.TextDocument, new vscode.Range(line, 0, line, 0)).map((a) => a.title);
  };

  it("offers 'use client' for hooks in a Next.js app component", () => {
    writePkg({ next: '15.0.0' });
    const titles = actionsFor('app/Counter.tsx', "import { useState } from 'react';\nexport const C = () => { const [n] = useState(0); return n; };", 1);
    expect(titles.some((t) => t.includes("'use client'"))).toBe(true);
  });

  it('never offers the Vite env fix in a Next.js project', () => {
    writePkg({ next: '15.0.0' });
    const titles = actionsFor('lib/api.ts', 'export const url = process.env.API_URL;', 0);
    expect(titles.some((t) => t.includes('import.meta.env'))).toBe(false);
  });

  it('never offers to make a secret-looking variable public', () => {
    writePkg({ next: '15.0.0' });
    const titles = actionsFor('app/Pay.tsx', "\"use client\";\nconst k = process.env.STRIPE_SECRET_KEY;", 1);
    expect(titles.some((t) => t.includes('NEXT_PUBLIC_'))).toBe(false);
    const safe = actionsFor('app/Link.tsx', "\"use client\";\nconst u = process.env.SITE_URL;", 1);
    expect(safe.some((t) => t.includes('NEXT_PUBLIC_SITE_URL'))).toBe(true);
  });

  it('recognises "use client" in double quotes and does not add a duplicate', () => {
    writePkg({ next: '15.0.0' });
    const titles = actionsFor('app/A.tsx', '"use client";\nexport const A = () => <button onClick={() => 1} />;', 1);
    expect(titles.some((t) => t.includes("'use client'"))).toBe(false);
  });

  it('offers the Vite env fix only in Vite projects, as a minimal edit', () => {
    writePkg({ vite: '5.0.0' });
    const doc = makeDocument(path.join(root, 'src', 'main.ts'), 'const u = process.env.API_URL;');
    const [action] = provider.provideCodeActions(doc as unknown as vscode.TextDocument, new vscode.Range(0, 0, 0, 0));
    expect(action.title).toContain('import.meta.env.VITE_API_URL');
    const edit = (action.edit as unknown as { edits: Array<{ range: vscode.Range; text: string }> }).edits[0];
    expect(edit.range.start.character).toBe(10);
    expect(edit.text).toBe('import.meta.env.VITE_');
  });
});

describe('Pro auto-fix on save (Phase 14)', () => {
  it("adds 'use client' on save through an editor edit, records an undo point, and respects opt-out", async () => {
    storeProLicense();
    __mock.config.set('checkOnSave', false);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { next: '15.0.0' } }));
    const file = path.join(root, 'app', 'Counter.tsx');
    const text = "import { useState } from 'react';\nexport const C = () => { const [n] = useState(0); return n; };\n";
    const doc = makeDocument(file, text);
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc as never);
    (vscode.workspace.textDocuments as unknown[]).length = 0;
    (vscode.workspace.textDocuments as unknown[]).push(doc);

    const context = await activateExtension();
    await context.globalState.update('launchwizard.healOnSaveConsent', true);
    await __mock.saveListeners[0](doc);

    const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0]?.[0] as unknown as { edits: Array<{ range: vscode.Range; text: string }> };
    expect(edit.edits).toHaveLength(1);
    expect(edit.edits[0].range.start.line).toBe(0);
    expect(edit.edits[0].text).toBe("'use client';\n\n");
    expect(doc.save).toHaveBeenCalled();
    expect(fs.existsSync(path.join(storage, 'heal-checkpoint.json'))).toBe(true);

    // Opted out: nothing is applied.
    vi.mocked(vscode.workspace.applyEdit).mockClear();
    await context.globalState.update('launchwizard.healOnSaveConsent', false);
    await __mock.saveListeners[0](doc);
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
  });
});

describe('auto-fix on save never runs review-class fixes', () => {
  it('a TS18003-style tsconfig fix or optional chaining is not applied on save', async () => {
    storeProLicense();
    __mock.config.set('checkOnSave', false);
    const doc = makeDocument(path.join(root, 'tsconfig.json'), '{"include":["nothing"]}');
    const context = await activateExtension();
    await context.globalState.update('launchwizard.healOnSaveConsent', true);
    await __mock.saveListeners[0](doc);
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
  });
});

describe('BYOK deploy safety (Phase 15)', () => {
  const failingReport = {
    framework: 'vite' as const, frameworkName: 'Vite', packageManager: 'npm' as const, hasTypeScript: true, passed: false,
    errors: [{ file: 'src/a.ts', line: 1, column: 1, code: 'TS2322', rawMessage: 'x', severity: 'error' as const }],
    warnings: [], durationMs: 1, timestamp: Date.now(), summaryText: '1 blocker',
  };

  const setup = async (passed: boolean) => {
    storeProLicense();
    __mock.secrets.set('launchwizard.vercelToken', 'tok');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'shop', dependencies: { vite: '5' } }));
    vi.spyOn(PreFlightEngine, 'run').mockResolvedValue(passed ? { ...failingReport, passed: true, errors: [] } : failingReport);
    vi.spyOn(SecretScanner, 'scanProject').mockReturnValue([]);
    const { DeployManager } = await import('../src/core/DeployManager.js');
    const deploy = vi.spyOn(DeployManager, 'deploy').mockResolvedValue({ success: true, url: 'https://shop.vercel.app', message: 'ok', outputTail: '' });
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ id: 'vercel' } as never);
    await activateExtension();
    await new Promise((r) => setTimeout(r, 0)); // let connected-account state load
    return deploy;
  };

  it('a failed pre-flight blocks the deploy unless the user explicitly overrides', async () => {
    const deploy = await setup(false);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
    await vscode.commands.executeCommand('launchwizard.deploy');
    expect(deploy).not.toHaveBeenCalled();
    expect(String(vi.mocked(vscode.window.showWarningMessage).mock.calls[0][0])).toContain('build blocker');
  });

  it('nothing deploys when the confirmation is dismissed', async () => {
    const deploy = await setup(true);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);
    await vscode.commands.executeCommand('launchwizard.deploy');
    expect(deploy).not.toHaveBeenCalled();
  });

  it('a confirmed deploy is a preview; production needs a second confirmation', async () => {
    const deploy = await setup(true);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValueOnce('Deploy Preview' as never);
    await vscode.commands.executeCommand('launchwizard.deploy');
    expect(deploy).toHaveBeenCalledOnce();
    expect(deploy.mock.calls[0][0]).toMatchObject({ target: 'vercel', production: false, credentials: { token: 'tok' } });

    deploy.mockClear();
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValueOnce('Deploy to Production…' as never);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(undefined);
    await vscode.commands.executeCommand('launchwizard.deploy');
    expect(deploy).not.toHaveBeenCalled();
  });
});
