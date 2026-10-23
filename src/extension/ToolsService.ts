import * as vscode from 'vscode';
import * as path from 'node:path';
import { BuildRunner } from '../core/BuildRunner.js';
import { BundleAnalyzer, type BundleSnapshot } from '../core/BundleAnalyzer.js';
import { DependencyHealth } from '../core/DependencyHealth.js';
import { ErrorTranslator } from '../core/ErrorTranslator.js';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { GitInfo } from '../core/GitInfo.js';
import { PrePushHook } from '../core/PrePushHook.js';
import { SecretScanner } from '../core/SecretScanner.js';
import { ShareCards } from '../core/ShareCards.js';
import type { AppState } from './AppState.js';
import type { LicenseService } from './LicenseService.js';
import { Log } from './Log.js';
import { Settings } from './Settings.js';
import { projectName, projectRoot } from './ShareService.js';

const BUNDLE_HISTORY_KEY = 'launchwizard.bundleSnapshot';

/** The full build check (free) and the Pro "Ship Safe" tools. */
export class ToolsService {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly license: LicenseService,
    private readonly state: AppState
  ) {}

  private requireRoot(): string | null {
    const root = projectRoot();
    if (!root) {
      void vscode.window.showInformationMessage('LaunchWizard: open a project folder first.');
      return null;
    }
    return root;
  }

  // --- Full production build check (free) ---------------------------------------------

  /** Runs `<pm> run build`. Returns true when the build passed. */
  public async runBuildCheck(): Promise<boolean> {
    const root = this.requireRoot();
    if (!root) return false;
    const info = FrameworkDetector.detect(root);

    Log.section(`Production build check (${info.packageManager} run build)`);
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'LaunchWizard: running your production build', cancellable: true },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        progress.report({ message: 'this can take a minute…' });
        return BuildRunner.run(root, info, { signal: controller.signal, onOutput: (chunk) => Log.get().append(chunk) });
      }
    );

    if (!result.ran) {
      void vscode.window.showInformationMessage(`LaunchWizard: ${result.message}`);
      return false;
    }
    this.state.setResult('build', { success: result.success, message: result.message, at: Date.now(), cards: ErrorTranslator.translateBatch(result.errors) });

    if (result.success) {
      if (this.license.isPro()) this.measureBundle(root, info.framework);
      void vscode.window.showInformationMessage(`✅ LaunchWizard: ${result.message}`);
    } else if (result.errors.length > 0) {
      const choice = await vscode.window.showWarningMessage(`🚨 LaunchWizard: ${result.message}`, 'View in Sidebar', 'Open Log');
      if (choice === 'View in Sidebar') await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
      if (choice === 'Open Log') Log.show();
    }
    return result.success;
  }

  // --- Bundle Size Budget (Pro) ---------------------------------------------------------

  public async checkBundleSize(): Promise<void> {
    if (!(await this.license.requirePro('Bundle Size Budget'))) return;
    // Measuring needs a fresh build so the numbers match what will ship.
    await this.runBuildCheck();
  }

  private measureBundle(root: string, framework: Parameters<typeof BundleAnalyzer.measure>[1]): void {
    const snapshot = BundleAnalyzer.measure(root, framework);
    if (!snapshot) return;
    const historyKey = `${BUNDLE_HISTORY_KEY}:${root}`;
    const previous = this.context.workspaceState.get<BundleSnapshot>(historyKey);
    const comparison = BundleAnalyzer.compare(snapshot, previous, Settings.bundleBudgetKb);
    void this.context.workspaceState.update(historyKey, snapshot);

    Log.line(`Bundle: ${comparison.summary}`);
    for (const f of snapshot.largest) Log.line(`  ${(f.gzipBytes / 1024).toFixed(1)} KB  ${f.file}`);
    this.state.setResult('bundle', {
      summary: comparison.summary,
      overBudget: comparison.overBudget,
      grew: (comparison.growthPct ?? 0) >= 20,
      at: Date.now(),
    });
    if (comparison.findings.length > 0) {
      void vscode.window.showWarningMessage(`📦 LaunchWizard: ${comparison.findings.map((f) => f.rawMessage).join(' ')}`);
    }
  }

  // --- Secret Leak Guard (Pro) ----------------------------------------------------------

  public async scanSecrets(): Promise<void> {
    if (!(await this.license.requirePro('Secret Leak Guard'))) return;
    const root = this.requireRoot();
    if (!root) return;

    const findings = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'LaunchWizard: scanning for secrets' },
      async () => SecretScanner.scanProject(root)
    );
    this.state.setResult('secrets', { count: findings.filter((f) => f.severity === 'error').length, at: Date.now() });

    if (findings.length === 0) {
      void vscode.window.showInformationMessage('🔐 LaunchWizard: no hard-coded secrets found in your code or build output.');
      return;
    }

    Log.section(`Secret Leak Guard: ${findings.length} finding(s)`);
    for (const f of findings) Log.line(`${f.severity.toUpperCase()}  ${f.file}:${f.line}  ${f.label} (${f.preview})  ${f.advice}`);

    const pick = await vscode.window.showQuickPick(
      findings.map((f) => ({
        label: `${f.severity === 'error' ? '$(error)' : '$(warning)'} ${f.label}`,
        description: `${f.file}:${f.line}${f.inBuildOutput ? ' · in build output' : ''}`,
        detail: `${f.preview}: ${f.advice}`,
        finding: f,
      })),
      { placeHolder: `${findings.length} possible secret(s). Pick one to open it.`, matchOnDescription: true }
    );
    if (pick) {
      await ToolsService.openAt(root, pick.finding.file, pick.finding.line);
    }
  }

  // --- Pre-Push Gate (Pro) --------------------------------------------------------------

  public prePushStatus(): string {
    const root = projectRoot();
    return root ? PrePushHook.status(root) : 'not-a-repo';
  }

  public async togglePrePushGate(): Promise<void> {
    if (!(await this.license.requirePro('Pre-Push Gate'))) return;
    const root = this.requireRoot();
    if (!root) return;

    const repo = GitInfo.topLevel(root) ?? root;
    const status = PrePushHook.status(repo);
    const result = status === 'installed' ? PrePushHook.uninstall(repo) : PrePushHook.install(repo, this.cliPath());
    if (result.ok) {
      void vscode.window.showInformationMessage(`LaunchWizard: ${result.message}`);
    } else if (result.status === 'custom-hooks-path' && result.message.includes('\n')) {
      const line = result.message.split('\n').pop()!;
      const choice = await vscode.window.showWarningMessage(`LaunchWizard: ${result.message.split('\n')[0]}`, 'Copy Hook Line');
      if (choice === 'Copy Hook Line') await vscode.env.clipboard.writeText(line);
    } else {
      void vscode.window.showWarningMessage(`LaunchWizard: ${result.message}`);
    }
    this.state.changed();
  }

  /** Keeps the checker copied into .git up to date after extension updates. */
  public refreshPrePushCli(): void {
    const root = projectRoot();
    if (!root) return;
    try {
      PrePushHook.refreshCli(GitInfo.topLevel(root) ?? root, this.cliPath());
    } catch {
      // Not critical
    }
  }

  private cliPath(): string {
    return path.join(this.context.extensionUri.fsPath, 'dist', 'cli.js');
  }

  // --- Dependency Health (Pro) ----------------------------------------------------------

  public async checkDependencies(): Promise<void> {
    if (!(await this.license.requirePro('Dependency Health'))) return;
    const root = this.requireRoot();
    if (!root) return;
    const info = FrameworkDetector.detect(root);

    const report = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'LaunchWizard: checking your dependencies', cancellable: true },
      async (_progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        return DependencyHealth.run(root, info.packageManager, { signal: controller.signal });
      }
    );

    const serious = report.counts.critical + report.counts.high;
    this.state.setResult('deps', { message: report.message, serious, at: Date.now() });
    Log.section('Dependency Health');
    Log.line(report.message);
    for (const v of report.vulnerable.slice(0, 30)) Log.line(`  ${v.severity.padEnd(8)} ${v.name}${v.title ? `: ${v.title}` : ''}${v.fixAvailable ? ' (fix available)' : ''}`);
    for (const o of report.outdated) Log.line(`  outdated ${o.name} ${o.current} → ${o.latest}`);

    const actions = report.fixCommand ? ['Run Fix in Terminal', 'Open Log'] : ['Open Log'];
    const choice = await (serious > 0 ? vscode.window.showWarningMessage : vscode.window.showInformationMessage)(`📦 LaunchWizard: ${report.message}`, ...actions);
    if (choice === 'Open Log') Log.show();
    if (choice === 'Run Fix in Terminal' && report.fixCommand) {
      const terminal = vscode.window.createTerminal({ name: 'LaunchWizard', cwd: root });
      terminal.show();
      terminal.sendText(report.fixCommand);
    }
  }

  // --- Shareable Pre-Flight Report (Pro) --------------------------------------------------

  public async exportReport(): Promise<void> {
    if (!(await this.license.requirePro('Shareable reports'))) return;
    const root = this.requireRoot();
    if (!root) return;
    if (!this.state.report) {
      void vscode.window.showInformationMessage('LaunchWizard: run a pre-flight check first, then export it.');
      return;
    }
    const input = { projectName: projectName(root), report: this.state.report, translated: this.state.translated, git: GitInfo.snapshot(root) };
    const pick = await vscode.window.showQuickPick(
      [
        { label: 'Copy as Markdown', description: 'paste into a pull request or chat', id: 'clip' },
        { label: 'Save as Markdown file', id: 'md' },
        { label: 'Save as HTML page', description: 'send to a client', id: 'html' },
      ],
      { placeHolder: 'Export the pre-flight report' }
    );
    if (!pick) return;
    if (pick.id === 'clip') {
      await vscode.env.clipboard.writeText(ShareCards.reportMarkdown(input));
      void vscode.window.showInformationMessage('📋 Pre-flight report copied.');
      return;
    }
    const ext = pick.id === 'md' ? 'md' : 'html';
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(root, `preflight-report.${ext}`)),
      filters: ext === 'md' ? { Markdown: ['md'] } : { HTML: ['html'] },
    });
    if (!target) return;
    const content = ext === 'md' ? ShareCards.reportMarkdown(input) : ShareCards.reportHtml(input);
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf-8'));
    void vscode.window.showInformationMessage(`LaunchWizard: report saved to ${path.basename(target.fsPath)}.`);
  }

  public static async openAt(root: string, file: string, line: number): Promise<void> {
    const full = path.isAbsolute(file) ? file : path.join(root, file);
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(full));
      const pos = new vscode.Position(Math.max(0, line - 1), 0);
      await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos) });
    } catch {
      void vscode.window.showInformationMessage(`LaunchWizard: could not open ${file}.`);
    }
  }
}
