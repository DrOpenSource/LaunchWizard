import { describe, it, expect } from 'vitest';
import { LicenseManager } from '../src/core/LicenseManager.js';

describe('LicenseManager', () => {
  it('initializes in free tier by default', () => {
    const manager = new LicenseManager();
    const status = manager.getStatus();

    expect(status.tier).toBe('free');
    expect(status.isActivated).toBe(false);
  });

  it('validates key format pattern correctly', () => {
    const manager = new LicenseManager();

    expect(manager.validateKeyPattern('SHIP-PRO-ABCD12-E5F6A7')).toBe(true);
    expect(manager.validateKeyPattern('c8a41234-abcd-4a3b-9e21-0123456789ab')).toBe(true);
    expect(manager.validateKeyPattern('invalid-key')).toBe(false);
    expect(manager.validateKeyPattern('')).toBe(false);
  });

  it('activates successfully with valid cryptographic offline key', async () => {
    const manager = new LicenseManager();
    const validKey = LicenseManager.generateOfflineKey('DEV001');

    const result = await manager.activateLicense(validKey);
    expect(result.success).toBe(true);
    expect(result.message).toContain('ShipWizard Pro Lifetime activated');

    const status = manager.getStatus();
    expect(status.tier).toBe('pro');
    expect(status.isActivated).toBe(true);
    expect(status.key).toBe(validKey);
  });

  it('rejects tampered or forged offline license keys', async () => {
    const manager = new LicenseManager();
    const forgedKey = 'SHIP-PRO-DEV001-FORGED';

    const result = await manager.activateLicense(forgedKey);
    expect(result.success).toBe(false);
    expect(result.message).toContain('failed cryptographic signature check');

    const status = manager.getStatus();
    expect(status.tier).toBe('free');
    expect(status.isActivated).toBe(false);
  });
});
