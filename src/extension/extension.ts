import * as vscode from 'vscode';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { PreFlightEngine } from '../core/PreFlightEngine.js';
import { AutoHealer } from '../core/AutoHealer.js';
import { TunnelManager } from '../core/TunnelManager.js';
import { LicenseManager } from '../core/LicenseManager.js';
import { StatusBarController } from './StatusBar.js';
import { PreFlightDeckViewProvider } from './PreFlightDeckView.js';
import { LaunchWizardCodeActionProvider } from './CodeActions.js';

let statusBar: StatusBarController | null = null;
let deckProvider: PreFlightDeckViewProvider | null = null;
let licenseManager: LicenseManager | null = null;

export function activate(context: vscode.ExtensionContext): void {
  // 1. Initialize core services
  // Fall back to the pre-rename key so licenses activated before the rebrand stay valid.
  const storedLicense =
    context.globalState.get<string>('launchwizard.licenseKey') ??
    context.globalState.get<string>('shipwizard.licenseKey');
  licenseManager = new LicenseManager(storedLicense);

  statusBar = new StatusBarController();
  deckProvider = new PreFlightDeckViewProvider(context.extensionUri, licenseManager);

  // 2. Register Webview View
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PreFlightDeckViewProvider.viewType,
      deckProvider
    )
  );

  // 3. Register Code Action Provider for Quick-Fix lightbulbs
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
      ],
      new LaunchWizardCodeActionProvider(),
      {
        providedCodeActionKinds: LaunchWizardCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  // 4. Command: Open Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.openMenu', async () => {
      await statusBar?.showQuickMenu();
    })
  );

  // 5. Command: Run Pre-Flight
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.runPreFlight', async () => {
      statusBar?.setCheckingState();
      const report = await deckProvider?.runPreFlightCheck();
      if (report) {
        statusBar?.updateReport(report);
        if (report.passed) {
          vscode.window.showInformationMessage(
            `🚀 LaunchWizard: All pre-flight checks passed! Your ${report.frameworkName} project is ready to ship.`
          );
        } else {
          const action = await vscode.window.showWarningMessage(
            `🚨 LaunchWizard: Found ${report.errors.length} build blocker(s).`,
            '1-Click Auto-Heal',
            'View Deck'
          );
          if (action === '1-Click Auto-Heal') {
            await vscode.commands.executeCommand('launchwizard.autoHealAll');
          } else if (action === 'View Deck') {
            await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
          }
        }
      } else {
        statusBar?.setReadyState();
        vscode.window.showInformationMessage('LaunchWizard: Please open a project folder to run pre-flight checks.');
      }
    })
  );

  // 6. Command: Start Preview / Tunnel
  const handleStartPreview = async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectRoot = workspaceFolders?.[0]?.uri.fsPath;
    const frameworkInfo = projectRoot ? FrameworkDetector.detect(projectRoot) : null;
    const defaultPort = frameworkInfo?.defaultPort ?? 3000;

    const inputPort = await vscode.window.showInputBox({
      title: 'LaunchWizard: Launch Instant Shareable Link',
      prompt: `Enter local dev server port (detected ${frameworkInfo?.displayName ?? 'default'}: ${defaultPort})`,
      value: String(defaultPort),
    });

    if (!inputPort) return;
    const port = Number.parseInt(inputPort, 10);
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      vscode.window.showErrorMessage(`LaunchWizard: Invalid port number "${inputPort}".`);
      return;
    }

    // In-flight health ping: verify local dev server is responding before launching tunnel
    const isReachable = await TunnelManager.checkLocalPortReachable(port);
    if (!isReachable) {
      const choice = await vscode.window.showWarningMessage(
        `LaunchWizard: No active dev server was detected on port ${port}. Please make sure your dev server (e.g. npm run dev) is running.`,
        'Launch Anyway',
        'Cancel'
      );
      if (choice !== 'Launch Anyway') {
        return;
      }
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `LaunchWizard: Launching live preview link on port ${port}...`,
        cancellable: false,
      },
      async () => {
        try {
          const tunnel = await TunnelManager.startTunnel({ port });
          statusBar?.updateTunnelState();
          await deckProvider?.syncDeckState();

          const action = await vscode.window.showInformationMessage(
            `🟢 Live test link is ready: ${tunnel.url}`,
            'Copy URL',
            'Open Browser',
            'Show Mobile QR'
          );

          if (action === 'Copy URL') {
            await vscode.env.clipboard.writeText(tunnel.url);
          } else if (action === 'Open Browser') {
            await vscode.env.openExternal(vscode.Uri.parse(tunnel.url));
          } else if (action === 'Show Mobile QR') {
            await vscode.commands.executeCommand('launchwizard.showMobileQr');
          }
        } catch (err) {
          statusBar?.updateTunnelState();
          await deckProvider?.syncDeckState();
          vscode.window.showErrorMessage(
            `LaunchWizard Preview Error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.startPreview', handleStartPreview),
    vscode.commands.registerCommand('launchwizard.startTunnel', handleStartPreview)
  );

  // 7. Command: Stop Preview / Tunnel
  const handleStopPreview = () => {
    const stopped = TunnelManager.stopTunnel();
    statusBar?.updateTunnelState();
    deckProvider?.syncDeckState();
    if (stopped) {
      vscode.window.showInformationMessage('🛑 LaunchWizard: Live preview link stopped.');
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.stopPreview', handleStopPreview),
    vscode.commands.registerCommand('launchwizard.stopTunnel', handleStopPreview)
  );

  // 8. Command: Auto-Heal All Blockers
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.autoHealAll', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      const projectRoot = workspaceFolders[0].uri.fsPath;

      const report = await PreFlightEngine.run({ projectRoot });
      if (report.errors.length === 0) {
        vscode.window.showInformationMessage('LaunchWizard: No build blockers detected to heal.');
        return;
      }

      const patches = AutoHealer.generatePatches(projectRoot, report.errors);
      if (patches.length === 0) {
        vscode.window.showInformationMessage('LaunchWizard: No automated patch rules matched current errors.');
        return;
      }

      const result = AutoHealer.applyPatches(patches);
      if (result.success) {
        vscode.window.showInformationMessage(
          `🪄 LaunchWizard: Successfully healed ${result.healedCount} issue(s)! Re-running pre-flight check...`
        );
        await deckProvider?.runPreFlightCheck();
        statusBar?.updateTunnelState();
      } else {
        vscode.window.showErrorMessage(
          `LaunchWizard: Failed to apply some patches: ${result.errors.join(', ')}`
        );
      }
    })
  );

  // 9. Command: Show Mobile QR
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.showMobileQr', async () => {
      const tunnel = TunnelManager.getStatus();
      if (tunnel.status !== 'active') {
        const launch = await vscode.window.showInformationMessage(
          'No active live preview running. Would you like to launch one now?',
          'Launch Preview'
        );
        if (launch === 'Launch Preview') {
          await vscode.commands.executeCommand('launchwizard.startPreview');
        }
        return;
      }

      await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
    })
  );

  // 10. Command: Activate Pro License
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.activateLicense', async () => {
      const key = await vscode.window.showInputBox({
        title: 'Activate LaunchWizard Pro Lifetime',
        prompt: 'Enter your Pro License Key (or SHIP-PRO-XXXX-XXXX)',
        ignoreFocusOut: true,
      });

      if (!key) return;

      const result = await licenseManager?.activateLicense(key);
      if (result?.success) {
        await context.globalState.update('launchwizard.licenseKey', key);
        vscode.window.showInformationMessage(result.message);
        await deckProvider?.syncDeckState();
      } else {
        vscode.window.showErrorMessage(result?.message ?? 'Activation failed.');
      }
    })
  );

  // 11. Command: Buy Pro License
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.buyLicense', async () => {
      await vscode.env.openExternal(vscode.Uri.parse('https://launchwizard.taqnik.in'));
    })
  );

  // 12. Command: Open Website
  context.subscriptions.push(
    vscode.commands.registerCommand('launchwizard.openWebsite', async () => {
      await vscode.env.openExternal(vscode.Uri.parse('https://launchwizard.taqnik.in'));
    })
  );

  // Auto-check on save if user has workspace open
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async () => {
      const status = licenseManager?.getStatus();
      if (status?.isActivated) {
        // Pro users get passive background check on save
        const report = await deckProvider?.runPreFlightCheck();
        if (report) {
          statusBar?.updateReport(report);
        }
      }
    })
  );
}

export function deactivate(): void {
  statusBar?.dispose();
  TunnelManager.stopTunnel();
}
