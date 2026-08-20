import { describe, it, expect, vi, beforeEach } from 'vitest';

// PayoutEngine pulls the live split from the settings store (admin-editable)
// and falls back to config. Both are mocked so the arithmetic is the only
// thing under test — no DB, no cron, no Razorpay.
const settings = vi.hoisted(() => ({ values: {} as Record<string, unknown> }));
vi.mock('../src/backend/services/settingsService', () => ({
  getSetting: async (key: string, fallback: unknown) =>
    key in settings.values ? settings.values[key] : fallback,
}));
vi.mock('@prisma/client', () => ({
  PrismaClient: class { constructor() { /* never touched by splitAmount */ } },
  PayoutStatus: { HELD_IN_ESCROW: 'HELD_IN_ESCROW', QUEUED_FOR_N1: 'QUEUED_FOR_N1', SETTLED: 'SETTLED', FAILED: 'FAILED' },
  BookingStatus: {},
  Prisma: {},
}));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }));

import { PayoutEngine } from '../src/backend/services/payoutEngine';

beforeEach(() => { settings.values = {}; });

describe('PayoutEngine.splitAmount — the 70/30 commission split', () => {
  it('splits a plain booking 70% host / 30% platform', async () => {
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(10000);
    expect(platformFee).toBe(3000);
    expect(hostPayout).toBe(7000);
  });

  it('never lets the two sides exceed the gross amount', async () => {
    for (const amount of [1, 99.99, 1234.56, 10000, 87654.32]) {
      const { platformFee, hostPayout } = await PayoutEngine.splitAmount(amount);
      // Rounding each side independently can lose or gain a paise; what must
      // never happen is paying out MORE than was collected.
      expect(platformFee + hostPayout).toBeLessThanOrEqual(amount + 0.01);
      expect(platformFee).toBeGreaterThanOrEqual(0);
      expect(hostPayout).toBeGreaterThanOrEqual(0);
    }
  });

  it('pays a delivery fee 100% to the host and takes no commission on it', async () => {
    // The platform does not do the driving, so it does not take a cut.
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(11000, 1000);
    expect(platformFee).toBe(3000);        // 30% of the 10000 commissionable part
    expect(hostPayout).toBe(7000 + 1000);  // 70% + the full passthrough
    expect(platformFee + hostPayout).toBe(11000);
  });

  it('handles a booking that is entirely passthrough', async () => {
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(500, 500);
    expect(platformFee).toBe(0);
    expect(hostPayout).toBe(500);
  });

  it('clamps rather than going negative when passthrough exceeds the total', async () => {
    // Defensive: a data error must not produce a negative platform fee, which
    // would silently pay the host more than was ever collected.
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(100, 500);
    expect(platformFee).toBe(0);
    expect(hostPayout).toBeGreaterThanOrEqual(0);
  });

  it('uses the admin-configured split over the config default', async () => {
    settings.values.commission_percentage = 0.25;
    settings.values.host_share_percentage = 0.75;
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(10000);
    expect(platformFee).toBe(2500);
    expect(hostPayout).toBe(7500);
  });

  it('supports a promotional 75/25 host split without over-paying', async () => {
    // The host switch-guarantee offer in the strategy pack. Confirms the
    // engine can express it and that it still balances.
    settings.values.commission_percentage = 0.25;
    settings.values.host_share_percentage = 0.75;
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(5500, 300);
    expect(platformFee).toBe(1300);          // 25% of 5200
    expect(hostPayout).toBe(3900 + 300);     // 75% of 5200 + passthrough
    expect(platformFee + hostPayout).toBe(5500);
  });

  it('rounds to paise, never to more precision than money has', async () => {
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(333.33);
    expect(platformFee).toBe(Number(platformFee.toFixed(2)));
    expect(hostPayout).toBe(Number(hostPayout.toFixed(2)));
  });

  it('returns zeroes for a zero-amount booking', async () => {
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(0);
    expect(platformFee).toBe(0);
    expect(hostPayout).toBe(0);
  });

  it('clamps a misconfigured split so the platform can never overpay', async () => {
    // commission and host share are independent admin settings, so they can
    // be set to sum above 1. Left unguarded that overpays every host on every
    // booking, silently. splitAmount clamps the host to what's left.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    settings.values.commission_percentage = 0.30;
    settings.values.host_share_percentage = 0.80; // sums to 1.10
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(10000);
    expect(platformFee).toBe(3000);
    expect(hostPayout).toBe(7000);                 // clamped from 8000
    expect(platformFee + hostPayout).toBe(10000);  // never exceeds gross
    expect(err).toHaveBeenCalled();                // and it is loud about it
    err.mockRestore();
  });

  it('leaves a deliberately generous-but-valid split alone', async () => {
    // 0.25 + 0.75 sums to exactly 1 and must NOT be clamped — the guard has
    // to distinguish a promotional split from a misconfiguration.
    settings.values.commission_percentage = 0.25;
    settings.values.host_share_percentage = 0.75;
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(10000);
    expect(platformFee).toBe(2500);
    expect(hostPayout).toBe(7500);
  });

  it('clamps the host to zero if commission alone is set above 100%', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    settings.values.commission_percentage = 1.5;
    settings.values.host_share_percentage = 0.7;
    const { hostPayout } = await PayoutEngine.splitAmount(10000);
    expect(hostPayout).toBe(0);
    expect(hostPayout).toBeGreaterThanOrEqual(0);
    err.mockRestore();
  });
});
