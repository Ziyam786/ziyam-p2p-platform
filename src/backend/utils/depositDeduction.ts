/**
 * Mirrors the BookingDepositStatus values this function can return. Declared
 * locally rather than imported from @prisma/client so the money arithmetic
 * here has no dependency on a generated client — it stays a pure, directly
 * testable function. The two values are asserted against the real Prisma enum
 * in tests/depositDeduction.test.ts, so a schema rename cannot drift silently.
 */
export type DeductionDepositStatus = 'PARTIALLY_DEDUCTED' | 'FORFEITED';

export interface DepositDeduction {
  /** How much of the approved deduction the held deposit actually covers. */
  depositPortion: number;
  /** What is left of the deposit and must be refunded to the guest. */
  remainder: number;
  /** How much of the approved deduction the deposit does NOT cover — billed to the guest separately. */
  excessPortion: number;
  /** True when the deposit is fully consumed. */
  forfeited: boolean;
  /** The status the booking's deposit moves to. */
  depositStatus: DeductionDepositStatus;
}

/**
 * Splits an admin-approved damage deduction against the deposit held for a
 * booking.
 *
 * Extracted from damageClaim.routes.ts so the arithmetic that decides how much
 * of a guest's money is kept can be tested directly. Every branch here moves
 * real money in one of three directions — kept by the platform, refunded to
 * the guest, or billed to the guest as an excess charge — and the three must
 * always reconcile:
 *
 *     depositPortion + remainder === depositAmount
 *     depositPortion + excessPortion === approvedDeduction
 *
 * Both invariants are asserted in the tests for every case.
 */
export function computeDepositDeduction(
  approvedDeduction: number,
  depositAmount: number
): DepositDeduction {
  // Negative inputs would invert the whole calculation and refund a guest more
  // than they paid, so clamp rather than trust the caller. The route also
  // rejects approvedDeduction <= 0 before reaching here; this is the
  // arithmetic-level backstop.
  const deduction = Math.max(0, approvedDeduction);
  const deposit = Math.max(0, depositAmount);

  const depositPortion = Math.min(deduction, deposit);
  const remainder = Number((deposit - depositPortion).toFixed(2));
  const excessPortion = Number(Math.max(0, deduction - deposit).toFixed(2));
  const forfeited = remainder <= 0;

  return {
    depositPortion: Number(depositPortion.toFixed(2)),
    remainder,
    excessPortion,
    forfeited,
    depositStatus: forfeited ? 'FORFEITED' : 'PARTIALLY_DEDUCTED',
  };
}
