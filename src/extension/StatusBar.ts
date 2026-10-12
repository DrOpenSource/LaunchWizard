import * as vscode from 'vscode';
import { TunnelManager } from '../core/TunnelManager.js';
import type { PreFlightReport } from '../shared/types.js';

export class StatusBarController {
  private statusBarItem: vscode.StatusBarItem;
  private currentReport: PreFlightReport | null = null;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'launchwizard.openMenu';
    this.setReadyState();
    this.statusBarItem.show();
  }

  public setReadyState(): void {
    const tunnel = TunnelManager.getStatus();
    if (tunnel.status === 'active') {
      this.statusBarItem.text = `$(globe) Launch: Live (${tunnel.localPort})`;
      this.statusBarItem.tooltip = `LaunchWizard: Tunnel active at ${tunnel.url}. Click to copy or inspect.`;
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(rocket) Launch: Ready';
      this.statusBarItem.tooltip = 'LaunchWizard: Pre-flight engine ready. Click for quick ship actions.';
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  public setCheckingState(): void {
    this.statusBarItem.text = '$(sync~spin) Launch: Checking Build...';
    this.statusBarItem.tooltip = 'LaunchWizard: Inspecting TypeScript and production bundle sanity...';
    this.statusBarItem.backgroundColor = undefined;
  }

  public updateReport(report: PreFlightReport): void {
    this.currentReport = report;
    const tunnel = TunnelManager.getStatus();

    if (!report.passed) {
      const errCount = report.errors.length;
      this.statusBarItem.text = `$(error) Launch: ${errCount} Blocker${errCount > 1 ? 's' : ''}`;
      this.statusBarItem.tooltip = `LaunchWizard: ${errCount} build blockers detected. Click to auto-heal.`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else if (tunnel.status === 'active') {
      this.statusBarItem.text = `$(globe) Launch: Live (${tunnel.localPort})`;
      this.statusBarItem.tooltip = `LaunchWizard: Clean build! Tunnel active at ${tunnel.url}`;
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(check) Launch: Build Passed';
      this.statusBarItem.tooltip = 'LaunchWizard: All production build pre-flight checks passed!';
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  public updateTunnelState(): void {
    if (this.currentReport && !this.currentReport.passed) {
      this.updateReport(this.currentReport);
    } else {
      this.setReadyState();
    }
  }

  public async showQuickMenu(): Promise<void> {
    const tunnel = TunnelManager.getStatus();
    const items: vscode.QuickPickItem[] = [
      {
        label: '$(search) Run Pre-Flight Build Check',
        description: 'Verify TypeScript and bundle builds before pushing',
      },
    ];

    if (tunnel.status === 'active') {
      items.push(
        {
          label: '$(copy) Copy Live Tunnel Link',
          description: tunnel.url,
        },
        {
          label: '$(device-mobile) Show Mobile QR Code',
          description: 'Scan with your phone to test the live app',
        },
        {
          label: '$(circle-slash) Stop Active Tunnel',
          description: `Close tunnel on port ${tunnel.localPort}`,
        }
      );
    } else {
      items.push({
        label: '$(globe) 1-Click Get Live Shareable Link',
        description: 'Instant Cloudflare Quick Tunnel (Free, no account needed)',
      });
    }

    if (this.currentReport && this.currentReport.errors.length > 0) {
      items.push({
        label: '$(wand) Auto-Heal All Build Blockers',
        description: `Apply safe 1-click fixes for ${this.currentReport.errors.length} issue(s)`,
      });
    }

    items.push({
      label: '$(layout-sidebar-left) Open Pre-Flight Deck',
      description: 'View full visual dashboard in sidebar',
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'LaunchWizard — The "Get It Live" Pre-Flight Engine',
    });

    if (!selected) return;

    if (selected.label.includes('Run Pre-Flight')) {
      await vscode.commands.executeCommand('launchwizard.runPreFlight');
    } else if (selected.label.includes('Copy Live Tunnel Link')) {
      await vscode.env.clipboard.writeText(tunnel.url);
      vscode.window.showInformationMessage(`📋 Copied live tunnel URL: ${tunnel.url}`);
    } else if (selected.label.includes('Show Mobile QR')) {
      await vscode.commands.executeCommand('launchwizard.showMobileQr');
    } else if (selected.label.includes('Stop Active Tunnel')) {
      await vscode.commands.executeCommand('launchwizard.stopTunnel');
    } else if (selected.label.includes('Get Live Shareable Link')) {
      await vscode.commands.executeCommand('launchwizard.startTunnel');
    } else if (selected.label.includes('Auto-Heal All')) {
      await vscode.commands.executeCommand('launchwizard.autoHealAll');
    } else if (selected.label.includes('Open Pre-Flight Deck')) {
      await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
