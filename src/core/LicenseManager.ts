import * as crypto from 'node:crypto';
import type { LicenseState, LicenseTier } from '../shared/types.js';

export class LicenseManager {
  private static readonly SALT = 'SHIPWIZARD_DR_OPENSOURCE_LIFETIME_SECRET_2026';
  private static readonly PRODUCT_PERMALINK = 'shipwizard';
  private static readonly PRODUCT_ID = '5jmErjhP_JXqeLXQtq5TgA==';
  private static readonly GUMROAD_VERIFY_ENDPOINT = 'https://api.gumroad.com/v2/licenses/verify';

  private tier: LicenseTier = 'free';
  private licenseKey?: string;
  private activatedAt?: number;

  constructor(initialKey?: string) {
    if (initialKey && this.validateKeyPattern(initialKey)) {
      this.tier = 'pro';
      this.licenseKey = initialKey;
      this.activatedAt = Date.now();
    }
  }

  /**
   * Returns current license tier and activation status.
   */
  public getStatus(): LicenseState {
    return {
      tier: this.tier,
      key: this.licenseKey,
      isActivated: this.tier === 'pro',
      activatedAt: this.activatedAt,
      activeMachines: this.tier === 'pro' ? 1 : 0,
    };
  }

  /**
   * Activates a license key using offline checksum validation and online Gumroad verification.
   */
  public async activateLicense(key: string): Promise<{ success: boolean; message: string }> {
    const trimmed = key.trim();

    // 1. Format check: SHIP-PRO-XXXX-XXXX or Gumroad Key (8-8-8-8 or UUID)
    if (!this.validateKeyPattern(trimmed)) {
      return {
        success: false,
        message: 'Invalid license key format. Please provide a valid ShipWizard Lifetime key.',
      };
    }

    // 2. Offline cryptographic verification for SHIP-PRO format
    if (trimmed.startsWith('SHIP-PRO-')) {
      if (this.verifyCryptographicChecksum(trimmed)) {
        this.tier = 'pro';
        this.licenseKey = trimmed;
        this.activatedAt = Date.now();
        return {
          success: true,
          message: 'ShipWizard Pro Lifetime activated successfully! Enjoy automated auto-healing and BYOK pipelines.',
        };
      }
      return {
        success: false,
        message: 'License key failed cryptographic signature check.',
      };
    }

    // 3. Online Gumroad API Verification
    try {
      const response = await fetch(LicenseManager.GUMROAD_VERIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          product_permalink: LicenseManager.PRODUCT_PERMALINK,
          product_id: LicenseManager.PRODUCT_ID,
          license_key: trimmed,
        }),
      });

      const data = (await response.json()) as { success: boolean; uses?: number };

      if (data.success) {
        this.tier = 'pro';
        this.licenseKey = trimmed;
        this.activatedAt = Date.now();
        return {
          success: true,
          message: 'ShipWizard Pro Lifetime verified via Gumroad! All Pro features unlocked.',
        };
      }

      return {
        success: false,
        message: 'Gumroad license key verification failed or key is expired/revoked.',
      };
    } catch {
      // Offline fallback: If network is offline, accept valid Gumroad key structure gracefully
      if (this.isGumroadKeyFormat(trimmed)) {
        this.tier = 'pro';
        this.licenseKey = trimmed;
        this.activatedAt = Date.now();
        return {
          success: true,
          message: 'Pro license registered in offline mode. Welcome to ShipWizard Pro!',
        };
      }

      return {
        success: false,
        message: 'Could not connect to Gumroad license server. Check your connection or use an offline key.',
      };
    }
  }

  /**
   * Validates key format (SHIP-PRO-XXXX-XXXX, Gumroad 8-8-8-8, or standard UUID).
   */
  public validateKeyPattern(key: string): boolean {
    if (!key) return false;
    const isShipKey = /^SHIP-PRO-[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/i.test(key);
    return isShipKey || this.isGumroadKeyFormat(key);
  }

  /**
   * Checks if string matches Gumroad license key formats (8-8-8-8 hex blocks or UUID).
   */
  public isGumroadKeyFormat(key: string): boolean {
    if (!key) return false;
    const isGumroad8x4 = /^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}$/i.test(key);
    const isUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key);
    return isGumroad8x4 || isUuid;
  }

  /**
   * Offline cryptographic checksum generation and verification.
   */
  private verifyCryptographicChecksum(key: string): boolean {
    const parts = key.split('-');
    if (parts.length !== 4) return false;
    const payload = parts[2];
    const signature = parts[3];

    const expectedHash = crypto
      .createHmac('sha256', LicenseManager.SALT)
      .update(payload)
      .digest('hex')
      .slice(0, signature.length)
      .toUpperCase();

    return signature.toUpperCase() === expectedHash;
  }

  /**
   * Helper utility to generate valid offline keys for tests and customer issuance.
   */
  public static generateOfflineKey(seed: string): string {
    const payload = seed.toUpperCase().slice(0, 6).padEnd(6, 'X');
    const signature = crypto
      .createHmac('sha256', LicenseManager.SALT)
      .update(payload)
      .digest('hex')
      .slice(0, 6)
      .toUpperCase();

    return `SHIP-PRO-${payload}-${signature}`;
  }
}
