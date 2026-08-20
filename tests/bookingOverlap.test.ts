import { describe, it, expect } from 'vitest';
import {
  isBookingOverlapViolation,
  BOOKING_OVERLAP_CONSTRAINT,
  BOOKING_OVERLAP_MESSAGE,
} from '../src/backend/utils/bookingOverlap';

describe('isBookingOverlapViolation', () => {
  it('recognises the real Postgres error text Prisma surfaces', () => {
    // Verbatim from a real violation captured against Postgres 16.
    const err = new Error(
      'conflicting key value violates exclusion constraint "booking_no_overlapping_active_dates"'
    );
    expect(isBookingOverlapViolation(err)).toBe(true);
  });

  it('recognises the violation when it arrives as a Prisma raw-query error', () => {
    expect(isBookingOverlapViolation({
      code: 'P2010',
      meta: { code: '23P01', message: `constraint "${BOOKING_OVERLAP_CONSTRAINT}"` },
    })).toBe(true);
  });

  it('recognises a bare SQLSTATE 23P01 on a Booking write', () => {
    expect(isBookingOverlapViolation({
      code: '23P01',
      message: 'exclusion_violation on relation Booking',
    })).toBe(true);
  });

  it('does NOT claim an unrelated exclusion constraint is a booking clash', () => {
    // Guards against a future exclusion constraint elsewhere being mis-reported
    // to a user as "this car is already booked".
    expect(isBookingOverlapViolation({
      code: '23P01',
      message: 'conflicting key value violates exclusion constraint "blackout_no_overlap"',
    })).toBe(false);
  });

  it('ignores ordinary errors', () => {
    expect(isBookingOverlapViolation(new Error('connection refused'))).toBe(false);
    expect(isBookingOverlapViolation({ code: 'P2002' })).toBe(false);
    expect(isBookingOverlapViolation({ code: 'P2034' })).toBe(false);
  });

  it('is safe against null, undefined and primitives', () => {
    for (const v of [null, undefined, 'string', 42, true, Symbol('x')]) {
      expect(isBookingOverlapViolation(v)).toBe(false);
    }
  });

  it('exposes one shared message so guest and admin paths cannot drift', () => {
    expect(BOOKING_OVERLAP_MESSAGE).toMatch(/already booked/i);
  });
});
