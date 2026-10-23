import * as vscode from 'vscode';
import { LicenseManager, type StoredLicense } from '../core/LicenseManager.js';
import type { LicenseState } from '../shared/types.js';

const SECRET_KEY = 'launchwizard.license';
const LEGACY_STATE_KEYS = ['launchwizard.licenseKey', 'shipwizard.licenseKey'];
/** Buying goes through the website's pricing section (same as earlier versions that passed Marketplace review). */
export const PRICING_URL = 'https://launchwizard.taqnik.in/#pricing';
/** Seat resets go by private email: a license key must never be posted in a public issue. */
export const SUPPORT_URL = 'mailto:taqnikin@gmail.com?subject=LaunchWizard%20seat%20reset&body=Please%20include%20your%20Gumroad%20order%20email.%20Do%20not%20post%20your%20license%20key%20publicly.';

/**
 * Owns the Pro license inside VS Code: SecretStorage persistence, the weekly Gumroad
 * re-check, and the single `requirePro` gate every Pro action goes through.
 */
export class LicenseService implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<LicenseState>();
  public readonly onDidChange = this.changeEmitter.event;
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private manager: LicenseManager
  ) {}

  public static async create(context: vscode.ExtensionContext): Promise<LicenseService> {
    // Legacy SHIP-PRO keys were never issued to customers (decision D2); just clear them.
    for (const key of LEGACY_STATE_KEYS) {
      if (context.globalState.get(key) !== undefined) {
        await context.globalState.update(key, undefined);
      }
    }

    let stored: StoredLicense | undefined;
    try {
      const raw = await context.secrets.get(SECRET_KEY);
      stored = raw ? (JSON.parse(raw) as StoredLicense) : undefined;
    } catch {
      stored = undefined;
    }

    const service = new LicenseService(context, new LicenseManager({ stored, machineId: vscode.env.machineId }));
    service.refreshTimer = setInterval(() => void service.refreshIfDue(), 12 * 60 * 60 * 1000);
    void service.refreshIfDue();
    return service;
  }

  public status(): LicenseState {
    return this.manager.getStatus();
  }

  public isPro(): boolean {
    return this.manager.isPro();
  }

  public async activate(key: string): Promise<{ success: boolean; message: string }> {
    const result = await this.manager.activateLicense(key);
    if (result.success) {
      await this.persist();
    }
    return result;
  }

  public async remove(): Promise<void> {
    this.manager.clear();
    await this.persist();
  }

  public async refreshIfDue(): Promise<void> {
    const before = this.manager.getStatus();
    if (!before.lastVerifiedAt) return;
    if (!this.manager.needsRefresh() && !before.paused) return;

    const outcome = await this.manager.refresh();
    if (outcome === 'verified' || outcome === 'revoked') {
      await this.persist();
    }
    if (outcome === 'revoked') {
      void vscode.window.showWarningMessage('LaunchWizard: your Pro license is no longer active (refunded or revoked). Free features keep working.');
    }
  }

  /**
   * The one place Pro is enforced. Free users see a single calm message, only when they
   * ask for a Pro action: never on startup or on a timer.
   */
  public async requirePro(feature: string): Promise<boolean> {
    if (this.isPro()) return true;

    const status = this.status();
    const detail = status.paused
      ? 'Your Pro license needs a quick online re-check. Connect to the internet and try again.'
      : `${feature} is part of LaunchWizard Pro: $9.99 once, no subscription. Everything you already use stays free.`;
    const choice = await vscode.window.showInformationMessage(
      `LaunchWizard Pro: ${detail}`,
      ...(status.paused ? ['Retry Check'] : ['Get Pro ($9.99)', 'Enter License Key'])
    );
    if (choice === 'Get Pro ($9.99)') {
      await vscode.env.openExternal(vscode.Uri.parse(PRICING_URL));
    } else if (choice === 'Enter License Key') {
      await vscode.commands.executeCommand('launchwizard.activateLicense');
      return this.isPro();
    } else if (choice === 'Retry Check') {
      await this.manager.refresh();
      await this.persist();
      return this.isPro();
    }
    return false;
  }

  private async persist(): Promise<void> {
    const stored = this.manager.toStored();
    if (stored) {
      await this.context.secrets.store(SECRET_KEY, JSON.stringify(stored));
    } else {
      await this.context.secrets.delete(SECRET_KEY);
    }
    this.changeEmitter.fire(this.status());
  }

  public dispose(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.changeEmitter.dispose();
  }
}
