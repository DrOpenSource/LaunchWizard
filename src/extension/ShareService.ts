import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { TunnelManager, type TunnelOptions } from '../core/TunnelManager.js';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { SecretScanner } from '../core/SecretScanner.js';
import { NamedTunnelSetup } from '../core/NamedTunnelSetup.js';
import { ShareCards } from '../core/ShareCards.js';
import { GitInfo } from '../core/GitInfo.js';
import { QrGenerator } from '../core/QrGenerator.js';
import type { VisitorEntry } from '../core/LinkGuardProxy.js';
import type { LicenseService } from './LicenseService.js';
import { Settings } from './Settings.js';
import { Log } from './Log.js';
import type { PreFlightReport, TunnelInfo, TunnelProvider } from '../shared/types.js';

export type ShareMode = 'standard' | 'private' | 'custom-domain';

const PROVIDER_NAMES: Record<TunnelProvider, string> = {
  cloudflare: 'Cloudflare',
  'localhost.run': 'localhost.run',
  localtunnel: 'localtunnel',
  custom: 'your domain',
};

export function projectRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function projectName(root: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { name?: string };
    if (pkg.name) return pkg.name;
  } catch {
    // No package.json
  }
  return path.basename(root);
}

/** Free links for everyone; private links, link controls, extra ports, custom domains and team cards for Pro. */
export class ShareService implements vscode.Disposable {
  private lastVisitorToast = 0;
  private readonly onTunnelChange = (info: TunnelInfo, reason?: string) => this.handleTunnelChange(info, reason);

  constructor(
    private readonly license: LicenseService,
    private readonly getLatestReport: () => PreFlightReport | null
  ) {
    TunnelManager.events.on('change', this.onTunnelChange);
  }

  private handleTunnelChange(info: TunnelInfo, reason?: string): void {
    if (reason === 'expired') {
      void vscode.window.showInformationMessage(`LaunchWizard: your preview link${info.label ? ` (${info.label})` : ''} expired and is now closed.`);
    } else if (reason === 'visitor' && Date.now() - this.lastVisitorToast > 60000) {
      this.lastVisitorToast = Date.now();
      const latest = TunnelManager.getVisitors(info.id)[0];
      if (latest && latest.device !== 'bot') {
        void vscode.window.showInformationMessage(`👀 Someone opened your preview on a ${latest.device} (${latest.browser}).`);
      }
    } else if (info.status === 'error' && info.error) {
      void vscode.window.showWarningMessage(`LaunchWizard: ${info.error}`, 'Restart Link').then((a) => {
        if (a === 'Restart Link') void vscode.commands.executeCommand('launchwizard.startPreview');
      });
    }
  }

  // --- Starting links ---------------------------------------------------------------

  public async start(mode: ShareMode = 'standard'): Promise<void> {
    if (mode !== 'standard' && !(await this.license.requirePro(mode === 'private' ? 'Password-protected links' : 'Custom subdomains'))) {
      return;
    }

    const root = projectRoot();
    const info = root ? FrameworkDetector.detect(root) : null;
    const port = await this.askPort(info?.defaultPort ?? 3000, info?.displayName);
    if (!port) return;

    const host = await TunnelManager.detectLocalHost(port);
    if (!host) {
      const choice = await vscode.window.showWarningMessage(
        `LaunchWizard: nothing is answering on port ${port}. Start your dev server (e.g. npm run dev) first, or the link will show an error page.`,
        'Launch Anyway',
        'Cancel'
      );
      if (choice !== 'Launch Anyway') return;
    }

    const pro = this.license.isPro();
    if (pro && root && !(await this.secretGuard(root, 'sharing a preview link'))) return;

    const options: TunnelOptions = { port, targetHost: host ?? undefined };
    if (pro) {
      options.guard = { logVisitors: Settings.logVisitors };
      if (Settings.defaultExpiryMinutes > 0) options.expiresInMinutes = Settings.defaultExpiryMinutes;
    }

    if (mode === 'private') {
      const passcode = await vscode.window.showInputBox({
        title: 'LaunchWizard: Private Link Passcode',
        prompt: 'Visitors who open the shared link or QR code get in directly. Anyone else must type this passcode.',
        value: ShareService.generatePasscode(),
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length >= 4 ? null : 'Use at least 4 characters.'),
      });
      if (!passcode) return;
      options.guard = { passcode: passcode.trim(), logVisitors: Settings.logVisitors };
      const expiry = await this.askExpiry();
      if (expiry === undefined) return;
      if (expiry > 0) options.expiresInMinutes = expiry;
    }

    if (mode === 'custom-domain') {
      const named = await this.ensureCustomDomain();
      if (!named) return;
      options.namedTunnel = named;
    }

    await this.launch(options, 'primary');
  }

  /** Pro: share a second local port (e.g. an API server) alongside the main link. */
  public async shareExtraPort(): Promise<void> {
    if (!(await this.license.requirePro('Multi-port sharing'))) return;
    const port = await this.askPort(8000, undefined, 'Which other port should get its own link? (e.g. your API server)');
    if (!port) return;
    const label = await vscode.window.showInputBox({ title: 'LaunchWizard: Name This Link', prompt: 'A short name shown on the team card, e.g. "API"', value: 'API' });
    if (!label) return;
    const host = await TunnelManager.detectLocalHost(port);
    await this.launch({ port, targetHost: host ?? undefined, label, guard: { logVisitors: Settings.logVisitors } }, `port-${port}`);
  }

  private async launch(options: TunnelOptions, id: string): Promise<void> {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `LaunchWizard: creating a link for port ${options.port}`, cancellable: true },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        progress.report({ message: options.namedTunnel ? `connecting ${options.namedTunnel.hostname}…` : 'connecting…' });
        options.signal = controller.signal;
        options.onProviderAttempt = (p) => progress.report({ message: `previous provider didn't answer, trying ${PROVIDER_NAMES[p]}…` });
        options.onStage = (message) => progress.report({ message });

        try {
          const tunnel = id === 'primary' ? await TunnelManager.startTunnel(options) : await TunnelManager.startExtraTunnel(id, options);
          void this.announce(tunnel);
        } catch (err) {
          if (controller.signal.aborted) return;
          const message = err instanceof Error ? err.message : String(err);
          Log.section('Preview link failed');
          Log.line(message);
          const help = TunnelManager.isCloudflaredAvailable()
            ? 'Open Log'
            : 'How to Install Cloudflare';
          const choice = await vscode.window.showErrorMessage(`LaunchWizard could not create a link: ${message}`, help);
          if (choice === 'Open Log') Log.show();
          if (choice === 'How to Install Cloudflare') {
            await vscode.env.openExternal(vscode.Uri.parse('https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'));
          }
        }
      }
    );
  }

  private async announce(tunnel: TunnelInfo): Promise<void> {
    const link = tunnel.shareUrl ?? tunnel.url;
    const extras = [
      tunnel.isProtected ? `🔒 passcode ${tunnel.passcode}` : null,
      tunnel.expiresAt ? `closes at ${new Date(tunnel.expiresAt).toLocaleTimeString()}` : null,
      tunnel.provider === 'localtunnel' ? 'visitors see an IP check page; install cloudflared to avoid it' : null,
      tunnel.dnsPending ? 'may take another minute to open' : null,
    ].filter(Boolean);
    const action = await vscode.window.showInformationMessage(
      `🟢 ${tunnel.label ? `${tunnel.label} link` : 'Live link'} ready: ${tunnel.url}${extras.length ? ` (${extras.join(' · ')})` : ''}`,
      'Copy Link',
      'Open',
      'Show QR',
      ...(this.license.isPro() ? ['Copy Team Card'] : [])
    );
    if (action === 'Copy Link') await vscode.env.clipboard.writeText(link);
    else if (action === 'Open') await vscode.env.openExternal(vscode.Uri.parse(link));
    else if (action === 'Show QR') await vscode.commands.executeCommand('workbench.view.extension.launchwizard-deck');
    else if (action === 'Copy Team Card') await this.copyTeamCard();
  }

  public stop(id = 'primary'): void {
    if (TunnelManager.stopTunnel(id)) {
      void vscode.window.showInformationMessage('🛑 LaunchWizard: link stopped. It no longer works for anyone.');
    }
  }

  // --- Custom domain (Pro) --------------------------------------------------------------

  /** Walks through the one-time Cloudflare setup and returns the named tunnel to run. */
  public async ensureCustomDomain(forceAsk = false): Promise<{ name: string; hostname: string } | null> {
    if (!TunnelManager.isCloudflaredAvailable()) {
      const choice = await vscode.window.showWarningMessage(
        'Custom subdomains need the free cloudflared app. Install it (Windows: winget install Cloudflare.cloudflared · macOS: brew install cloudflared), then try again.',
        'Open Install Guide'
      );
      if (choice) await vscode.env.openExternal(vscode.Uri.parse('https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'));
      return null;
    }

    let hostname = forceAsk ? '' : Settings.customDomainHostname;
    if (!hostname) {
      const entered = await vscode.window.showInputBox({
        title: 'LaunchWizard: Your Preview Subdomain',
        prompt: 'A subdomain of a domain in your free Cloudflare account. LaunchWizard never overwrites existing DNS records.',
        placeHolder: 'preview.example.com',
        ignoreFocusOut: true,
        validateInput: (v) => NamedTunnelSetup.validateHostname(v),
      });
      if (!entered) return null;
      hostname = entered.trim().toLowerCase();
    }
    const name = NamedTunnelSetup.tunnelNameFor(hostname);

    const ok = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'LaunchWizard: setting up your domain', cancellable: true },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        if (!NamedTunnelSetup.isLoggedIn()) {
          progress.report({ message: 'approve your domain in the browser window that just opened…' });
          const login = await NamedTunnelSetup.login(controller.signal);
          if (!login.ok) {
            void vscode.window.showErrorMessage(`LaunchWizard: ${login.message}`);
            return false;
          }
        }
        progress.report({ message: 'creating the tunnel…' });
        const tunnel = await NamedTunnelSetup.ensureTunnel(name, controller.signal);
        if (!tunnel.ok) {
          void vscode.window.showErrorMessage(`LaunchWizard: ${tunnel.message}`);
          return false;
        }
        progress.report({ message: `pointing ${hostname} at it…` });
        const route = await NamedTunnelSetup.routeDns(name, hostname, controller.signal);
        if (!route.ok) {
          void vscode.window.showErrorMessage(`LaunchWizard: ${route.message}`);
          return false;
        }
        return true;
      }
    );
    if (!ok) return null;
    await Settings.setCustomDomainHostname(hostname);
    return { name, hostname };
  }

  // --- Team card & QR (Pro) -------------------------------------------------------------

  public async copyTeamCard(): Promise<void> {
    if (!(await this.license.requirePro('Team preview cards'))) return;
    const primary = TunnelManager.getStatus();
    if (primary.status !== 'active') {
      void vscode.window.showInformationMessage('LaunchWizard: start a preview link first, then copy its team card.');
      return;
    }
    const root = projectRoot() ?? '';
    const extras = TunnelManager.listTunnels()
      .filter((t) => t.id !== 'primary' && t.status === 'active')
      .map((t) => ({ label: t.label ?? `Port ${t.localPort}`, url: t.shareUrl ?? t.url }));
    const input = {
      projectName: projectName(root),
      url: primary.shareUrl ?? primary.url,
      git: root ? GitInfo.snapshot(root) : {},
      report: this.getLatestReport(),
      isProtected: primary.isProtected,
      passcode: primary.passcode,
      expiresAt: primary.expiresAt,
      extraLinks: extras,
    };

    const format = await vscode.window.showQuickPick(
      [
        { label: 'Markdown', description: 'GitHub, Notion, Discord, email', id: 'md' },
        { label: 'Slack', description: 'Slack message formatting', id: 'slack' },
      ],
      { placeHolder: 'Copy the team preview card as…' }
    );
    if (!format) return;
    await vscode.env.clipboard.writeText(format.id === 'md' ? ShareCards.previewCardMarkdown(input) : ShareCards.previewCardSlack(input));
    const next = await vscode.window.showInformationMessage('📋 Team card copied. Add the QR code image too?', 'Save QR Image');
    if (next === 'Save QR Image') await this.saveQrImage();
  }

  public async saveQrImage(): Promise<void> {
    if (!(await this.license.requirePro('QR images for team cards'))) return;
    const primary = TunnelManager.getStatus();
    if (primary.status !== 'active') {
      void vscode.window.showInformationMessage('LaunchWizard: start a preview link first.');
      return;
    }
    const root = projectRoot();
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(root ?? process.cwd(), `${projectName(root ?? 'preview').replace(/[^a-z0-9-]+/gi, '-')}-preview-qr.png`)),
      filters: { 'PNG image': ['png'] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, QrGenerator.generatePng(primary.shareUrl ?? primary.url, 10));
    void vscode.window.showInformationMessage(`LaunchWizard: QR code saved to ${path.basename(target.fsPath)}.`);
  }

  public async showVisitors(): Promise<void> {
    if (!(await this.license.requirePro('Visitor log'))) return;
    const visitors = TunnelManager.listTunnels().flatMap((t) => TunnelManager.getVisitors(t.id).map((v) => ({ v, label: t.label })));
    if (visitors.length === 0) {
      void vscode.window.showInformationMessage('LaunchWizard: nobody has opened your link yet.');
      return;
    }
    await vscode.window.showQuickPick(
      visitors.map(({ v, label }) => ({ label: ShareService.describeVisitor(v), description: label })),
      { placeHolder: `${visitors.length} visit(s), newest first` }
    );
  }

  public static describeVisitor(v: VisitorEntry): string {
    const icon = { phone: '📱', tablet: '📲', desktop: '💻', bot: '🤖', unknown: '❔' }[v.device];
    const minutes = Math.round((Date.now() - v.at) / 60000);
    const ago = minutes < 1 ? 'just now' : `${minutes} min ago`;
    return `${icon} ${v.device} · ${v.browser} · ${v.path} · ${ago} · ${ShareService.maskIp(v.ip)}`;
  }

  public static maskIp(ip: string): string {
    if (ip.includes('.')) return ip.split('.').slice(0, 3).join('.') + '.x';
    if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':…';
    return ip;
  }

  public static generatePasscode(): string {
    const n = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
    return `${n.slice(0, 4)}-${n.slice(4)}`;
  }

  // --- Helpers --------------------------------------------------------------------------

  private async askPort(defaultPort: number, framework?: string, prompt?: string): Promise<number | null> {
    const input = await vscode.window.showInputBox({
      title: 'LaunchWizard: Share a Local Port',
      prompt: prompt ?? `Which port is your dev server on?${framework ? ` (${framework} usually uses ${defaultPort})` : ''}`,
      value: String(defaultPort),
      validateInput: (v) => {
        const n = Number.parseInt(v, 10);
        return Number.isInteger(n) && n > 0 && n <= 65535 && String(n) === v.trim() ? null : 'Enter a port number between 1 and 65535.';
      },
    });
    return input ? Number.parseInt(input, 10) : null;
  }

  private async askExpiry(): Promise<number | undefined> {
    const pick = await vscode.window.showQuickPick(
      [
        { label: '30 minutes', minutes: 30 },
        { label: '1 hour', minutes: 60 },
        { label: '2 hours', minutes: 120 },
        { label: 'Until I stop it', minutes: 0 },
      ],
      { placeHolder: 'Close the link automatically after…' }
    );
    return pick?.minutes;
  }

  /**
   * Pro "Secret Leak Guard": returns false when the user cancels after hard-coded secrets were found.
   */
  public async secretGuard(root: string, action: string): Promise<boolean> {
    if (!Settings.secretGuard) return true;
    const findings = SecretScanner.scanProject(root).filter((f) => f.severity === 'error');
    if (findings.length === 0) return true;

    Log.section(`Secret Leak Guard: ${findings.length} finding(s) before ${action}`);
    for (const f of findings) Log.line(`${f.file}:${f.line}  ${f.label} (${f.preview})  ${f.inBuildOutput ? '[in build output]' : ''}`);
    const choice = await vscode.window.showWarningMessage(
      `🔐 LaunchWizard found ${findings.length} possible secret${findings.length > 1 ? 's' : ''} (${[...new Set(findings.map((f) => f.label))].slice(0, 3).join(', ')}) before ${action}.`,
      { modal: true, detail: 'Hard-coded keys can be seen by anyone who opens your app. Remove them from the code and rotate them in the provider\'s dashboard.' },
      'Show Details',
      'Continue Anyway'
    );
    if (choice === 'Show Details') {
      await vscode.commands.executeCommand('launchwizard.scanSecrets');
      return false;
    }
    return choice === 'Continue Anyway';
  }

  public dispose(): void {
    TunnelManager.events.off('change', this.onTunnelChange);
  }
}
