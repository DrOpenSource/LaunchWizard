import { describe, it, expect, vi } from 'vitest';
import { LicenseManager, type StoredLicense } from '../src/core/LicenseManager.js';

const KEY = '6F0E4C97-B72A4E69-A11BF6C4-AF6517E7';
const DAY = 24 * 60 * 60 * 1000;

/** Fake Gumroad: tracks the seat count like the real verify endpoint. */
const fakeGumroad = (initial: { uses?: number; success?: boolean; refunded?: boolean } = {}) => {
  const state = { uses: initial.uses ?? 0, success: initial.success ?? true, refunded: initial.refunded ?? false, offline: false };
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (state.offline) throw new Error('network down');
    const params = new URLSearchParams(String(init?.body));
    if (params.get('increment_uses_count') === 'true') state.uses += 1;
    return {
      json: async () => ({ success: state.success, uses: state.uses, purchase: { refunded: state.refunded } }),
    } as Response;
  });
  return { state, fetchImpl: fetchImpl as unknown as typeof fetch, calls: fetchImpl };
};

describe('LicenseManager (Gumroad-only, zero cost)', () => {
  it('starts in the free tier', () => {
    const status = new LicenseManager({ machineId: 'm1' }).getStatus();
    expect(status).toMatchObject({ tier: 'free', isActivated: false, paused: false, maxMachines: 3 });
  });

  it('rejects keys that are not Gumroad keys, including the retired SHIP-PRO format', async () => {
    const lm = new LicenseManager({ machineId: 'm1', fetchImpl: fakeGumroad().fetchImpl });
    expect((await lm.activateLicense('SHIP-PRO-DEV001-ABC123')).success).toBe(false);
    expect((await lm.activateLicense('invalid-key')).success).toBe(false);
  });

  it('activates a valid key and spends exactly one seat', async () => {
    const g = fakeGumroad();
    const lm = new LicenseManager({ machineId: 'm1', fetchImpl: g.fetchImpl });
    const result = await lm.activateLicense(KEY);
    expect(result.success).toBe(true);
    expect(result.message).toContain('LaunchWizard Pro activated');
    expect(g.state.uses).toBe(1);
    expect(lm.getStatus()).toMatchObject({ tier: 'pro', isActivated: true, uses: 1, key: '6F0E…17E7' });
  });

  it('re-activating on the same machine never spends another seat', async () => {
    const g = fakeGumroad();
    const lm = new LicenseManager({ machineId: 'm1', fetchImpl: g.fetchImpl });
    await lm.activateLicense(KEY);
    await lm.activateLicense(KEY);
    expect(g.state.uses).toBe(1);
  });

  it('refuses a 4th machine without spending a seat', async () => {
    const g = fakeGumroad({ uses: 3 });
    const lm = new LicenseManager({ machineId: 'm4', fetchImpl: g.fetchImpl });
    const result = await lm.activateLicense(KEY);
    expect(result.success).toBe(false);
    expect(result.message).toContain('already active on 3 machines');
    expect(g.state.uses).toBe(3);
    expect(lm.isPro()).toBe(false);
  });

  it('never grants Pro offline for a key that was never verified', async () => {
    const g = fakeGumroad();
    g.state.offline = true;
    const lm = new LicenseManager({ machineId: 'm1', fetchImpl: g.fetchImpl });
    const result = await lm.activateLicense(KEY);
    expect(result.success).toBe(false);
    expect(lm.isPro()).toBe(false);
  });

  it('refuses refunded purchases and unknown keys', async () => {
    expect((await new LicenseManager({ machineId: 'm1', fetchImpl: fakeGumroad({ refunded: true }).fetchImpl }).activateLicense(KEY)).success).toBe(false);
    expect((await new LicenseManager({ machineId: 'm1', fetchImpl: fakeGumroad({ success: false }).fetchImpl }).activateLicense(KEY)).success).toBe(false);
  });

  describe('background re-check and offline grace', () => {
    const stored = (verifiedAt: number): StoredLicense => ({
      key: KEY,
      machineIdHash: LicenseManager.hashMachineId('m1'),
      activatedAt: 0,
      verifiedAt,
      uses: 1,
    });

    it('keeps Pro offline within 30 days, then pauses it', () => {
      let now = 10 * DAY;
      const lm = new LicenseManager({ machineId: 'm1', stored: stored(0), now: () => now });
      expect(lm.isPro()).toBe(true);
      now = 31 * DAY;
      expect(lm.getStatus()).toMatchObject({ tier: 'free', paused: true });
    });

    it('asks for a re-check after 7 days, without spending a seat', async () => {
      const g = fakeGumroad({ uses: 1 });
      let now = 8 * DAY;
      const lm = new LicenseManager({ machineId: 'm1', stored: stored(0), fetchImpl: g.fetchImpl, now: () => now });
      expect(lm.needsRefresh()).toBe(true);
      expect(await lm.refresh()).toBe('verified');
      expect(g.state.uses).toBe(1);
      expect(lm.needsRefresh()).toBe(false);
      // 29 days after the day-8 re-check: still inside the grace window.
      now = 37 * DAY;
      expect(lm.isPro()).toBe(true);
    });

    it('downgrades to Free when the purchase is refunded later', async () => {
      const g = fakeGumroad({ uses: 1, refunded: true });
      const lm = new LicenseManager({ machineId: 'm1', stored: stored(Date.now()), fetchImpl: g.fetchImpl });
      expect(await lm.refresh()).toBe('revoked');
      expect(lm.isPro()).toBe(false);
      expect(lm.toStored()).toBeUndefined();
    });

    it('keeps the license when the re-check is offline', async () => {
      const g = fakeGumroad();
      g.state.offline = true;
      const lm = new LicenseManager({ machineId: 'm1', stored: stored(Date.now()), fetchImpl: g.fetchImpl });
      expect(await lm.refresh()).toBe('offline');
      expect(lm.isPro()).toBe(true);
    });

    it('ignores a license stored for a different machine (e.g. synced settings)', () => {
      const lm = new LicenseManager({ machineId: 'other-machine', stored: stored(Date.now()) });
      expect(lm.isPro()).toBe(false);
    });
  });
});
