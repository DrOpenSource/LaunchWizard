import * as vscode from 'vscode';
import * as path from 'node:path';
import { PreFlightEngine } from '../core/PreFlightEngine.js';
import { ErrorTranslator } from '../core/ErrorTranslator.js';
import { AutoHealer } from '../core/AutoHealer.js';
import { TunnelManager } from '../core/TunnelManager.js';
import type { PreFlightReport } from '../shared/types.js';
import { AppState } from './AppState.js';
import { LaunchWizardCodeActionProvider } from './CodeActions.js';
import { DeployService } from './DeployService.js';
import { HealService } from './HealService.js';
import { LicenseService, PRICING_URL, SUPPORT_URL } from './LicenseService.js';
import { Log } from './Log.js';
import { PreFlightDeckViewProvider } from './PreFlightDeckView.js';
import { Settings } from './Settings.js';
import { ShareService, projectRoot } from './ShareService.js';
import { StatusBarController } from './StatusBar.js';
import { ToolsService } from './ToolsService.js';

const WEBSITE_URL = 'https://launchwizard.taqnik.in';
const SAVE_CHECK_DEBOUNCE_MS = 1500;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const state = new AppState();
  const license = await LicenseService.create(context);
  const heal = new HealService(context, license);
  const share = new ShareService(license, () => state.report);
  const tools = new ToolsService(context, license, state);
  const deploys = new DeployService(context, license, state, share, tools);
  const statusBar = new StatusBarController(state);
  const deck = new PreFlightDeckViewProvider(state, license, heal, tools, deploys);
  const codeActions = new LaunchWizardCodeActionProvider();

  context.subscriptions.push(state, license, heal, share, deploys, statusBar, deck, { dispose: () => Log.dispose() });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PreFlightDeckViewProvider.viewType, deck),
    vscode.languages.registerCodeActionsProvider(
      [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', pattern: '**/.env*' },
      ],
      codeActions,
      { providedCodeActionKinds: LaunchWizardCodeActionProvider.providedCodeActionKinds }
    )
  );

  // --- Pre-flight (single-flight: a second request joins the running check) ------------

  let running: Promise<PreFlightReport | null> | null = null;
  const runCheck = (): Promise<PreFlightReport | null> => {
    if (running) return running;
    const root = projectRoot();
    if (!root) return Promise.resolve(null);
    state.setChecking(true);
    running = PreFlightEngine.run({ projectRoot: root, timeoutMs: Settings.preflightTimeoutMs })
      .then((report) => {
        state.setReport(report, ErrorTranslator.translateBatch(report.errors), ErrorTranslator.translateBatch(report.warnings));
        return report;
      })
      .finally(() => {
        running = null;
        state.setChecking(false);
      });
    return running;
  };

  const register = (command: string, handler: (...args: never[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));

  register('launchwizard.openMenu', () => statusBar.showQuickMenu(license.isPro()));

  register('launchwizard.runPreFlight', async () => {
    const report = await runCheck();
    if (!report) {
      void vscode.window.showInformationMessage('LaunchWizard: open a project folder to run the pre-flight check.');
      return;
    }
    if (report.passed) {
      void vscode.window.showInformationMessage(`🚀 LaunchWizard: ${report.summaryText}`);
      return;
    }
    const fixable = [...report.errors, ...report.warnings].some((e) => e.healerId);
    const action = await vscode.window.showWarningMessage(
      `🚨 LaunchWizard: ${report.summaryText}`,
      ...(fixable ? ['Fix All (Preview)'] : []),
      'View Details'
    );
    if (action === 'Fix All (Preview)') await vscode.commands.executeCommand('launchwizard.autoHealAll');
    if (action === 'View Details') await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
  });

  register('launchwizard.runBuildCheck', () => tools.runBuildCheck());

  // --- Fixes ----------------------------------------------------------------------------

  register('launchwizard.autoHealAll', async () => {
    const root = projectRoot();
    if (!root) return;
    if (!state.report) await runCheck();
    const applied = await heal.healWithPreview(root, state.allFindings());
    if (applied > 0) await runCheck();
  });

  register('launchwizard.fixFinding', async (index: number) => {
    const root = projectRoot();
    const finding = [...(state.report?.errors ?? []), ...(state.report?.warnings ?? [])][index];
    if (!root || !finding?.healerId) return;
    const patches = AutoHealer.generatePatches(root, [finding], HealService.readCurrent);
    if ((await heal.applyPatches(patches)) > 0) {
      void vscode.window.showInformationMessage(`🪄 LaunchWizard: ${patches[0].description}.`, 'Undo').then((a) => {
        if (a === 'Undo') void heal.undoLast();
      });
      await runCheck();
    }
  });

  register('launchwizard.undoLastHeal', async () => {
    await heal.undoLast();
    await runCheck();
  });

  register('launchwizard.openFinding', async (file: string, line: number) => {
    const root = projectRoot();
    if (!root) return;
    await ToolsService.openAt(root, file, line);
  });

  // --- Sharing ------------------------------------------------------------------------------

  register('launchwizard.startPreview', () => share.start('standard'));
  register('launchwizard.startTunnel', () => share.start('standard'));
  register('launchwizard.startPrivatePreview', () => share.start('private'));
  register('launchwizard.startCustomDomainPreview', () => share.start('custom-domain'));
  register('launchwizard.setupCustomDomain', async () => {
    if (!(await license.requirePro('Custom subdomains'))) return;
    const named = await share.ensureCustomDomain(true);
    if (named) void vscode.window.showInformationMessage(`LaunchWizard: ${named.hostname} is ready. Use "Share on My Domain" to go live.`);
  });
  register('launchwizard.shareExtraPort', () => share.shareExtraPort());
  register('launchwizard.stopPreview', (id?: string) => share.stop(typeof id === 'string' ? id : 'primary'));
  register('launchwizard.stopTunnel', (id?: string) => share.stop(typeof id === 'string' ? id : 'primary'));
  register('launchwizard.copyLink', async () => {
    const t = TunnelManager.getStatus();
    if (t.status !== 'active') return;
    await vscode.env.clipboard.writeText(t.shareUrl ?? t.url);
    void vscode.window.showInformationMessage(`📋 Copied ${t.url}`);
  });
  register('launchwizard.showMobileQr', async () => {
    if (TunnelManager.getStatus().status !== 'active') {
      const launch = await vscode.window.showInformationMessage('No live link yet. Create one now?', 'Get Shareable Link');
      if (launch) await share.start('standard');
      return;
    }
    await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
  });
  register('launchwizard.copyPreviewCard', () => share.copyTeamCard());
  register('launchwizard.saveQrImage', () => share.saveQrImage());
  register('launchwizard.showVisitors', () => share.showVisitors());

  // --- Ship Safe tools & deploy ----------------------------------------------------------------

  register('launchwizard.scanSecrets', () => tools.scanSecrets());
  register('launchwizard.togglePrePushGate', () => tools.togglePrePushGate());
  register('launchwizard.checkDependencies', () => tools.checkDependencies());
  register('launchwizard.checkBundleSize', () => tools.checkBundleSize());
  register('launchwizard.exportReport', () => tools.exportReport());
  register('launchwizard.connectVercel', () => deploys.connectVercel());
  register('launchwizard.connectCloudflare', () => deploys.connectCloudflare());
  register('launchwizard.disconnectDeployAccounts', () => deploys.disconnect());
  register('launchwizard.deploy', () => deploys.deploy());

  // --- License & links -------------------------------------------------------------------------

  register('launchwizard.activateLicense', async () => {
    const key = await vscode.window.showInputBox({
      title: 'Activate LaunchWizard Pro',
      prompt: 'Paste the license key from your Gumroad receipt',
      placeHolder: 'XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX',
      ignoreFocusOut: true,
    });
    if (!key) return;
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'LaunchWizard: checking your key with Gumroad…' },
      () => license.activate(key)
    );
    if (result.success) void vscode.window.showInformationMessage(result.message);
    else void vscode.window.showErrorMessage(result.message);
  });

  register('launchwizard.licenseStatus', async () => {
    const s = license.status();
    if (!s.lastVerifiedAt) {
      const choice = await vscode.window.showInformationMessage('LaunchWizard: you are on the free plan. All free features work without a key.', 'Get Pro', 'Enter Key');
      if (choice === 'Get Pro') await vscode.env.openExternal(vscode.Uri.parse(PRICING_URL));
      if (choice === 'Enter Key') await vscode.commands.executeCommand('launchwizard.activateLicense');
      return;
    }
    const detail = [
      `Key: ${s.key}`,
      `Status: ${s.isActivated ? 'Pro active' : 'paused until the next successful online check'}`,
      `Last checked with Gumroad: ${new Date(s.lastVerifiedAt).toLocaleString()}`,
      `Works offline until: ${s.graceEndsAt ? new Date(s.graceEndsAt).toLocaleDateString() : 'n/a'}`,
      s.uses ? `Machines: ${s.uses} of ${s.maxMachines}` : '',
    ].filter(Boolean).join('\n');
    const choice = await vscode.window.showInformationMessage('LaunchWizard Pro license', { modal: true, detail }, 'Re-check Now', 'Remove From This Machine', 'Request a Seat Reset');
    if (choice === 'Re-check Now') {
      await license.refreshIfDue();
      void vscode.window.showInformationMessage(license.isPro() ? 'LaunchWizard: license confirmed.' : 'LaunchWizard: could not confirm the license right now.');
    } else if (choice === 'Remove From This Machine') {
      await license.remove();
      const next = await vscode.window.showInformationMessage(
        'LaunchWizard: license removed from this machine. Gumroad still counts the seat; ask support to free it if you need it elsewhere.',
        'Request a Seat Reset'
      );
      if (next) await vscode.env.openExternal(vscode.Uri.parse(SUPPORT_URL));
    } else if (choice === 'Request a Seat Reset') {
      await vscode.env.openExternal(vscode.Uri.parse(SUPPORT_URL));
    }
  });

  register('launchwizard.removeLicense', async () => {
    await license.remove();
    void vscode.window.showInformationMessage('LaunchWizard: license removed from this machine.');
  });
  register('launchwizard.buyLicense', () => vscode.env.openExternal(vscode.Uri.parse(PRICING_URL)));
  register('launchwizard.openWebsite', () => vscode.env.openExternal(vscode.Uri.parse(WEBSITE_URL)));
  register('launchwizard.showLog', () => Log.show());

  // --- On save: Pro auto-fix, then a debounced Pro background check (B9) --------------------

  let saveTimer: NodeJS.Timeout | null = null;
  let rerunAfterCurrent = false;
  const scheduleBackgroundCheck = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      if (running) {
        rerunAfterCurrent = true;
        return;
      }
      await runCheck();
      if (rerunAfterCurrent) {
        rerunAfterCurrent = false;
        scheduleBackgroundCheck();
      }
    }, SAVE_CHECK_DEBOUNCE_MS);
  };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (path.basename(document.uri.fsPath) === 'package.json') codeActions.invalidate();
      await heal.onDidSave(document);
      if (license.isPro() && Settings.checkOnSave) scheduleBackgroundCheck();
    }),
    { dispose: () => saveTimer && clearTimeout(saveTimer) }
  );

  tools.refreshPrePushCli();
}

export function deactivate(): void {
  TunnelManager.stopAll();
}
