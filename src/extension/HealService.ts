import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AutoHealer, type HealCheckpoint } from '../core/AutoHealer.js';
import { FileHealScanner } from '../core/FileHealScanner.js';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { Diff } from '../core/Diff.js';
import type { LicenseService } from './LicenseService.js';
import { Settings } from './Settings.js';
import type { AutoHealPatch, PreFlightError } from '../shared/types.js';

const PREVIEW_SCHEME = 'launchwizard-preview';
const CONSENT_KEY = 'launchwizard.healOnSaveConsent';

/**
 * Applies fixes through the editor (so Ctrl+Z works and unsaved edits are respected),
 * shows a diff before any batch fix, and keeps one persistent "undo last fix" checkpoint.
 */
export class HealService implements vscode.Disposable {
  private readonly previews = new Map<string, string>();
  private readonly healingNow = new Set<string>();
  /** "Don't fix this here": file + healer pairs the user undid this session. */
  private readonly ignored = new Set<string>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCheckpoint = this.changeEmitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly license: LicenseService
  ) {
    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, {
        provideTextDocumentContent: (uri) => this.previews.get(uri.toString()) ?? '',
      })
    );
  }

  // --- Reading current text (unsaved editor buffers win over disk) -------------------

  public static readCurrent(filePath: string): string | undefined {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.scheme === 'file' && path.normalize(d.uri.fsPath) === path.normalize(filePath));
    if (open) return open.getText();
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  // --- Batch "Fix All" with preview -------------------------------------------------

  /** Previews and (after confirmation) applies every available fix for the given findings. */
  public async healWithPreview(projectRoot: string, findings: PreFlightError[]): Promise<number> {
    const patches = AutoHealer.generatePatches(projectRoot, findings, HealService.readCurrent);
    if (patches.length === 0) {
      void vscode.window.showInformationMessage('LaunchWizard: none of the current findings has a 1-click fix. The cards explain what to do.');
      return 0;
    }

    const list = patches.map((p) => `• ${path.relative(projectRoot, p.filePath)}: ${p.description}`).join('\n');
    const choice = await vscode.window.showInformationMessage(
      `LaunchWizard will change ${patches.length} file${patches.length > 1 ? 's' : ''}.`,
      { modal: true, detail: `${list}\n\nYou can undo with "LaunchWizard: Undo Last Fix" or Ctrl+Z.` },
      'Apply Fixes',
      'Preview Changes'
    );
    if (choice === 'Preview Changes') {
      await this.openPreviews(projectRoot, patches);
      const after = await vscode.window.showInformationMessage(
        `Apply these ${patches.length} fix${patches.length > 1 ? 'es' : ''}?`,
        'Apply Fixes',
        'Cancel'
      );
      if (after !== 'Apply Fixes') return 0;
    } else if (choice !== 'Apply Fixes') {
      return 0;
    }

    const applied = await this.applyPatches(patches);
    if (applied > 0) {
      void vscode.window.showInformationMessage(`🪄 LaunchWizard fixed ${applied} file${applied > 1 ? 's' : ''}.`, 'Undo').then((a) => {
        if (a === 'Undo') void this.undoLast();
      });
    }
    return applied;
  }

  private async openPreviews(projectRoot: string, patches: AutoHealPatch[]): Promise<void> {
    for (const patch of patches.slice(0, 5)) {
      const previewUri = vscode.Uri.from({ scheme: PREVIEW_SCHEME, path: patch.filePath, query: String(Date.now()) });
      this.previews.set(previewUri.toString(), patch.patchedContent);
      await vscode.commands.executeCommand(
        'vscode.diff',
        vscode.Uri.file(patch.filePath),
        previewUri,
        `${path.relative(projectRoot, patch.filePath)} ↔ LaunchWizard fix`,
        { preview: false }
      );
    }
  }

  /**
   * Applies patches as minimal editor edits and saves the files. A file that changed since the
   * patch was generated is skipped, never overwritten.
   */
  public async applyPatches(patches: AutoHealPatch[], save = true): Promise<number> {
    const applicable: AutoHealPatch[] = [];
    const edit = new vscode.WorkspaceEdit();

    for (const patch of patches) {
      const uri = vscode.Uri.file(patch.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      if (doc.getText() !== patch.originalContent) continue;
      const change = Diff.minimalReplace(patch.originalContent, patch.patchedContent);
      edit.replace(uri, new vscode.Range(doc.positionAt(change.start), doc.positionAt(change.end)), change.text);
      applicable.push(patch);
    }
    if (applicable.length === 0) return 0;

    for (const p of applicable) this.healingNow.add(path.normalize(p.filePath));
    try {
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) return 0;
      if (save) {
        for (const p of applicable) {
          const doc = vscode.workspace.textDocuments.find((d) => path.normalize(d.uri.fsPath) === path.normalize(p.filePath));
          await doc?.save();
        }
      }
    } finally {
      for (const p of applicable) this.healingNow.delete(path.normalize(p.filePath));
    }

    await this.saveCheckpoint(AutoHealer.createCheckpoint(applicable));
    return applicable.length;
  }

  // --- Undo ------------------------------------------------------------------------

  private get checkpointFile(): string {
    return path.join(this.context.globalStorageUri.fsPath, 'heal-checkpoint.json');
  }

  private async saveCheckpoint(checkpoint: HealCheckpoint): Promise<void> {
    try {
      await fs.promises.mkdir(path.dirname(this.checkpointFile), { recursive: true });
      await fs.promises.writeFile(this.checkpointFile, JSON.stringify(checkpoint), 'utf-8');
    } catch {
      // Undo is best-effort beyond the editor's own Ctrl+Z
    }
    this.changeEmitter.fire();
  }

  public loadCheckpoint(): HealCheckpoint | null {
    try {
      return JSON.parse(fs.readFileSync(this.checkpointFile, 'utf-8')) as HealCheckpoint;
    } catch {
      return null;
    }
  }

  public canUndo(): boolean {
    return fs.existsSync(this.checkpointFile);
  }

  /** Restores the files from the last fix, unless they were edited again afterwards. */
  public async undoLast(): Promise<void> {
    const checkpoint = this.loadCheckpoint();
    if (!checkpoint) {
      void vscode.window.showInformationMessage('LaunchWizard: there is no fix to undo.');
      return;
    }
    const plan = AutoHealer.planRollback(checkpoint, HealService.readCurrent);
    const restore = plan.restore.map((r) => ({
      filePath: r.filePath,
      description: 'Undo LaunchWizard fix',
      diff: '',
      originalContent: HealService.readCurrent(r.filePath) ?? '',
      patchedContent: r.content,
    }));
    const restored = restore.length > 0 ? await this.applyPatches(restore) : 0;
    await fs.promises.rm(this.checkpointFile, { force: true });
    this.changeEmitter.fire();

    for (const file of checkpoint.files) {
      for (const healer of Object.keys(AutoHealer.SAFETY)) {
        this.ignored.add(`${path.normalize(file.filePath)}|${healer}`);
      }
    }

    const conflictNote = plan.conflicts.length
      ? ` ${plan.conflicts.length} file(s) were edited after the fix and were left as they are: ${plan.conflicts.map((c) => path.basename(c)).join(', ')}.`
      : '';
    void vscode.window.showInformationMessage(`LaunchWizard: undid the last fix in ${restored} file(s).${conflictNote}`);
  }

  // --- Pro: auto-fix on save --------------------------------------------------------

  public async onDidSave(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') return;
    const filePath = path.normalize(document.uri.fsPath);
    if (this.healingNow.has(filePath)) return;
    if (!Settings.healOnSave || !this.license.isPro()) return;

    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return;
    const projectRoot = folder.uri.fsPath;
    if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return;

    const info = FrameworkDetector.detect(projectRoot);
    const findings = FileHealScanner.scanFile(filePath, document.getText(), { projectRoot, framework: info.framework })
      .filter((f) => AutoHealer.safetyOf(f.healerId) === 'safe')
      .filter((f) => !this.ignored.has(`${filePath}|${f.healerId}`));
    if (findings.length === 0) return;

    if (!(await this.ensureConsent())) return;

    const patches = AutoHealer.generatePatches(projectRoot, findings, () => document.getText());
    const applied = await this.applyPatches(patches);
    if (applied === 0) return;

    const choice = await vscode.window.showInformationMessage(
      `🪄 LaunchWizard fixed ${path.basename(filePath)} on save: ${patches[0].description}.`,
      'Undo',
      "Don't Fix This File"
    );
    if (choice === 'Undo') {
      await this.undoLast();
    } else if (choice === "Don't Fix This File") {
      for (const f of findings) this.ignored.add(`${filePath}|${f.healerId}`);
    }
  }

  private async ensureConsent(): Promise<boolean> {
    const consent = this.context.globalState.get<boolean>(CONSENT_KEY);
    if (consent !== undefined) return consent;
    const choice = await vscode.window.showInformationMessage(
      'LaunchWizard Pro can fix safe build traps automatically when you save (a missing \'use client\', an import with the wrong letter case, a .env value cut off at "#"). Every fix can be undone.',
      'Turn On',
      'Not Now'
    );
    const on = choice === 'Turn On';
    await this.context.globalState.update(CONSENT_KEY, on);
    if (!on) await Settings.setHealOnSave(false);
    return on;
  }

  public dispose(): void {
    this.changeEmitter.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
