import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { computeDepositDeduction } from '../src/backend/utils/depositDeduction';

/**
 * The two invariants every case must satisfy. If either breaks, money has
 * either been created or destroyed.
 */
function assertReconciles(approved: number, deposit: number) {
  const r = computeDepositDeduction(approved, deposit);
  expect(r.depositPortion + r.remainder).toBeCloseTo(Math.max(0, deposit), 2);
  expect(r.depositPortion + r.excessPortion).toBeCloseTo(Math.max(0, approved), 2);
  return r;
}

describe('computeDepositDeduction', () => {
  it('its local status union still matches the real Prisma enum', () => {
    // depositDeduction.ts declares the two status strings locally so it stays
    // dependency-free. This asserts against the schema itself, so renaming the
    // enum in Prisma without updating the util fails here rather than at runtime.
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const block = schema.slice(schema.indexOf('enum BookingDepositStatus'));
    const body = block.slice(0, block.indexOf('}'));
    expect(body).toContain('PARTIALLY_DEDUCTED');
    expect(body).toContain('FORFEITED');
  });

  it('takes a partial deduction and refunds the rest', () => {
    const r = assertReconciles(2000, 5000);
    expect(r.depositPortion).toBe(2000);
    expect(r.remainder).toBe(3000);
    expect(r.excessPortion).toBe(0);
    expect(r.forfeited).toBe(false);
    expect(r.depositStatus).toBe('PARTIALLY_DEDUCTED');
  });

  it('forfeits the deposit when the deduction exactly equals it', () => {
    const r = assertReconciles(5000, 5000);
    expect(r.depositPortion).toBe(5000);
    expect(r.remainder).toBe(0);
    expect(r.excessPortion).toBe(0);
    expect(r.forfeited).toBe(true);
    expect(r.depositStatus).toBe('FORFEITED');
  });

  it('bills the guest the excess when damage exceeds the deposit', () => {
    const r = assertReconciles(8000, 5000);
    expect(r.depositPortion).toBe(5000);
    expect(r.remainder).toBe(0);
    expect(r.excessPortion).toBe(3000);
    expect(r.forfeited).toBe(true);
  });

  it('never refunds more than the deposit that was actually held', () => {
    for (const [approved, deposit] of [[1, 5000], [4999.99, 5000], [5000.01, 5000], [999999, 5000]]) {
      const r = assertReconciles(approved, deposit);
      expect(r.remainder).toBeLessThanOrEqual(deposit);
      expect(r.remainder).toBeGreaterThanOrEqual(0);
      expect(r.depositPortion).toBeLessThanOrEqual(deposit);
    }
  });

  it('handles a one-paise-under deduction without rounding the guest out of their refund', () => {
    const r = assertReconciles(4999.99, 5000);
    expect(r.remainder).toBe(0.01);
    expect(r.forfeited).toBe(false);
    expect(r.depositStatus).toBe('PARTIALLY_DEDUCTED');
  });

  it('treats a zero deposit as fully forfeited with everything billed as excess', () => {
    // A PREMIUM-protection booking can legitimately hold a small or zero
    // deposit; the whole approved amount then has to be billed separately.
    const r = assertReconciles(3000, 0);
    expect(r.depositPortion).toBe(0);
    expect(r.remainder).toBe(0);
    expect(r.excessPortion).toBe(3000);
    expect(r.forfeited).toBe(true);
  });

  it('clamps negative inputs instead of inverting the calculation', () => {
    const r = computeDepositDeduction(-500, 5000);
    expect(r.depositPortion).toBe(0);
    expect(r.remainder).toBe(5000);
    expect(r.excessPortion).toBe(0);
    expect(r.forfeited).toBe(false);

    const r2 = computeDepositDeduction(1000, -5000);
    expect(r2.remainder).toBe(0);
    expect(r2.excessPortion).toBe(1000);
  });

  it('rounds every money field to paise', () => {
    const r = computeDepositDeduction(1234.567, 5000.123);
    for (const v of [r.depositPortion, r.remainder, r.excessPortion]) {
      expect(v).toBe(Number(v.toFixed(2)));
    }
  });

  it('reconciles across a broad sweep of amounts', () => {
    for (let deposit = 0; deposit <= 12000; deposit += 1500) {
      for (let approved = 0; approved <= 15000; approved += 1250) {
        assertReconciles(approved, deposit);
      }
    }
  });
});
