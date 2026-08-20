import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient, BookingStatus, RefundRequestType, CancelledBy, TripStage, PhotoAngle } from '@prisma/client';
import { randomInt, randomUUID } from 'crypto';
import paymentGateway from '../services/paymentGateway';
import { PayoutEngine } from '../services/payoutEngine';
import { TelematicsService } from '../services/telematicsService';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { pickLeastLoadedAgent } from '../services/agentAssignment';
import { safeErrorMessage } from '../utils/errorResponse';
import { isFirebaseConfigured, getFirestoreClient } from '../services/firebaseAdmin';

// Best-effort mirror write to Firestore for real-time delivery-location/
// chat updates (see LiveDeliveryTracker.tsx / TripChat.tsx's onSnapshot
// listeners) — Postgres stays the system of record for both; this never
// blocks or fails the actual request if Firestore is unconfigured or the
// write itself fails, since the REST routes already work standalone
// (the frontend falls back to polling when Firebase isn't configured).
/** Thrown inside the booking-creation transaction to distinguish an intentional 409 conflict from any other transaction failure. */
class BookingConflictError extends Error {}

function mirrorToFirestore(collectionPath: string, docId: string, data: Record<string, unknown>): void {
  if (!isFirebaseConfigured()) return;
  getFirestoreClient()
    .collection(collectionPath)
    .doc(docId)
    .set(data, { merge: true })
    .catch((err: any) => console.error('[FIRESTORE MIRROR] Failed to write %s/%s:', collectionPath, docId, err.message ?? err));
}

// Firestore Security Rules can't query Postgres to check who a booking's
// guest/host actually are — this mirrors just those two IDs into Firestore
// itself so firestore.rules can compare them against request.auth.uid.
// Idempotent (merge: true), called alongside every real mirror write so the
// participants doc always exists before a client tries to read the
// protected delivery-location/chat documents.
function mirrorBookingParticipants(bookingId: string, customerId: string, hostId: string): void {
  mirrorToFirestore('bookingParticipants', bookingId, { customerId, hostId });
}

const WASH_SERVICE_PRICE = 349;

import { isBookingOverlapViolation, BOOKING_OVERLAP_MESSAGE } from '../utils/bookingOverlap';
const router = Router();
const prisma = new PrismaClient();

const VALID_PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
const REFERRAL_REWARD = 500; // ₹ credited to the referrer once their referred user completes their first trip

// What fraction of Car.securityDeposit is actually held per protection plan —
// matches the "Reduced deposit hold" / "Lowest deposit hold" copy already
// shown in the checkout UI's plan picker (src/frontend/app/cars/[id]/page.tsx),
// which until now was description text only with no backing calculation.
const DEPOSIT_HOLD_FRACTION: Record<string, number> = { BASIC: 1, STANDARD: 0.6, PREMIUM: 0.3 };

// Two-stage checkout — see /checkout-session and /balance-checkout-session below.
const RESERVATION_FEE_PERCENT = 0.10;
const RESERVATION_FEE_MIN = 299;

// Late-return fee — see the /complete handler below.
const LATE_FEE_GRACE_HOURS = 0.5;
const MAX_LATE_FEE_HOURS = 24; // beyond this, admin/support handles it manually rather than auto-charging further
const LATE_FEE_MULTIPLIER = 1.5;

// The 4 angles a pickup/drop-off photo set must cover before /start or
// /complete will succeed — mirrors and odometer are captured too (see
// PhotoAngle) but stay optional, since only these four are load-bearing for
// a damage dispute.
const REQUIRED_PHOTO_ANGLES: PhotoAngle[] = [PhotoAngle.FRONT, PhotoAngle.REAR, PhotoAngle.LEFT, PhotoAngle.RIGHT];

async function hasRequiredConditionPhotos(bookingId: string, stage: TripStage): Promise<boolean> {
  const rows = await prisma.bookingConditionPhoto.findMany({
    where: { bookingId, stage, angle: { in: REQUIRED_PHOTO_ANGLES } },
    select: { angle: true },
  });
  const distinctAngles = new Set(rows.map((r) => r.angle));
  return REQUIRED_PHOTO_ANGLES.every((a) => distinctAngles.has(a));
}

/**
 * Credits a referrer's Z-Credits-style wallet the first (and only the first)
 * time a user they referred completes a trip — avoids reward-farming via
 * repeat bookings or fake signups with no real trip.
 */
async function creditReferralRewardIfFirstTrip(customerId: string) {
  const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { referredById: true } });
  if (!customer?.referredById) return;

  const completedTripCount = await prisma.booking.count({ where: { customerId, status: BookingStatus.COMPLETED } });
  if (completedTripCount !== 1) return; // only the referred user's very first completed trip triggers the reward

  const referrer = await prisma.user.update({
    where: { id: customer.referredById },
    data: { creditsBalance: { increment: REFERRAL_REWARD } },
  });
  await notify(
    referrer.id,
    'GENERIC',
    "You've earned a referral reward!",
    `Your referral completed their first trip — ₹${REFERRAL_REWARD} has been credited to your account.`,
    '/account'
  );
}

// Create a booking (no payment yet — the checkout page opens a Razorpay Order separately)
router.post('/booking', requireAuth, async (req: Request, res: Response) => {
  const { carId, startTime, endTime, totalAmount, protectionPlan, deliveryRequested, promoCode, coDriverRequested, coDriverName, coDriverLicenseNumber } = req.body;
  const customerId = req.user!.userId;

  if (!carId || !startTime || !endTime || !totalAmount) {
    return res.status(400).json({ error: 'carId, startTime, endTime, and totalAmount are required' });
  }
  if (coDriverRequested && (!String(coDriverName ?? '').trim() || !String(coDriverLicenseNumber ?? '').trim())) {
    return res.status(400).json({ error: 'Co-driver name and license number are required when adding a co-driver' });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) {
    return res.status(400).json({ error: 'endTime must be after startTime' });
  }

  try {
    // KYC is mandatory for both sides of a trip — hosts are already gated at
    // listing time (see host.routes.ts), this closes the matching gap for guests.
    const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { isKycVerified: true, isDrivingLicenseVerified: true } });
    if (!customer?.isKycVerified) {
      return res.status(403).json({ error: 'Please complete KYC verification before booking a car.', code: 'KYC_REQUIRED' });
    }
    // Identity KYC alone doesn't confirm someone can legally drive — this is
    // a brand-new check (see /kyc/driving-license) so most existing guests
    // won't have done it yet; the error code lets the frontend route them
    // straight to that step instead of a generic failure.
    if (!customer.isDrivingLicenseVerified) {
      return res.status(403).json({ error: 'Please verify your driving license before booking a car.', code: 'DRIVING_LICENSE_REQUIRED' });
    }

    const car = await prisma.car.findUnique({ where: { id: carId }, include: { owner: true } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (!car.isAvailable) return res.status(409).json({ error: 'Car is no longer available' });
    // Verification existing (PENDING_REVIEW badge, admin review queue) means
    // nothing if an unreviewed car can still be booked — this is the actual
    // enforcement point. Cars auto-VERIFIED before this gate existed stay
    // bookable; anything PENDING/PENDING_REVIEW/REJECTED needs a real
    // admin pass first (see PATCH /admin/cars/:id/verification).
    if (car.verificationStatus !== 'VERIFIED') {
      return res.status(422).json({ error: 'This car is still pending document verification and cannot be booked yet.', code: 'CAR_NOT_VERIFIED' });
    }
    if (!car.owner.payoutAccountId || !car.owner.bankAccountVerified) {
      return res.status(422).json({ error: 'Host payout account not configured' });
    }
    // A car isn't legally roadworthy (or, for insurance, isn't actually
    // covered) once any of these lapse — block new bookings rather than
    // silently letting a guest drive an uninsured/unregistered car.
    const now = new Date();
    if (car.insuranceExpiry && car.insuranceExpiry < now) {
      return res.status(422).json({ error: 'This car\'s insurance has expired and is unavailable until the host renews it.' });
    }
    if (car.rcExpiry && car.rcExpiry < now) {
      return res.status(422).json({ error: 'This car\'s registration (RC) has expired and is unavailable until the host renews it.' });
    }
    if (car.pucExpiry && car.pucExpiry < now) {
      return res.status(422).json({ error: 'This car\'s pollution certificate (PUC) has expired and is unavailable until the host renews it.' });
    }
    if (deliveryRequested && !car.offersDelivery) {
      return res.status(400).json({ error: 'This host does not offer delivery' });
    }

    let normalizedPromo: string | null = null;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: String(promoCode).toUpperCase() } });
      if (!promo || !promo.active || (promo.expiresAt && promo.expiresAt < new Date()) || (promo.maxUses !== null && promo.usedCount >= promo.maxUses)) {
        return res.status(400).json({ error: 'Promo code is no longer valid' });
      }
      normalizedPromo = promo.code;
    }

    // Snapshot now — Car.deliveryFee is host-editable, so this pins what was
    // actually quoted at booking time. Passed through 100% to the host/fleet
    // operator, never commissioned (see PayoutEngine.splitAmount).
    const deliveryFeeAmount = deliveryRequested ? car.deliveryFee : 0;
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(totalAmount, deliveryFeeAmount);

    // Server-computed, not client-supplied — the deposit fraction can't be
    // tampered with by sending a lower totalAmount. Charged alongside
    // totalAmount at the Razorpay checkout-session step (not folded into
    // totalAmount itself, since totalAmount also drives PayoutEngine.splitAmount
    // at trip completion and the deposit isn't host revenue to split).
    const resolvedPlan = VALID_PLANS.includes(protectionPlan) ? protectionPlan : 'BASIC';
    const depositAmount = Math.round((car.securityDeposit ?? 0) * (DEPOSIT_HOLD_FRACTION[resolvedPlan] ?? 1));
    // Small reservation fee charged first — see /checkout-session below and
    // RESERVATION_FEE_MIN/PERCENT. Server-computed, same tamper-proofing as depositAmount.
    const reservationFeeAmount = Math.max(RESERVATION_FEE_MIN, Math.round(totalAmount * RESERVATION_FEE_PERCENT));

    // The overlap/blackout check and the create must happen as one atomic
    // unit — a plain findFirst-then-create (the previous shape of this
    // code) lets two concurrent requests both pass the check before either
    // commits, double-booking the car. Serializable isolation makes
    // Postgres detect that write-write conflict and abort the loser with a
    // P2034 error, which we translate back into the same 409 the
    // pre-existing (non-atomic) check used to return — see
    // specs/001-flutter-renter-app/research.md's Principle III fix.
    let bookingId: string;
    try {
      bookingId = await prisma.$transaction(
        async (tx) => {
          // PENDING_PAYMENT counts as holding the slot (prevents a race
          // where two renters both start checkout for the same dates) — in
          // production these should also auto-expire after a short window
          // so an abandoned checkout doesn't permanently lock dates.
          const conflictingBooking = await tx.booking.findFirst({
            where: {
              carId,
              status: { notIn: [BookingStatus.CANCELLED] },
              startTime: { lt: end },
              endTime: { gt: start },
            },
          });
          if (conflictingBooking) {
            throw new BookingConflictError('This car is already booked for part of the selected dates');
          }

          const conflictingBlackout = await tx.blackout.findFirst({
            where: { carId, startDate: { lt: end }, endDate: { gt: start } },
          });
          if (conflictingBlackout) {
            throw new BookingConflictError('The host has blocked out part of the selected dates');
          }

          const created = await tx.booking.create({
            data: {
              id: randomUUID(),
              carId,
              customerId,
              startTime: start,
              endTime: end,
              totalAmount,
              platformFee,
              hostPayoutAmount: hostPayout,
              depositAmount,
              reservationFeeAmount,
              protectionPlan: resolvedPlan,
              deliveryRequested: Boolean(deliveryRequested),
              deliveryFeeAmount,
              coDriverRequested: Boolean(coDriverRequested),
              coDriverName: coDriverRequested ? String(coDriverName).trim() : null,
              coDriverLicenseNumber: coDriverRequested ? String(coDriverLicenseNumber).trim() : null,
              promoCode: normalizedPromo,
              status: BookingStatus.PENDING_PAYMENT,
            },
          });
          return created.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error instanceof BookingConflictError) {
        return res.status(409).json({ error: error.message });
      }
      // P2034: Prisma/Postgres detected the serialization conflict itself —
      // the losing request's overlap check would have passed, so this IS a
      // double-booking attempt, not a generic failure.
      if (error?.code === 'P2034') {
        return res.status(409).json({ error: BOOKING_OVERLAP_MESSAGE });
      }
      // Belt and braces: the serializable transaction above should already
      // have caught any real race as P2034, but the database's exclusion
      // constraint is the backstop that holds even if this path is ever
      // refactored to a weaker isolation level.
      if (isBookingOverlapViolation(error)) {
        return res.status(409).json({ error: BOOKING_OVERLAP_MESSAGE });
      }
      throw error;
    }

    res.status(201).json({ success: true, bookingId });
  } catch (error: any) {
    console.error('[POST /booking] failed:', error);
    res.status(500).json({ error: `Booking failed: ${safeErrorMessage(error)}` });
  }
});

// Starts (or restarts) a Razorpay order for a pending booking — STAGE 1 of
// the two-stage checkout: charges only reservationFeeAmount, not the full
// trip cost. Holds the dates so the guest can review everything with real
// confidence before committing the rest of the money (see
// /balance-checkout-session below). Real confirmation only ever happens via
// the signature-verified /payments/razorpay/verify call or webhook, never
// from here.
router.post('/booking/:id/checkout-session', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, customer: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return res.status(400).json({ error: `Cannot start checkout from status ${booking.status}` });
  }

  try {
    const checkout = await paymentGateway.initiateCheckout({
      amount: booking.reservationFeeAmount,
      receipt: `booking_${booking.id.slice(0, 20)}_reservation`,
      notes: { kind: 'booking_reservation', bookingId: booking.id },
    });

    await prisma.booking.update({ where: { id }, data: { paymentIntentId: checkout.orderId } });

    res.json({ success: true, data: checkout });
  } catch (error: any) {
    console.error('[checkout-session] payment init failed:', error);
    res.status(502).json({ error: `Could not start payment: ${safeErrorMessage(error)}` });
  }
});

// STAGE 2 of the two-stage checkout — charges the remaining balance
// (trip cost + platform fee + full deposit, minus the reservation fee
// already paid) once the guest is ready to commit. Only valid from RESERVED;
// success moves the booking into the existing host-review flow (see
// razorpayPaymentHandler.ts's RESERVED branch).
router.post('/booking/:id/balance-checkout-session', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, customer: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== BookingStatus.RESERVED) {
    return res.status(400).json({ error: `Cannot pay the balance from status ${booking.status}` });
  }

  try {
    // Deposit is charged in the same Razorpay order as the trip cost, not
    // held separately — booking.totalAmount itself stays deposit-exclusive
    // since PayoutEngine.splitAmount reads it at trip completion, and the
    // deposit isn't host revenue to split.
    const balanceAmount = booking.totalAmount + booking.depositAmount - booking.reservationFeeAmount;
    const checkout = await paymentGateway.initiateCheckout({
      amount: balanceAmount,
      receipt: `booking_${booking.id.slice(0, 20)}_balance`,
      notes: { kind: 'booking_balance', bookingId: booking.id },
    });

    await prisma.booking.update({ where: { id }, data: { paymentIntentId: checkout.orderId } });

    res.json({ success: true, data: checkout });
  } catch (error: any) {
    console.error('[checkout-session] payment init failed:', error);
    res.status(502).json({ error: `Could not start payment: ${safeErrorMessage(error)}` });
  }
});

// The host-only pickup handover code (generated at accept time — see
// hostReview.routes.ts / admin.routes.ts's booking creation).
router.get('/booking/:id/start-otp', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can view this code' });
  if (booking.status !== BookingStatus.CONFIRMED) return res.status(400).json({ error: 'Trip is not confirmed yet' });
  res.json({ success: true, data: { otp: booking.startOtp } });
});

// Start a confirmed trip (pickup) — requires both the PRE_TRIP condition
// photos AND the host-shown handover code, so a trip can't start without
// the two parties actually meeting (same discipline as /complete below).
router.post('/booking/:id/start', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { otp } = req.body;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== BookingStatus.CONFIRMED) {
    return res.status(400).json({ error: `Cannot start trip from status ${booking.status}` });
  }
  if (!booking.startOtp || otp !== booking.startOtp) {
    return res.status(400).json({ error: 'Incorrect pickup code. Ask the host for the code shown in their app.' });
  }
  if (!(await hasRequiredConditionPhotos(id, TripStage.PRE_TRIP))) {
    return res.status(400).json({ error: 'Upload all 4 required pickup photos (front, rear, left, right) before starting the trip.' });
  }

  // Generate the trip-end handover code now — shown only to the host, and
  // required from whoever calls /complete, so a trip can't be closed out
  // without the two parties actually meeting for the handover.
  const endOtp = String(randomInt(1000, 10000));
  const updated = await prisma.booking.update({ where: { id }, data: { status: BookingStatus.ACTIVE, endOtp } });
  await notify(
    booking.car.ownerId,
    'TRIP_STARTED',
    'Trip started',
    `A lessee has picked up your ${booking.car.make} ${booking.car.model}.`,
    '/host/dashboard'
  );
  res.json({ success: true, data: updated });
});

// The host-only trip-end handover code (see /start above).
router.get('/booking/:id/end-otp', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can view this code' });
  if (booking.status !== BookingStatus.ACTIVE) return res.status(400).json({ error: 'Trip is not active' });
  res.json({ success: true, data: { otp: booking.endOtp } });
});

// Mark a trip completed -> release N+1 payout escrow. Requires the trip-end
// handover code the host was shown (see /start and /end-otp above) — proves
// the two parties actually met for the handover rather than either side
// just tapping "done" remotely.
router.post('/booking/:id/complete', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { otp } = req.body;
  try {
    const existing = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    const isCustomer = existing.customerId === req.user!.userId;
    const isHost = existing.car.ownerId === req.user!.userId;
    if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });
    if (existing.status !== BookingStatus.ACTIVE) {
      return res.status(400).json({ error: `Cannot complete trip from status ${existing.status}` });
    }
    if (!existing.endOtp || otp !== existing.endOtp) {
      return res.status(400).json({ error: 'Incorrect trip-end code. Ask the host for the code shown in their app.' });
    }
    if (!(await hasRequiredConditionPhotos(id, TripStage.POST_TRIP))) {
      return res.status(400).json({ error: 'Upload all 4 required drop-off photos (front, rear, left, right) before completing the trip.' });
    }

    // Late-return fee — published in terms/page.tsx §5 ("late fees") but
    // never actually charged until now. Grace period before anything's
    // charged; capped at MAX_LATE_HOURS so an extreme overrun (days late)
    // gets flagged for admin/support rather than auto-charging a runaway
    // amount. Rate is derived from the car's own listed dailyRate — not an
    // invented platform-wide number — at a 1.5x multiplier, the standard
    // "costs more than the normal rate" late-return structure.
    const hoursLate = (Date.now() - existing.endTime.getTime()) / (60 * 60 * 1000);
    const chargeableHours = Math.max(0, Math.min(hoursLate - LATE_FEE_GRACE_HOURS, MAX_LATE_FEE_HOURS));
    const lateFeeAmount = chargeableHours > 0 ? Math.round(chargeableHours * (existing.car.dailyRate / 24) * LATE_FEE_MULTIPLIER) : 0;

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED, lateFeeAmount, lateFeeHours: Math.max(0, hoursLate) },
    });
    if (lateFeeAmount > 0) {
      await notify(
        booking.customerId,
        'GENERIC',
        'Late return fee applied',
        `Returning the ${existing.car.make} ${existing.car.model} ${Math.round(hoursLate)}h late added a ₹${lateFeeAmount.toLocaleString('en-IN')} fee, deducted from your security deposit.`,
        `/account/trips/${booking.id}`
      );
      await notify(
        existing.car.ownerId,
        'GENERIC',
        'Guest returned the car late',
        `${Math.round(hoursLate)}h late — a ₹${lateFeeAmount.toLocaleString('en-IN')} late fee was applied and will come out of the released deposit.`,
        '/host/dashboard'
      );
    }
    await creditReferralRewardIfFirstTrip(booking.customerId);

    // Fleet-managed cars don't schedule a payout here — that only happens once
    // the fleet operator confirms receipt (see /booking/:id/fleet-receipt below).
    if (existing.car.fleetManaged) {
      res.json({ success: true, message: 'Trip completed. Payout will be scheduled once the fleet operator confirms receipt.' });
    } else {
      await PayoutEngine.createEscrowLedger(booking.id);
      res.json({ success: true, message: 'Trip completed. N+1 payout scheduled.' });
    }
  } catch (error: any) {
    console.error('[booking/:id/complete] failed:', error);
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Fleet operator confirms they've received a clear payout from the platform
// for this booking — starts the fleet-managed 1-day host payout window.
router.post('/booking/:id/fleet-receipt', requireAuth, requireRole('FLEET_OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ledger = await PayoutEngine.confirmFleetReceipt(id, req.user!.userId);
    res.json({ success: true, message: 'Receipt confirmed. Host payout scheduled within 1 day.', data: ledger });
  } catch (error: any) {
    console.error('[booking/:id/fleet-receipt] failed:', error);
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Guest opts into a wash service for their booking — pops straight to
// whichever on-duty agent currently has the fewest open jobs (see
// agentAssignment.ts), rather than sitting in a queue nobody owns.
router.post('/booking/:id/wash-service', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { serviceLocation, notes } = req.body;
  try {
    const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
    if (!['ACTIVE', 'COMPLETED'].includes(booking.status)) {
      return res.status(400).json({ error: 'Wash service can only be requested during or after an active trip' });
    }

    const agentId = await pickLeastLoadedAgent();
    const request = await prisma.serviceRequest.create({
      data: {
        carId: booking.carId,
        bookingId: booking.id,
        requestedById: req.user!.userId,
        serviceType: 'Washing',
        priceEstimate: WASH_SERVICE_PRICE,
        scheduledDate: new Date(),
        serviceLocation: serviceLocation || booking.car.address || booking.car.city,
        notes,
        assignedAgentId: agentId,
        status: agentId ? 'CONFIRMED' : 'REQUESTED',
      },
    });

    if (agentId) {
      await notify(agentId, 'GENERIC', 'New wash service assignment', `${booking.car.make} ${booking.car.model} at ${request.serviceLocation}`, '/agent');
    }
    res.status(201).json({ success: true, data: request, message: agentId ? 'An agent has been assigned.' : 'No agents are on duty right now — this will be picked up shortly.' });
  } catch (error: any) {
    console.error('[booking/:id/wash-service] failed:', error);
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Guest-initiated cancellation, before a trip has actually started. Applies
// the tiered refund from the published Refund & Cancellation Policy §3 —
// platform fee is never refunded (§3's "minus... platform fees"); the
// security deposit is always refunded in full since a cancelled trip never
// happened, so there's nothing for it to cover (§8). No live Razorpay refund
// call — creates a RefundRequest for the same manual admin queue the
// deposit-release/damage-claim flows already use.
router.post('/bookings/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  const cancellableStatuses: BookingStatus[] = [BookingStatus.RESERVED, BookingStatus.PENDING_HOST_REVIEW, BookingStatus.CONFIRMED];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking with status ${booking.status}` });
  }

  // A RESERVED booking has only ever collected reservationFeeAmount — the
  // tiered trip-cost/deposit refund math below assumes the balance was paid
  // (true from PENDING_HOST_REVIEW onward), so it doesn't apply here.
  // Cancelling forfeits the reservation fee, same as letting it expire
  // (see initializeReservationTimeoutCron) — no RefundRequest, by design.
  if (booking.status === BookingStatus.RESERVED) {
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason ? String(reason).trim() : 'Cancelled by guest before balance payment — reservation fee forfeited',
        cancelledBy: CancelledBy.CUSTOMER,
      },
    });
    await notify(
      booking.car.ownerId,
      'GENERIC',
      'Reservation cancelled',
      `A guest cancelled their reservation for your ${booking.car.make} ${booking.car.model} before paying the balance.`,
      '/host/dashboard'
    );
    return res.json({ success: true, data: updated, refundAmount: 0, retentionPercent: 1 });
  }

  const hoursUntilStart = (booking.startTime.getTime() - Date.now()) / (60 * 60 * 1000);
  const tripCost = booking.totalAmount - booking.platformFee;
  let retentionPercent: number;
  let tierLabel: string;
  if (hoursUntilStart > 24) {
    retentionPercent = 0;
    tierLabel = 'more than 24h before trip start — no cancellation charge';
  } else if (hoursUntilStart >= 6) {
    retentionPercent = 0.25;
    tierLabel = '6-24h before trip start — 25% cancellation charge';
  } else {
    retentionPercent = 0.5;
    tierLabel = 'within 6h of trip start — 50% cancellation charge';
  }
  const retained = Math.round(tripCost * retentionPercent);
  const refundAmount = tripCost - retained + booking.depositAmount;

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason ? String(reason).trim() : tierLabel,
        cancelledBy: CancelledBy.CUSTOMER,
      },
    }),
    prisma.refundRequest.create({
      data: { bookingId: id, type: RefundRequestType.CANCELLATION, amount: refundAmount, notes: tierLabel },
    }),
  ]);
  await notify(
    booking.car.ownerId,
    'GENERIC',
    'Booking cancelled',
    `A guest cancelled their ${booking.car.make} ${booking.car.model} trip (${tierLabel}).`,
    '/host/dashboard'
  );

  res.json({ success: true, data: updated, refundAmount, retentionPercent });
});

// Pickup/drop-off vehicle-condition photos — either party may be the one
// physically holding the phone at handover, so both host and guest can
// upload. Submitted as a batch (one call per stage, after the client has
// captured all angles) rather than one call per photo.
router.post('/bookings/:id/condition-photos', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stage, photos } = req.body as { stage?: string; photos?: { angle: string; url: string }[] };

  if (!stage || !Object.values(TripStage).includes(stage as TripStage)) {
    return res.status(400).json({ error: 'stage must be PRE_TRIP or POST_TRIP' });
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'photos must be a non-empty array of { angle, url }' });
  }
  for (const p of photos) {
    if (!p.url || !p.angle || !Object.values(PhotoAngle).includes(p.angle as PhotoAngle)) {
      return res.status(400).json({ error: 'Each photo needs a valid angle and url' });
    }
  }

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });

  await prisma.bookingConditionPhoto.createMany({
    data: photos.map((p) => ({
      bookingId: id,
      stage: stage as TripStage,
      angle: p.angle as PhotoAngle,
      url: p.url,
      uploadedById: req.user!.userId,
    })),
  });

  const saved = await prisma.bookingConditionPhoto.findMany({ where: { bookingId: id, stage: stage as TripStage }, orderBy: { createdAt: 'asc' } });
  res.status(201).json({ success: true, data: saved });
});

router.get('/bookings/:id/condition-photos', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });

  const photos = await prisma.bookingConditionPhoto.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' } });
  res.json({ success: true, data: photos });
});

// Live doorstep-delivery tracking (Uber/Zepto-style) — the host's own device
// reports its GPS position while driving the car over; the guest polls the
// GET below to watch it move on a map. Only meaningful pre-pickup, so scoped
// to CONFIRMED bookings with deliveryRequested set.
router.post('/bookings/:id/delivery-location', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return res.status(400).json({ error: 'latitude and longitude must be numbers' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'latitude/longitude out of range' });
  }

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can share this delivery\'s location' });
  if (!booking.deliveryRequested) return res.status(400).json({ error: 'This booking was not requested for doorstep delivery' });
  if (booking.status !== BookingStatus.CONFIRMED) {
    return res.status(400).json({ error: `Cannot share delivery location for a booking with status ${booking.status}` });
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { deliveryLatitude: latitude, deliveryLongitude: longitude, deliveryLocationUpdatedAt: new Date() },
    select: { deliveryLatitude: true, deliveryLongitude: true, deliveryLocationUpdatedAt: true },
  });
  mirrorBookingParticipants(id, booking.customerId, booking.car.ownerId);
  mirrorToFirestore('deliveryTracking', id, {
    latitude: updated.deliveryLatitude,
    longitude: updated.deliveryLongitude,
    updatedAt: updated.deliveryLocationUpdatedAt?.toISOString(),
    source: 'HOST_APP',
  });
  res.json({ success: true, data: updated });
});

router.get('/bookings/:id/delivery-location', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });

  // Prefer live vehicle telemetry when the car actually has telematics
  // hardware wired up (rare — most self-hosted listings don't); otherwise
  // fall back to the host-app-reported position, which is what every
  // delivery gets regardless of hardware.
  if (booking.car.telematicsImei) {
    try {
      const state = await TelematicsService.getVehicleState(booking.car.telematicsImei);
      return res.json({ success: true, data: { latitude: state.latitude, longitude: state.longitude, updatedAt: new Date(), source: 'TELEMATICS' } });
    } catch {
      // Fall through to the host-reported position below.
    }
  }

  if (booking.deliveryLatitude == null || booking.deliveryLongitude == null) {
    return res.json({ success: true, data: null });
  }
  res.json({
    success: true,
    data: { latitude: booking.deliveryLatitude, longitude: booking.deliveryLongitude, updatedAt: booking.deliveryLocationUpdatedAt, source: 'HOST_APP' },
  });
});

// Guest<->host messaging, scoped to this booking. Either party can read/send;
// no general DM system, just pickup coordination and pre-trip questions.
router.get('/bookings/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });

  const messages = await prisma.message.findMany({
    where: { bookingId: id },
    include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Mark the other party's messages read now that this party has fetched the thread.
  await prisma.message.updateMany({
    where: { bookingId: id, senderId: { not: req.user!.userId }, read: false },
    data: { read: true },
  });

  res.json({ success: true, count: messages.length, data: messages });
});

router.post('/bookings/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { body } = req.body;
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Message body is required' });

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, customer: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });

  const message = await prisma.message.create({
    data: { bookingId: id, senderId: req.user!.userId, body: String(body).trim() },
    include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
  });
  mirrorBookingParticipants(id, booking.customerId, booking.car.ownerId);
  mirrorToFirestore(`tripChats/${id}/messages`, message.id, {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    senderId: message.sender.id,
    senderName: message.sender.fullName,
    senderAvatarUrl: message.sender.avatarUrl ?? null,
  });

  const recipientId = isCustomer ? booking.car.ownerId : booking.customerId;
  await notify(
    recipientId,
    'GENERIC',
    'New message',
    `${message.sender.fullName}: ${message.body.slice(0, 80)}`,
    `/account/trips/${id}`
  );

  res.status(201).json({ success: true, data: message });
});

// Remote keyless unlock for an active booking
router.post('/booking/:id/unlock', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking || booking.status !== BookingStatus.ACTIVE) {
    return res.status(400).json({ error: 'Booking is not active' });
  }
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (!booking.car.telematicsImei) {
    return res.status(400).json({ error: 'Vehicle has no keyless IoT hardware' });
  }

  try {
    const success = await TelematicsService.unlockVehicle(booking.car.telematicsImei, req.user!.userId);
    res.json({ success, message: success ? 'Vehicle unlocked' : 'Unlock failed' });
  } catch (error: any) {
    console.error('[booking/:id/unlock] failed:', error);
    res.status(502).json({ error: safeErrorMessage(error, 'Hardware command failed') });
  }
});

export default router;
