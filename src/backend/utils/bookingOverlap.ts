/**
 * The name of the Postgres exclusion constraint added in
 * prisma/migrations/20260820160000_booking_no_overlap_exclusion. It makes
 * overlapping active bookings for the same car structurally impossible at the
 * storage layer, independently of whatever check the calling route does.
 */
export const BOOKING_OVERLAP_CONSTRAINT = 'booking_no_overlapping_active_dates';

/** Postgres SQLSTATE for exclusion_violation. */
const EXCLUSION_VIOLATION = '23P01';

/**
 * True when an error is our booking-overlap exclusion constraint firing.
 *
 * Prisma does not model exclusion constraints, so depending on the client
 * version and call shape this surfaces as a PrismaClientUnknownRequestError,
 * a P2010 raw-query error, or a driver error carrying the SQLSTATE — none of
 * which are a stable single code to match on. We therefore check the
 * constraint name and the SQLSTATE across the places they can appear, and
 * deliberately match on OUR constraint name rather than on 23P01 alone, so a
 * future unrelated exclusion constraint cannot be silently reported to a user
 * as "this car is already booked".
 */
export function isBookingOverlapViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; meta?: unknown; message?: unknown };

  const haystack = [
    typeof e.message === 'string' ? e.message : '',
    typeof e.code === 'string' ? e.code : '',
    e.meta ? JSON.stringify(e.meta) : '',
  ].join(' ');

  return haystack.includes(BOOKING_OVERLAP_CONSTRAINT)
    || (haystack.includes(EXCLUSION_VIOLATION) && haystack.toLowerCase().includes('booking'));
}

/** The single message both booking paths return, so guests and admins see the same wording. */
export const BOOKING_OVERLAP_MESSAGE = 'This car is already booked for part of the selected dates';
