import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { TunnelManager } from '../core/TunnelManager.js';
import type { AppState } from './AppState.js';
import type { DeployService } from './DeployService.js';
import type { HealService } from './HealService.js';
import type { LicenseService } from './LicenseService.js';
import { ShareService, projectRoot } from './ShareService.js';
import type { ToolsService } from './ToolsService.js';

/** Messages the webview may send. Anything else is ignored. */
const COMMANDS: Record<string, string> = {
  runPreFlight: 'launchwizard.runPreFlight',
  runBuildCheck: 'launchwizard.runBuildCheck',
  healAll: 'launchwizard.autoHealAll',
  undoHeal: 'launchwizard.undoLastHeal',
  startTunnel: 'launchwizard.startPreview',
  startPrivate: 'launchwizard.startPrivatePreview',
  startCustom: 'launchwizard.startCustomDomainPreview',
  shareExtra: 'launchwizard.shareExtraPort',
  copyCard: 'launchwizard.copyPreviewCard',
  saveQr: 'launchwizard.saveQrImage',
  visitors: 'launchwizard.showVisitors',
  scanSecrets: 'launchwizard.scanSecrets',
  prePush: 'launchwizard.togglePrePushGate',
  deps: 'launchwizard.checkDependencies',
  bundle: 'launchwizard.checkBundleSize',
  exportReport: 'launchwizard.exportReport',
  deploy: 'launchwizard.deploy',
  activateLicense: 'launchwizard.activateLicense',
  buyLicense: 'launchwizard.buyLicense',
  licenseStatus: 'launchwizard.licenseStatus',
  openLog: 'launchwizard.showLog',
};

export class PreFlightDeckViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'launchwizard.preFlightDeck';
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onTunnel = () => this.syncDeckState();
  private uptimeTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly state: AppState,
    private readonly license: LicenseService,
    private readonly heal: HealService,
    private readonly tools: ToolsService,
    private readonly deploys: DeployService
  ) {
    this.disposables.push(
      state.onDidChange(() => this.syncDeckState()),
      license.onDidChange(() => this.syncDeckState()),
      heal.onDidChangeCheckpoint(() => this.syncDeckState()),
      deploys.onDidChange(() => this.syncDeckState())
    );
    TunnelManager.events.on('change', this.onTunnel);
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewView.webview.html = this.getHtmlForWebview(crypto.randomBytes(16).toString('base64'));

    webviewView.webview.onDidReceiveMessage(async (message: { type?: string; url?: string; file?: string; line?: number; index?: number; id?: string }) => {
      const type = message.type ?? '';
      if (type === 'ready') {
        await this.syncDeckState();
      } else if (type === 'copyUrl' && typeof message.url === 'string' && /^https:\/\//.test(message.url)) {
        await vscode.env.clipboard.writeText(message.url);
        void vscode.window.showInformationMessage('📋 Link copied.');
      } else if (type === 'openFile' && typeof message.file === 'string') {
        await vscode.commands.executeCommand('launchwizard.openFinding', message.file, Number(message.line) || 1);
      } else if (type === 'fixOne' && typeof message.index === 'number') {
        await vscode.commands.executeCommand('launchwizard.fixFinding', message.index);
      } else if (type === 'stopTunnel') {
        await vscode.commands.executeCommand('launchwizard.stopPreview', typeof message.id === 'string' ? message.id : 'primary');
      } else if (COMMANDS[type]) {
        await vscode.commands.executeCommand(COMMANDS[type]);
      }
    });

    // Keep "live for 3 min" and expiry countdowns fresh while a link is active.
    this.uptimeTimer = setInterval(() => {
      if (this.view?.visible && TunnelManager.listTunnels().some((t) => t.status === 'active')) {
        void this.syncDeckState();
      }
    }, 30000);
    webviewView.onDidDispose(() => {
      if (this.uptimeTimer) clearInterval(this.uptimeTimer);
      this.view = undefined;
    });
  }

  public async syncDeckState(): Promise<void> {
    if (!this.view) return;
    const root = projectRoot();
    const framework = root ? FrameworkDetector.detect(root) : null;
    const tunnels = TunnelManager.listTunnels();
    const visitors = tunnels
      .flatMap((t) => TunnelManager.getVisitors(t.id))
      .sort((a, b) => b.at - a.at)
      .slice(0, 6)
      .map((v) => ShareService.describeVisitor(v));

    await this.view.webview.postMessage({
      type: 'stateUpdate',
      framework: framework?.displayName ?? 'No folder open',
      checking: this.state.checking,
      report: this.state.report,
      errors: this.state.translated,
      warnings: this.state.translatedWarnings,
      results: this.state.results,
      tunnels,
      visitors,
      license: this.license.status(),
      canUndo: this.heal.canUndo(),
      prePush: this.tools.prePushStatus(),
      accounts: this.deploys.accounts(),
      now: Date.now(),
    });
  }

  public dispose(): void {
    TunnelManager.events.off('change', this.onTunnel);
    if (this.uptimeTimer) clearInterval(this.uptimeTimer);
    for (const d of this.disposables) d.dispose();
  }

  private getHtmlForWebview(nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaunchWizard</title>
  <style nonce="${nonce}">
    :root {
      --bg: var(--vscode-sideBar-background);
      --card-bg: var(--vscode-editor-background);
      --border: var(--vscode-widget-border, rgba(127, 127, 127, 0.18));
      --text: var(--vscode-foreground);
      --text-muted: var(--vscode-descriptionForeground, #8e8e93);
      --accent: var(--vscode-button-background, #0a6fe0);
      --accent-text: var(--vscode-button-foreground, #ffffff);
      --accent-hover: var(--vscode-button-hoverBackground, #1f7ff0);
      --subtle: rgba(127, 127, 127, 0.12);
      --subtle-hover: rgba(127, 127, 127, 0.2);
      --green: var(--vscode-testing-iconPassed, #32d74b);
      --red: var(--vscode-errorForeground, #ff453a);
      --warn: var(--vscode-editorWarning-foreground, #ffa626);
      --font: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px; line-height: 1.45; padding: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .brand { font-weight: 700; font-size: 14px; }
    .pills { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
    .pill { font-size: 10px; padding: 2px 7px; border-radius: 999px; background: var(--subtle); color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; white-space: nowrap; }
    .pill.pro { color: var(--green); }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
    .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .row { display: flex; gap: 6px; margin-top: 6px; }
    .row > .btn { flex: 1; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: var(--accent); color: var(--accent-text); border: none; border-radius: 6px; padding: 7px 10px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; width: 100%; }
    .btn:hover { background: var(--accent-hover); }
    .btn:focus-visible, .link:focus-visible { outline: 1px solid var(--vscode-focusBorder, var(--accent)); outline-offset: 1px; }
    .btn-secondary { background: var(--subtle); color: var(--text); }
    .btn-secondary:hover { background: var(--subtle-hover); }
    .btn-danger { background: transparent; color: var(--red); border: 1px solid var(--red); }
    .btn-small { width: auto; padding: 3px 8px; font-size: 11px; }
    .tag { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: var(--subtle); color: var(--text-muted); }
    .banner { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 8px; margin-bottom: 8px; font-weight: 600; border: 1px solid var(--border); background: var(--subtle); }
    .banner.pass { color: var(--green); border-color: var(--green); }
    .banner.fail { color: var(--red); border-color: var(--red); }
    .issue { border: 1px solid var(--border); border-left: 3px solid var(--red); border-radius: 6px; padding: 8px 9px; margin-top: 8px; }
    .issue.warn { border-left-color: var(--warn); }
    .issue-badge { font-size: 11px; font-weight: 700; color: var(--red); }
    .issue.warn .issue-badge { color: var(--warn); }
    .issue-title { font-weight: 600; font-size: 12px; margin: 2px 0; }
    .muted { font-size: 11px; color: var(--text-muted); }
    .issue-msg { font-size: 11px; margin: 3px 0; word-break: break-word; }
    .issue-do { font-size: 11px; margin-top: 4px; }
    .issue-foot { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-top: 6px; }
    .link { background: none; border: none; color: var(--vscode-textLink-foreground, var(--accent)); font: inherit; font-size: 11px; cursor: pointer; padding: 0; text-align: left; word-break: break-all; }
    .link:hover { text-decoration: underline; }
    details { margin-top: 8px; }
    summary { cursor: pointer; font-size: 11px; color: var(--text-muted); }
    .tunnel { border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; }
    .tunnel:first-child { border-top: none; padding-top: 0; margin-top: 0; }
    .url { word-break: break-all; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; background: var(--subtle); padding: 6px 8px; border-radius: 5px; margin: 6px 0; }
    .qr { display: flex; justify-content: center; margin: 8px 0; }
    .qr svg { width: 200px; max-width: 100%; height: auto; border-radius: 8px; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; color: var(--text-muted); }
    .tool { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); }
    .tool:first-of-type { border-top: none; }
    .tool-text { min-width: 0; }
    .tool-name { font-weight: 600; font-size: 12px; }
    .ok { color: var(--green); }
    .bad { color: var(--red); }
    .warn-text { color: var(--warn); }
    ul.plain { list-style: none; margin-top: 6px; }
    ul.plain li { font-size: 11px; color: var(--text-muted); padding: 2px 0; }
    .mt8 { margin-top: 8px; }
    .mb6 { margin-bottom: 6px; }
    .footer { margin-top: 12px; font-size: 11px; color: var(--text-muted); text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">🚀 LaunchWizard</div>
    <div class="pills"><span id="framework" class="pill">Scanning…</span><span id="tier" class="pill">Free</span></div>
  </div>
  <div id="app"><p class="muted">Loading…</p></div>
  <div class="footer">Part of the Calm Dev Suite · <button class="link" data-action="openLog">Show log</button></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ago = (t, now) => { const m = Math.round((now - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ago'; };
    const left = (t, now) => { const m = Math.max(0, Math.round((t - now) / 60000)); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
    let pro = false;
    const proTag = () => (pro ? '' : ' <span class="tag">PRO</span>');
    const btn = (action, label, cls = 'btn-secondary', extra = '') => '<button class="btn ' + cls + '" data-action="' + action + '"' + extra + '>' + label + '</button>';

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const d = el.dataset;
      const msg = { type: d.action };
      if (d.url) msg.url = d.url;
      if (d.file) { msg.file = d.file; msg.line = Number(d.line); }
      if (d.index) msg.index = Number(d.index);
      if (d.id) msg.id = d.id;
      vscode.postMessage(msg);
    });
    window.addEventListener('message', (event) => { if (event.data && event.data.type === 'stateUpdate') render(event.data); });
    vscode.postMessage({ type: 'ready' });

    function issueCard(card, index, isWarning) {
      const o = card.original;
      return '<div class="issue' + (isWarning ? ' warn' : '') + '">' +
        '<div class="issue-badge">' + esc(card.badge) + '</div>' +
        '<div class="issue-title">' + esc(card.friendlyTitle) + '</div>' +
        '<div class="issue-msg">' + esc(o.rawMessage) + '</div>' +
        '<div class="muted">' + esc(card.whyItBreaks) + '</div>' +
        '<div class="issue-do">👉 ' + esc(card.actionPrompt) + '</div>' +
        '<div class="issue-foot"><button class="link" data-action="openFile" data-file="' + esc(o.file) + '" data-line="' + esc(o.line) + '">' + esc(o.file) + ':' + esc(o.line) + '</button>' +
        (card.autoFixAvailable && index >= 0 ? '<button class="btn btn-small" data-action="fixOne" data-index="' + index + '">🪄 Fix</button>' : '') +
        '</div></div>';
    }

    function preflight(s) {
      let banner;
      if (s.checking) banner = '<div class="banner">⏳ Checking your project…</div>';
      else if (!s.report) banner = '<div class="banner">🔍 Not checked yet</div>';
      else if (s.report.passed) banner = '<div class="banner pass">✅ Ready to ship · 0 blockers</div>';
      else banner = '<div class="banner fail">🚨 ' + s.report.errors.length + ' build blocker' + (s.report.errors.length > 1 ? 's' : '') + '</div>';

      let html = '<div class="card"><div class="card-title"><span>Pre-flight check</span>' +
        (s.report ? '<span>' + esc(ago(s.report.timestamp, s.now)) + ' · ' + (s.report.durationMs / 1000).toFixed(1) + ' s</span>' : '') + '</div>' + banner +
        '<div class="row">' + btn('runPreFlight', '⚡ Check', 'btn') + btn('runBuildCheck', '🏗️ Full build') + '</div>';

      s.errors.forEach((c, i) => { html += issueCard(c, i, false); });

      const build = s.results.build;
      if (build) {
        html += '<div class="tool mt8"><div class="tool-text"><div class="tool-name">Production build</div><div class="muted ' + (build.success ? 'ok' : 'bad') + '">' + esc(build.message) + ' · ' + esc(ago(build.at, s.now)) + '</div></div></div>';
        build.cards.forEach((c) => { html += issueCard(c, -1, false); });
      }
      if (s.warnings.length) {
        html += '<details><summary>' + s.warnings.length + ' advisory warning' + (s.warnings.length > 1 ? 's' : '') + '</summary>';
        s.warnings.forEach((c, i) => { html += issueCard(c, s.errors.length + i, true); });
        html += '</details>';
      }
      const fixable = s.errors.concat(s.warnings).some((c) => c.autoFixAvailable);
      if (fixable || s.canUndo) {
        html += '<div class="row">' + (fixable ? btn('healAll', '🪄 Fix all (preview first)', 'btn') : '') + (s.canUndo ? btn('undoHeal', '↩️ Undo last fix') : '') + '</div>';
      }
      if (s.report && pro) html += '<div class="row">' + btn('exportReport', '📄 Export report') + '</div>';
      return html + '</div>';
    }

    function share(s) {
      let html = '<div class="card"><div class="card-title"><span>Share a live link</span><span class="pill">Free</span></div>';
      const tunnels = s.tunnels;
      if (tunnels.length) {
        tunnels.forEach((t) => {
          const name = t.label ? esc(t.label) : 'Main link';
          html += '<div class="tunnel">';
          if (t.status === 'starting') {
            html += '<div class="banner">⏳ ' + name + ': connecting on port ' + esc(t.localPort) + '…</div>';
          } else if (t.status === 'error') {
            html += '<div class="banner fail">⚠️ ' + name + ': ' + esc(t.error || 'closed') + '</div>' + btn('startTunnel', 'Restart link', 'btn');
          } else {
            const link = t.shareUrl || t.url;
            html += '<div class="banner pass">🟢 ' + name + ' · port ' + esc(t.localPort) + (t.isProtected ? ' · 🔒' : '') + '</div>' +
              '<div class="url">' + esc(t.url) + '</div>' +
              '<div class="meta"><span>via ' + esc(t.provider) + '</span><span>live ' + esc(ago(t.startedAt, s.now)).replace(' ago', '') + '</span>' +
              (t.expiresAt ? '<span>closes in ' + esc(left(t.expiresAt, s.now)) + '</span>' : '') +
              (t.passcode ? '<span>passcode <b>' + esc(t.passcode) + '</b></span>' : '') +
              (typeof t.visitorCount === 'number' ? '<span>' + esc(t.visitorCount) + ' visit' + (t.visitorCount === 1 ? '' : 's') + '</span>' : '') + '</div>' +
              (t.id === 'primary' ? '<div class="qr">' + t.qrCodeSvg + '</div>' : '') +
              (t.provider === 'localtunnel' ? '<div class="muted warn-text">Visitors see an IP check page on this provider. Install cloudflared for clean links.</div>' : '') +
              '<div class="row">' + btn('copyUrl', '📋 Copy link', 'btn-secondary', ' data-url="' + esc(link) + '"') +
              '<button class="btn btn-danger" data-action="stopTunnel" data-id="' + esc(t.id) + '">Stop</button></div>';
          }
          html += '</div>';
        });
        if (tunnels.some((t) => t.id === 'primary' && t.status === 'active')) {
          html += '<div class="row">' + btn('copyCard', '🗂️ Team card' + proTag()) + btn('saveQr', '🖼️ QR image' + proTag()) + '</div>';
          html += '<div class="row">' + btn('shareExtra', '➕ Share another port' + proTag()) + '</div>';
        }
      } else {
        html += '<p class="muted mb6">A public HTTPS link to your local app, with a QR code for your phone. No account needed.</p>' +
          btn('startTunnel', '🌐 Get shareable link', 'btn') +
          '<div class="row">' + btn('startPrivate', '🔒 Private link' + proTag()) + btn('startCustom', '🔗 My domain' + proTag()) + '</div>';
      }
      if (s.visitors.length) {
        html += '<details open><summary>Recent visitors</summary><ul class="plain">' + s.visitors.map((v) => '<li>' + esc(v) + '</li>').join('') + '</ul>' +
          '<button class="link" data-action="visitors">See all</button></details>';
      }
      return html + '</div>';
    }

    function tool(action, name, status, label) {
      return '<div class="tool"><div class="tool-text"><div class="tool-name">' + name + '</div><div class="muted">' + status + '</div></div>' +
        '<button class="btn btn-secondary btn-small" data-action="' + action + '">' + label + '</button></div>';
    }

    function shipSafe(s) {
      const r = s.results;
      const prePushText = { installed: '<span class="ok">On</span>: pushes with blockers are stopped', 'not-installed': 'Off', 'foreign-hook': 'Another pre-push hook is installed', 'custom-hooks-path': 'Custom hooks folder (Husky): add one line', 'not-a-repo': 'Not a git repository' }[s.prePush] || '';
      return '<div class="card"><div class="card-title"><span>Ship safe</span>' + (pro ? '<span class="pill pro">Pro</span>' : '<span class="tag">PRO</span>') + '</div>' +
        tool('scanSecrets', 'Secret Leak Guard', r.secrets ? (r.secrets.count ? '<span class="bad">' + r.secrets.count + ' possible secret(s)</span>' : '<span class="ok">No secrets found</span>') + ' · ' + esc(ago(r.secrets.at, s.now)) : 'Finds hard-coded keys before you share', 'Scan') +
        tool('prePush', 'Pre-Push Gate', prePushText, s.prePush === 'installed' ? 'Turn off' : 'Turn on') +
        tool('deps', 'Dependency Health', r.deps ? '<span class="' + (r.deps.serious ? 'bad' : 'ok') + '">' + esc(r.deps.message) + '</span>' : 'Security holes and outdated frameworks', 'Check') +
        tool('bundle', 'Bundle Size Budget', r.bundle ? '<span class="' + (r.bundle.overBudget || r.bundle.grew ? 'warn-text' : 'ok') + '">' + esc(r.bundle.summary) + '</span>' : 'What visitors download, build to build', 'Measure') +
        '</div>';
    }

    function deploy(s) {
      const d = s.results.deploy;
      const acct = [s.accounts.vercel ? 'Vercel ✓' : null, s.accounts.cloudflare ? 'Cloudflare ✓' : null].filter(Boolean).join(' · ') || 'Uses your own free Vercel or Cloudflare account';
      let html = '<div class="card"><div class="card-title"><span>Deploy</span>' + (pro ? '<span class="pill pro">Pro</span>' : '<span class="tag">PRO</span>') + '</div>' +
        '<p class="muted mb6">' + esc(acct) + '. Runs the pre-flight check first and always asks before deploying.</p>' +
        btn('deploy', '🚀 Deploy a preview', 'btn');
      if (d) {
        html += '<div class="url">' + esc(d.url) + '</div><div class="meta"><span>' + esc(d.target) + ' · ' + (d.production ? 'production' : 'preview') + ' · ' + esc(ago(d.at, s.now)) + '</span></div>' +
          '<div class="qr">' + d.qrCodeSvg + '</div>' + btn('copyUrl', '📋 Copy URL', 'btn-secondary', ' data-url="' + esc(d.url) + '"');
      }
      return html + '</div>';
    }

    function license(s) {
      const l = s.license;
      if (l.isActivated) {
        return '<div class="card"><div class="card-title"><span>LaunchWizard Pro</span><span class="pill pro">Active</span></div>' +
          '<p class="muted">Key ' + esc(l.key) + (l.uses ? ' · ' + esc(l.uses) + ' of ' + esc(l.maxMachines) + ' machines' : '') + '</p>' +
          '<div class="row">' + btn('licenseStatus', 'License details') + '</div></div>';
      }
      return '<div class="card"><div class="card-title"><span>Pro · $9.99 once</span>' + (l.paused ? '<span class="pill">Needs re-check</span>' : '') + '</div>' +
        '<p class="muted">' + (l.paused ? 'Your license needs a quick online re-check. Connect to the internet and open License details.' : 'No subscription. Adds auto-fix on save, private links, team cards, secret guard, pre-push gate, deploy and more. Everything above marked Free stays free.') + '</p>' +
        '<div class="row">' + btn(l.paused ? 'licenseStatus' : 'buyLicense', l.paused ? 'Re-check' : 'Get Pro') + btn('activateLicense', 'Enter key') + '</div></div>';
    }

    function render(s) {
      pro = !!(s.license && s.license.isActivated);
      document.getElementById('framework').textContent = s.framework;
      const tier = document.getElementById('tier');
      tier.textContent = pro ? 'Pro' : 'Free';
      tier.className = 'pill' + (pro ? ' pro' : '');
      document.getElementById('app').innerHTML = preflight(s) + share(s) + shipSafe(s) + deploy(s) + license(s);
    }
  </script>
</body>
</html>`;
  }
}
