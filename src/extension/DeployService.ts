import * as vscode from 'vscode';
import { DeployManager, type DeployTarget } from '../core/DeployManager.js';
import { FrameworkDetector } from '../core/FrameworkDetector.js';
import { GitInfo } from '../core/GitInfo.js';
import { PreFlightEngine } from '../core/PreFlightEngine.js';
import { QrGenerator } from '../core/QrGenerator.js';
import type { AppState } from './AppState.js';
import type { LicenseService } from './LicenseService.js';
import { Log } from './Log.js';
import { Settings } from './Settings.js';
import { projectName, projectRoot, type ShareService } from './ShareService.js';
import type { ToolsService } from './ToolsService.js';

const VERCEL_TOKEN = 'launchwizard.vercelToken';
const CF_TOKEN = 'launchwizard.cloudflareToken';
const CF_ACCOUNT = 'launchwizard.cloudflareAccountId';

const TARGET_NAMES: Record<DeployTarget, string> = { vercel: 'Vercel', 'cloudflare-pages': 'Cloudflare Pages' };

/**
 * Pro "BYOK 1-Click Deploy". Tokens live in VS Code SecretStorage on this machine only.
 * Nothing deploys without an explicit confirmation; production needs a second one.
 */
export class DeployService {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.changeEmitter.event;
  private connected = { vercel: false, cloudflare: false };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly license: LicenseService,
    private readonly state: AppState,
    private readonly share: ShareService,
    private readonly tools: ToolsService
  ) {
    void this.refreshConnected();
  }

  public accounts(): { vercel: boolean; cloudflare: boolean } {
    return { ...this.connected };
  }

  private async refreshConnected(): Promise<void> {
    this.connected = {
      vercel: Boolean(await this.context.secrets.get(VERCEL_TOKEN)),
      cloudflare: Boolean(await this.context.secrets.get(CF_TOKEN)) && Boolean(await this.context.secrets.get(CF_ACCOUNT)),
    };
    this.changeEmitter.fire();
  }

  public async connectVercel(): Promise<boolean> {
    if (!(await this.license.requirePro('BYOK deploy'))) return false;
    const open = await vscode.window.showInformationMessage(
      'Connect your free Vercel account: create a token at vercel.com/account/tokens, then paste it here. It is stored only in VS Code\'s secure storage on this machine.',
      'Open Vercel Tokens Page',
      'I Have a Token'
    );
    if (!open) return false;
    if (open === 'Open Vercel Tokens Page') await vscode.env.openExternal(vscode.Uri.parse('https://vercel.com/account/tokens'));
    const token = await vscode.window.showInputBox({ title: 'Vercel token', password: true, ignoreFocusOut: true, prompt: 'Paste your Vercel token' });
    if (!token?.trim()) return false;
    await this.context.secrets.store(VERCEL_TOKEN, token.trim());
    await this.refreshConnected();
    void vscode.window.showInformationMessage('LaunchWizard: Vercel connected.');
    return true;
  }

  public async connectCloudflare(): Promise<boolean> {
    if (!(await this.license.requirePro('BYOK deploy'))) return false;
    const open = await vscode.window.showInformationMessage(
      'Connect your free Cloudflare account: create an API token with the "Cloudflare Pages: Edit" permission, and copy your Account ID from the dashboard sidebar. Both stay in VS Code\'s secure storage on this machine.',
      'Open Cloudflare Tokens Page',
      'I Have Them'
    );
    if (!open) return false;
    if (open === 'Open Cloudflare Tokens Page') await vscode.env.openExternal(vscode.Uri.parse('https://dash.cloudflare.com/profile/api-tokens'));
    const token = await vscode.window.showInputBox({ title: 'Cloudflare API token', password: true, ignoreFocusOut: true, prompt: 'Paste your Cloudflare API token' });
    if (!token?.trim()) return false;
    const accountId = await vscode.window.showInputBox({
      title: 'Cloudflare Account ID',
      ignoreFocusOut: true,
      prompt: 'Paste your Account ID (32 characters, shown on the dashboard sidebar)',
      validateInput: (v) => (/^[a-f0-9]{32}$/i.test(v.trim()) ? null : 'An Account ID is 32 letters and numbers (a–f, 0–9).'),
    });
    if (!accountId) return false;
    await this.context.secrets.store(CF_TOKEN, token.trim());
    await this.context.secrets.store(CF_ACCOUNT, accountId.trim());
    await this.refreshConnected();
    void vscode.window.showInformationMessage('LaunchWizard: Cloudflare connected.');
    return true;
  }

  public async disconnect(): Promise<void> {
    await Promise.all([VERCEL_TOKEN, CF_TOKEN, CF_ACCOUNT].map((k) => this.context.secrets.delete(k)));
    await this.refreshConnected();
    void vscode.window.showInformationMessage('LaunchWizard: deploy accounts disconnected and tokens deleted from this machine.');
  }

  public async deploy(preselected?: DeployTarget): Promise<void> {
    if (!(await this.license.requirePro('BYOK 1-click deploy'))) return;
    const root = projectRoot();
    if (!root) {
      void vscode.window.showInformationMessage('LaunchWizard: open a project folder first.');
      return;
    }
    const info = FrameworkDetector.detect(root);

    // 1. Pick a target (and connect it if needed)
    let target = preselected;
    if (!target) {
      const pick = await vscode.window.showQuickPick(
        [
          { label: 'Vercel', description: this.connected.vercel ? 'connected' : 'connect your free account', id: 'vercel' as const },
          { label: 'Cloudflare Pages', description: this.connected.cloudflare ? 'connected' : 'connect your free account', id: 'cloudflare-pages' as const },
        ],
        { placeHolder: 'Deploy to…' }
      );
      if (!pick) return;
      target = pick.id;
    }
    if (target === 'vercel' && !this.connected.vercel && !(await this.connectVercel())) return;
    if (target === 'cloudflare-pages' && !this.connected.cloudflare && !(await this.connectCloudflare())) return;

    const credentials = target === 'vercel'
      ? { token: (await this.context.secrets.get(VERCEL_TOKEN)) ?? '' }
      : { token: (await this.context.secrets.get(CF_TOKEN)) ?? '', accountId: (await this.context.secrets.get(CF_ACCOUNT)) ?? '' };

    const invalid = DeployManager.validate({ target, credentials, info, projectRoot: root });
    if (invalid) {
      void vscode.window.showWarningMessage(`LaunchWizard: ${invalid}`);
      return;
    }

    // 2. Gate: pre-flight check, secret guard, and (Pages) a local build
    const report = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'LaunchWizard: pre-flight check before deploying' },
      () => PreFlightEngine.run({ projectRoot: root, timeoutMs: Settings.preflightTimeoutMs })
    );
    if (!report.passed) {
      const choice = await vscode.window.showWarningMessage(
        `🚨 ${report.errors.length} build blocker(s) found. This deploy will most likely fail.`,
        { modal: true },
        'Show Blockers',
        'Deploy Anyway'
      );
      if (choice === 'Show Blockers') {
        await vscode.commands.executeCommand('launchwizard.runPreFlight');
        return;
      }
      if (choice !== 'Deploy Anyway') return;
    }
    if (!(await this.share.secretGuard(root, 'deploying'))) return;
    if (target === 'cloudflare-pages' && !(await this.tools.runBuildCheck())) {
      void vscode.window.showWarningMessage('LaunchWizard: the production build failed, so there is nothing to upload to Cloudflare Pages yet.');
      return;
    }

    // 3. Explicit confirmation (production needs a second one)
    const git = GitInfo.snapshot(root);
    const name = DeployManager.sanitizeProjectName(projectName(root));
    const where = target === 'vercel' ? 'Vercel' : `Cloudflare Pages project "${name}"`;
    const first = await vscode.window.showInformationMessage(
      `Deploy ${projectName(root)} to ${where}?`,
      {
        modal: true,
        detail: `A preview deployment gets its own URL and does not replace your live site.${git.branch ? `\nBranch: ${git.branch}${git.dirty ? ' (includes uncommitted changes)' : ''}` : ''}\nYour own ${TARGET_NAMES[target]} account and free plan are used.`,
      },
      'Deploy Preview',
      'Deploy to Production…'
    );
    if (!first) return;
    let production = false;
    if (first === 'Deploy to Production…') {
      const second = await vscode.window.showWarningMessage(
        `Deploy to PRODUCTION on ${TARGET_NAMES[target]}?`,
        { modal: true, detail: 'This replaces what your visitors see right now.' },
        'Yes, Deploy to Production'
      );
      if (second !== 'Yes, Deploy to Production') return;
      production = true;
    }

    // 4. Deploy
    Log.section(`Deploy to ${TARGET_NAMES[target]} (${production ? 'production' : 'preview'})`);
    Log.show();
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `LaunchWizard: deploying to ${TARGET_NAMES[target]}`, cancellable: true },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        progress.report({ message: 'uploading and building… (the log shows progress)' });
        return DeployManager.deploy({
          target: target!,
          projectRoot: root,
          info,
          production,
          credentials,
          projectName: name,
          gitBranch: git.branch,
          signal: controller.signal,
          onOutput: (chunk) => Log.get().append(chunk),
        });
      }
    );

    if (!result.success || !result.url) {
      const choice = await vscode.window.showErrorMessage(`LaunchWizard: ${result.message}`, 'Open Log');
      if (choice) Log.show();
      return;
    }
    this.state.setResult('deploy', { url: result.url, target: TARGET_NAMES[target], production, qrCodeSvg: QrGenerator.generateSvg(result.url), at: Date.now() });
    const action = await vscode.window.showInformationMessage(`🚀 Deployed to ${TARGET_NAMES[target]}${production ? ' (production)' : ' (preview)'}: ${result.url}`, 'Open', 'Copy URL');
    if (action === 'Open') await vscode.env.openExternal(vscode.Uri.parse(result.url));
    if (action === 'Copy URL') await vscode.env.clipboard.writeText(result.url);
  }

  public dispose(): void {
    this.changeEmitter.dispose();
  }
}
