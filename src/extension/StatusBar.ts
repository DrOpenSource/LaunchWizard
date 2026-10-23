import * as vscode from 'vscode';
import { TunnelManager } from '../core/TunnelManager.js';
import type { AppState } from './AppState.js';

/**
 * Status bar "radar": build state plus live-link state. Updates itself from tunnel events (B10),
 * so a link that closes unexpectedly never keeps showing as live.
 */
export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly onTunnel = () => this.render();
  private readonly subscription: vscode.Disposable;

  constructor(private readonly state: AppState) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'launchwizard.openMenu';
    TunnelManager.events.on('change', this.onTunnel);
    this.subscription = state.onDidChange(() => this.render());
    this.render();
    this.item.show();
  }

  public render(): void {
    const tunnels = TunnelManager.listTunnels();
    const live = tunnels.filter((t) => t.status === 'active');
    const starting = tunnels.some((t) => t.status === 'starting');
    const report = this.state.report;

    if (this.state.checking) {
      this.item.text = '$(sync~spin) Launch: Checking…';
      this.item.tooltip = 'LaunchWizard is checking your project';
      this.item.backgroundColor = undefined;
      return;
    }

    if (report && !report.passed) {
      const n = report.errors.length;
      this.item.text = `$(error) Launch: ${n} Blocker${n > 1 ? 's' : ''}${live.length ? ` · $(globe) ${live.length}` : ''}`;
      this.item.tooltip = `LaunchWizard: ${n} build blocker${n > 1 ? 's' : ''}. Click for actions.`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    this.item.backgroundColor = undefined;
    if (starting) {
      this.item.text = '$(sync~spin) Launch: Connecting…';
      this.item.tooltip = 'LaunchWizard is creating your preview link';
    } else if (live.length > 0) {
      const primary = live.find((t) => t.id === 'primary') ?? live[0];
      this.item.text = `$(globe) Launch: Live (${primary.localPort})${live.length > 1 ? ` +${live.length - 1}` : ''}${primary.isProtected ? ' $(lock)' : ''}`;
      this.item.tooltip = `LaunchWizard: live at ${primary.url}. Click to copy or stop.`;
    } else if (report?.passed) {
      this.item.text = '$(check) Launch: Build Passed';
      this.item.tooltip = 'LaunchWizard: all pre-flight checks passed';
    } else {
      this.item.text = '$(rocket) Launch: Ready';
      this.item.tooltip = 'LaunchWizard: click for quick actions';
    }
  }

  public async showQuickMenu(isPro: boolean): Promise<void> {
    const primary = TunnelManager.getStatus();
    const pro = (label: string) => (isPro ? label : `${label}  ·  Pro`);
    const items: Array<vscode.QuickPickItem & { command?: string; args?: unknown[] }> = [
      { label: '$(search) Run Pre-Flight Check', description: 'type check + env + file traps', command: 'launchwizard.runPreFlight' },
      { label: '$(tools) Run Full Production Build Check', description: 'your real build command', command: 'launchwizard.runBuildCheck' },
    ];

    if (this.state.allFindings().some((f) => f.healerId)) {
      items.push({ label: '$(wand) Fix All (with preview)', command: 'launchwizard.autoHealAll' });
    }

    items.push({ label: 'Share', kind: vscode.QuickPickItemKind.Separator });
    if (primary.status === 'active') {
      items.push(
        { label: '$(copy) Copy Live Link', description: primary.url, command: 'launchwizard.copyLink' },
        { label: '$(device-mobile) Show Phone QR Code', command: 'launchwizard.showMobileQr' },
        { label: pro('$(note) Copy Team Preview Card'), command: 'launchwizard.copyPreviewCard' },
        { label: pro('$(add) Share Another Port'), command: 'launchwizard.shareExtraPort' },
        { label: '$(circle-slash) Stop Link', description: `port ${primary.localPort}`, command: 'launchwizard.stopPreview' }
      );
    } else {
      items.push(
        { label: '$(globe) Get Shareable Link', description: 'free, no account', command: 'launchwizard.startPreview' },
        { label: pro('$(lock) Get Private Link (passcode)'), command: 'launchwizard.startPrivatePreview' },
        { label: pro('$(link) Share on My Domain'), command: 'launchwizard.startCustomDomainPreview' }
      );
    }

    items.push(
      { label: 'Ship Safe', kind: vscode.QuickPickItemKind.Separator },
      { label: pro('$(shield) Scan for Leaked Secrets'), command: 'launchwizard.scanSecrets' },
      { label: pro('$(git-commit) Turn Pre-Push Gate On/Off'), command: 'launchwizard.togglePrePushGate' },
      { label: pro('$(package) Check Dependency Health'), command: 'launchwizard.checkDependencies' },
      { label: pro('$(rocket) Deploy (Vercel / Cloudflare Pages)'), command: 'launchwizard.deploy' },
      { label: '$(layout-sidebar-left) Open LaunchWizard Sidebar', command: 'workbench.view.extension.launchwizard-deck' }
    );

    const selected = await vscode.window.showQuickPick(items, { placeHolder: 'LaunchWizard: get it live' });
    if (selected?.command) {
      await vscode.commands.executeCommand(selected.command, ...(selected.args ?? []));
    }
  }

  public dispose(): void {
    TunnelManager.events.off('change', this.onTunnel);
    this.subscription.dispose();
    this.item.dispose();
  }
}
