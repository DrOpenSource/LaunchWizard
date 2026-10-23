import * as crypto from 'node:crypto';
import type { LicenseState } from '../shared/types.js';

/** What the extension persists (in VS Code SecretStorage) between sessions. */
export interface StoredLicense {
  key: string;
  machineIdHash: string;
  activatedAt: number;
  verifiedAt: number;
  uses?: number;
}

export interface LicenseManagerOptions {
  stored?: StoredLicense;
  /** Raw machine identifier (vscode.env.machineId); only its hash is stored or compared. */
  machineId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export type RefreshOutcome = 'verified' | 'revoked' | 'offline' | 'none';

interface GumroadVerifyResponse {
  success: boolean;
  uses?: number;
  message?: string;
  purchase?: { refunded?: boolean; chargebacked?: boolean; disputed?: boolean };
}

/**
 * Pro licensing using only Gumroad's free license API. No server and no secrets in the extension.
 * Any check that runs on the user's machine can be patched out; at $9.99 the goal is to keep
 * honest users honest, not perfect DRM.
 */
export class LicenseManager {
  public static readonly PRODUCT_ID = '5jmErjhP_JXqeLXQtq5TgA==';
  public static readonly MAX_MACHINES = 3;
  public static readonly REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
  public static readonly GRACE_MS = 30 * 24 * 60 * 60 * 1000;
  private static readonly GUMROAD_VERIFY_ENDPOINT = 'https://api.gumroad.com/v2/licenses/verify';

  private stored?: StoredLicense;
  private readonly machineIdHash: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(options: LicenseManagerOptions) {
    this.machineIdHash = LicenseManager.hashMachineId(options.machineId);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    // A license stored on another machine (e.g. a synced profile) doesn't count here.
    if (options.stored && options.stored.machineIdHash === this.machineIdHash) {
      this.stored = options.stored;
    }
  }

  public static hashMachineId(machineId: string): string {
    return crypto.createHash('sha256').update(`launchwizard:${machineId}`).digest('hex');
  }

  public getStatus(): LicenseState {
    if (!this.stored) {
      return { tier: 'free', isActivated: false, maxMachines: LicenseManager.MAX_MACHINES, paused: false };
    }
    const graceEndsAt = this.stored.verifiedAt + LicenseManager.GRACE_MS;
    const withinGrace = this.now() <= graceEndsAt;
    return {
      tier: withinGrace ? 'pro' : 'free',
      isActivated: withinGrace,
      key: LicenseManager.maskKey(this.stored.key),
      activatedAt: this.stored.activatedAt,
      lastVerifiedAt: this.stored.verifiedAt,
      graceEndsAt,
      uses: this.stored.uses,
      maxMachines: LicenseManager.MAX_MACHINES,
      paused: !withinGrace,
    };
  }

  public isPro(): boolean {
    return this.getStatus().tier === 'pro';
  }

  public toStored(): StoredLicense | undefined {
    return this.stored ? { ...this.stored } : undefined;
  }

  public clear(): void {
    this.stored = undefined;
  }

  /** True when a background re-check is due. */
  public needsRefresh(): boolean {
    return Boolean(this.stored) && this.now() - this.stored!.verifiedAt >= LicenseManager.REFRESH_INTERVAL_MS;
  }

  /**
   * Activates a Gumroad key on this machine. Activation needs internet once; a new machine
   * spends one of the key's 3 seats, while re-activating the same machine never does.
   */
  public async activateLicense(key: string): Promise<{ success: boolean; message: string }> {
    const trimmed = key.trim();
    if (!LicenseManager.isGumroadKeyFormat(trimmed)) {
      return {
        success: false,
        message: 'That doesn\'t look like a LaunchWizard license key. Copy the key from your Gumroad receipt (format XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX).',
      };
    }

    const sameMachineAgain = this.stored?.key === trimmed;

    let check: GumroadVerifyResponse;
    try {
      check = await this.verify(trimmed, false);
    } catch {
      return { success: false, message: 'Could not reach Gumroad to check your key. Activation needs an internet connection once; please try again.' };
    }

    const problem = this.problemWith(check);
    if (problem) {
      return { success: false, message: problem };
    }

    let uses = check.uses;
    if (!sameMachineAgain) {
      if ((check.uses ?? 0) >= LicenseManager.MAX_MACHINES) {
        return {
          success: false,
          message: `This key is already active on ${LicenseManager.MAX_MACHINES} machines. Remove it from one ("LaunchWizard: Remove License From This Machine") and email support to free the seat.`,
        };
      }
      try {
        const counted = await this.verify(trimmed, true);
        uses = counted.uses ?? (check.uses ?? 0) + 1;
      } catch {
        return { success: false, message: 'Could not reach Gumroad to finish activation. Please try again.' };
      }
    }

    const now = this.now();
    this.stored = {
      key: trimmed,
      machineIdHash: this.machineIdHash,
      activatedAt: sameMachineAgain && this.stored ? this.stored.activatedAt : now,
      verifiedAt: now,
      uses,
    };
    return {
      success: true,
      message: 'LaunchWizard Pro activated! Auto-fix on save, private links, Secret Leak Guard, Pre-Push Gate, deploy and the other Pro tools are now unlocked.',
    };
  }

  /**
   * Re-checks the stored key without spending a seat. A refunded or revoked key downgrades to Free;
   * a network failure keeps Pro until the grace period ends.
   */
  public async refresh(): Promise<RefreshOutcome> {
    if (!this.stored) return 'none';
    let check: GumroadVerifyResponse;
    try {
      check = await this.verify(this.stored.key, false);
    } catch {
      return 'offline';
    }
    if (this.problemWith(check)) {
      this.stored = undefined;
      return 'revoked';
    }
    this.stored = { ...this.stored, verifiedAt: this.now(), uses: check.uses ?? this.stored.uses };
    return 'verified';
  }

  private problemWith(check: GumroadVerifyResponse): string | null {
    if (!check.success) {
      return 'Gumroad does not recognise this key for LaunchWizard. Check that you copied the whole key from your receipt.';
    }
    if (check.purchase?.refunded || check.purchase?.chargebacked || check.purchase?.disputed) {
      return 'This purchase was refunded or disputed, so the key is no longer active.';
    }
    return null;
  }

  private async verify(key: string, incrementUses: boolean): Promise<GumroadVerifyResponse> {
    const response = await this.fetchImpl(LicenseManager.GUMROAD_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: LicenseManager.PRODUCT_ID,
        license_key: key,
        increment_uses_count: String(incrementUses),
      }),
    });
    // Gumroad answers unknown keys with 404 and a JSON body; anything unparsable counts as offline.
    return (await response.json()) as GumroadVerifyResponse;
  }

  public static isGumroadKeyFormat(key: string): boolean {
    if (!key) return false;
    const isGumroad8x4 = /^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}$/i.test(key);
    const isUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key);
    return isGumroad8x4 || isUuid;
  }

  public static maskKey(key: string): string {
    return key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '••••';
  }
}
