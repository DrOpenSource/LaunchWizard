import * as vscode from 'vscode';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { PreFlightEngine } from '../core/PreFlightEngine.js';
import { ErrorTranslator } from '../core/ErrorTranslator.js';
import { AutoHealer } from '../core/AutoHealer.js';
import { TunnelManager } from '../core/TunnelManager.js';
import { LicenseManager } from '../core/LicenseManager.js';
import type { PreFlightReport, TranslatedError, TunnelInfo, LicenseState, FrameworkInfo } from '../shared/types.js';

export class PreFlightDeckViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'shipwizard.preFlightDeck';
  private view?: vscode.WebviewView;

  private latestReport: PreFlightReport | null = null;
  private translatedErrors: TranslatedError[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly licenseManager: LicenseManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'refresh':
        case 'runPreFlight':
          await this.runPreFlightCheck();
          break;

        case 'startTunnel':
          await vscode.commands.executeCommand('shipwizard.startTunnel');
          await this.syncDeckState();
          break;

        case 'stopTunnel':
          await vscode.commands.executeCommand('shipwizard.stopTunnel');
          await this.syncDeckState();
          break;

        case 'healAll':
          await vscode.commands.executeCommand('shipwizard.autoHealAll');
          await this.runPreFlightCheck();
          break;

        case 'copyUrl':
          if (message.url) {
            await vscode.env.clipboard.writeText(message.url);
            vscode.window.showInformationMessage(`📋 Copied live tunnel URL: ${message.url}`);
          }
          break;

        case 'activateLicense':
          await vscode.commands.executeCommand('shipwizard.activateLicense');
          await this.syncDeckState();
          break;

        case 'buyLicense':
          await vscode.env.openExternal(vscode.Uri.parse('https://shipwizard.taqnik.in'));
          break;

        case 'openWebsite':
          await vscode.env.openExternal(vscode.Uri.parse('https://shipwizard.taqnik.in'));
          break;
      }
    });

    this.runPreFlightCheck();
  }

  public async runPreFlightCheck(): Promise<PreFlightReport | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;
    const report = await PreFlightEngine.run({ projectRoot });
    this.latestReport = report;
    this.translatedErrors = ErrorTranslator.translateBatch(report.errors);

    await this.syncDeckState();
    return report;
  }

  public async syncDeckState(): Promise<void> {
    if (!this.view) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectRoot = workspaceFolders?.[0]?.uri.fsPath || '';
    const frameworkInfo: FrameworkInfo = projectRoot
      ? FrameworkDetector.detect(projectRoot)
      : {
          framework: 'unknown',
          displayName: 'No Workspace',
          packageManager: 'npm',
          hasTypeScript: false,
          defaultPort: 3000,
        };

    const tunnelInfo: TunnelInfo = TunnelManager.getStatus();
    const licenseState: LicenseState = this.licenseManager.getStatus();

    this.view.webview.postMessage({
      type: 'stateUpdate',
      framework: frameworkInfo,
      report: this.latestReport,
      translatedErrors: this.translatedErrors,
      tunnel: tunnelInfo,
      license: licenseState,
      rollbackCount: AutoHealer.getRollbackCount(),
    });
  }

  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShipWizard Pre-Flight Deck</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --card-bg: var(--vscode-editor-background);
      --border: var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
      --text: var(--vscode-editor-foreground);
      --text-muted: var(--vscode-descriptionForeground, #8e8e93);
      --accent: #0a6fe0;
      --accent-hover: #1f7ff0;
      --green: #32d74b;
      --red: #ff453a;
      --warn: #ffa626;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 13px;
      line-height: 1.45;
      padding: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 14px;
    }
    .badge-pill {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--accent);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.15s ease;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.07);
      color: var(--text);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }
    .btn-danger {
      background: rgba(255, 69, 58, 0.15);
      color: var(--red);
      border: 1px solid rgba(255, 69, 58, 0.3);
    }

    .status-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .status-pass {
      background: rgba(50, 215, 75, 0.12);
      color: var(--green);
      border: 1px solid rgba(50, 215, 75, 0.25);
    }
    .status-fail {
      background: rgba(255, 69, 58, 0.12);
      color: var(--red);
      border: 1px solid rgba(255, 69, 58, 0.25);
    }

    .error-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-left: 3px solid var(--red);
      border-radius: 6px;
      padding: 9px;
      margin-top: 8px;
    }
    .error-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--red);
      margin-bottom: 3px;
    }
    .error-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 3px;
    }
    .error-why {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 10px 0;
    }
    .qr-container svg {
      max-width: 180px;
      height: auto;
      border-radius: 8px;
    }
    .url-display {
      word-break: break-all;
      font-family: monospace;
      font-size: 11px;
      background: rgba(0, 0, 0, 0.25);
      padding: 6px 8px;
      border-radius: 5px;
      margin: 6px 0;
      display: block;
      color: var(--accent);
    }

    .footer-links {
      margin-top: 16px;
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.6;
    }
    .footer-links a {
      color: var(--text-muted);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">🚀 ShipWizard</div>
    <div id="frameworkPill" class="badge-pill">Scanning...</div>
  </div>

  <!-- Pre-Flight Section -->
  <div class="card">
    <div class="card-title">
      <span>Pre-Flight Radar</span>
      <span id="checkTime" style="font-size: 10px; opacity: 0.7;"></span>
    </div>
    <div id="preflightStatus" class="status-banner status-pass">
      <span>🔍 Ready to inspect</span>
    </div>
    <button id="runCheckBtn" class="btn btn-secondary">⚡ Run Pre-Flight Check</button>
    <div id="errorsList"></div>
    <div id="healAllContainer" style="margin-top: 8px; display: none;">
      <button id="healAllBtn" class="btn">🪄 1-Click Auto-Heal All</button>
    </div>
  </div>

  <!-- Instant Tunnel Section -->
  <div class="card">
    <div class="card-title">
      <span>Instant Shareable Link</span>
      <span class="badge-pill" style="color: var(--green);">Free</span>
    </div>
    <div id="tunnelContent">
      <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 8px;">
        1-click secure Cloudflare tunnel to test your app on your phone or send to clients.
      </p>
      <button id="startTunnelBtn" class="btn">🌐 Launch Live Share Link</button>
    </div>
  </div>

  <!-- Pro License & Calm Dev Suite -->
  <div class="card" style="background: rgba(10, 111, 224, 0.05); border-color: rgba(10, 111, 224, 0.25);">
    <div class="card-title">
      <span style="color: var(--accent);">Pro Lifetime ($9.99)</span>
      <span id="licenseBadge" class="badge-pill">Free Tier</span>
    </div>
    <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
      Zero subscriptions. Unlock automated AST auto-healing on save & BYOK cloud deployment.
    </p>
    <div style="display: flex; gap: 6px;">
      <button id="buyProBtn" class="btn btn-secondary" style="font-size: 11px; padding: 5px;">Get Pro ($9.99)</button>
      <button id="activateProBtn" class="btn btn-secondary" style="font-size: 11px; padding: 5px;">Enter Key</button>
    </div>
  </div>

  <div class="footer-links">
    Part of the Calm Dev Suite<br/>
    <a href="https://shipwizard.taqnik.in">shipwizard.taqnik.in</a>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('runCheckBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'runPreFlight' });
    });

    document.getElementById('healAllBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'healAll' });
    });

    document.getElementById('buyProBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'buyLicense' });
    });

    document.getElementById('activateProBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'activateLicense' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'stateUpdate') {
        renderState(msg);
      }
    });

    function renderState(state) {
      // 1. Framework pill
      if (state.framework) {
        document.getElementById('frameworkPill').innerText = state.framework.displayName || 'Web Project';
      }

      // 2. Pre-Flight status
      const statusBanner = document.getElementById('preflightStatus');
      const errorsList = document.getElementById('errorsList');
      const healAllContainer = document.getElementById('healAllContainer');

      if (!state.report) {
        statusBanner.className = 'status-banner status-pass';
        statusBanner.innerHTML = '<span>⚡ Click to verify build</span>';
        errorsList.innerHTML = '';
        healAllContainer.style.display = 'none';
      } else if (state.report.passed) {
        statusBanner.className = 'status-banner status-pass';
        statusBanner.innerHTML = '<span>✅ Ready to Ship! 0 Blockers</span>';
        errorsList.innerHTML = '';
        healAllContainer.style.display = 'none';
      } else {
        const count = state.report.errors.length;
        statusBanner.className = 'status-banner status-fail';
        statusBanner.innerHTML = '<span>🚨 ' + count + ' Build Blocker' + (count > 1 ? 's' : '') + '</span>';
        healAllContainer.style.display = 'block';

        let html = '';
        for (const err of state.translatedErrors) {
          html += '<div class="error-card">' +
            '<div class="error-badge">' + err.badge + '</div>' +
            '<div class="error-title">' + err.friendlyTitle + '</div>' +
            '<div class="error-why">' + err.whyItBreaks + '</div>' +
          '</div>';
        }
        errorsList.innerHTML = html;
      }

      // 3. Tunnel status
      const tunnelBox = document.getElementById('tunnelContent');
      if (state.tunnel && state.tunnel.status === 'active') {
        tunnelBox.innerHTML =
          '<div class="status-banner status-pass" style="margin-bottom: 6px;">' +
            '<span>🟢 Live Test Link Active (Port ' + state.tunnel.localPort + ')</span>' +
          '</div>' +
          '<div class="url-display">' + state.tunnel.url + '</div>' +
          '<div class="qr-container">' + state.tunnel.qrCodeSvg + '</div>' +
          '<div style="display: flex; gap: 6px; margin-top: 6px;">' +
            '<button id="copyUrlBtn" class="btn btn-secondary" style="flex: 1;">📋 Copy URL</button>' +
            '<button id="stopTunnelBtn" class="btn btn-danger" style="flex: 1;">🛑 Stop Tunnel</button>' +
          '</div>';

        document.getElementById('copyUrlBtn').addEventListener('click', () => {
          vscode.postMessage({ type: 'copyUrl', url: state.tunnel.url });
        });
        document.getElementById('stopTunnelBtn').addEventListener('click', () => {
          vscode.postMessage({ type: 'stopTunnel' });
        });
      } else if (state.tunnel && state.tunnel.status === 'starting') {
        tunnelBox.innerHTML =
          '<div class="status-banner" style="background: rgba(10, 111, 224, 0.12); color: var(--accent);">' +
            '<span>⏳ Connecting Cloudflare edge tunnel...</span>' +
          '</div>';
      } else {
        tunnelBox.innerHTML =
          '<p style="color: var(--text-muted); font-size: 12px; margin-bottom: 8px;">' +
            '1-click secure Cloudflare tunnel to test your app on your phone or send to clients.' +
          '</p>' +
          '<button id="startTunnelBtn" class="btn">🌐 Launch Live Share Link</button>';

        document.getElementById('startTunnelBtn').addEventListener('click', () => {
          vscode.postMessage({ type: 'startTunnel' });
        });
      }

      // 4. License status
      if (state.license && state.license.isActivated) {
        document.getElementById('licenseBadge').innerText = 'Pro Lifetime';
        document.getElementById('licenseBadge').style.color = 'var(--green)';
      }
    }
  </script>
</body>
</html>`;
  }
}
