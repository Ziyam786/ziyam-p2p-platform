import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus, RefundRequestType, CancelledBy, TripStage, PhotoAngle } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import paymentGateway from '../services/paymentGateway';
import { PayoutEngine } from '../services/payoutEngine';
import { TelematicsService } from '../services/telematicsService';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { pickLeastLoadedAgent } from '../services/agentAssignment';

const WASH_SERVICE_PRICE = 349;

const router = Router();
const prisma = new PrismaClient();

const VALID_PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
const REFERRAL_REWARD = 500; // ₹ credited to the referrer once their referred user completes their first trip

// What fraction of Car.securityDeposit is actually held per protection plan —
// matches the "Reduced deposit hold" / "Lowest deposit hold" copy already
// shown in the checkout UI's plan picker (src/frontend/app/cars/[id]/page.tsx),
// which until now was description text only with no backing calculation.
const DEPOSIT_HOLD_FRACTION: Record<string, number> = { BASIC: 1, STANDARD: 0.6, PREMIUM: 0.3 };

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

// Create a booking (no payment yet — the checkout page starts a PayU session separately)
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
    const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { isKycVerified: true } });
    if (!customer?.isKycVerified) {
      return res.status(403).json({ error: 'Please complete KYC verification before booking a car.', code: 'KYC_REQUIRED' });
    }

    const car = await prisma.car.findUnique({ where: { id: carId }, include: { owner: true } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (!car.isAvailable) return res.status(409).json({ error: 'Car is no longer available' });
    if (!car.owner.payoutAccountId) {
      return res.status(422).json({ error: 'Host payout account not configured' });
    }
    if (deliveryRequested && !car.offersDelivery) {
      return res.status(400).json({ error: 'This host does not offer delivery' });
    }

    // Reject overlapping bookings for the same car. PENDING_PAYMENT counts as
    // holding the slot (prevents a race where two renters both start checkout
    // for the same dates) — in production these should also auto-expire after
    // a short window so an abandoned checkout doesn't permanently lock dates.
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        carId,
        status: { notIn: [BookingStatus.CANCELLED] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
    if (conflictingBooking) {
      return res.status(409).json({ error: 'This car is already booked for part of the selected dates' });
    }

    const conflictingBlackout = await prisma.blackout.findFirst({
      where: { carId, startDate: { lt: end }, endDate: { gt: start } },
    });
    if (conflictingBlackout) {
      return res.status(409).json({ error: 'The host has blocked out part of the selected dates' });
    }

    let normalizedPromo: string | null = null;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: String(promoCode).toUpperCase() } });
      if (!promo || !promo.active || (promo.expiresAt && promo.expiresAt < new Date()) || (promo.maxUses !== null && promo.usedCount >= promo.maxUses)) {
        return res.status(400).json({ error: 'Promo code is no longer valid' });
      }
      normalizedPromo = promo.code;
    }

    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(totalAmount);

    // Server-computed, not client-supplied — the deposit fraction can't be
    // tampered with by sending a lower totalAmount. Charged alongside
    // totalAmount at the PayU checkout-session step (not folded into
    // totalAmount itself, since totalAmount also drives PayoutEngine.splitAmount
    // at trip completion and the deposit isn't host revenue to split).
    const resolvedPlan = VALID_PLANS.includes(protectionPlan) ? protectionPlan : 'BASIC';
    const depositAmount = Math.round((car.securityDeposit ?? 0) * (DEPOSIT_HOLD_FRACTION[resolvedPlan] ?? 1));

    const booking = await prisma.booking.create({
      data: {
        id: uuidv4(),
        carId,
        customerId,
        startTime: start,
        endTime: end,
        totalAmount,
        platformFee,
        hostPayoutAmount: hostPayout,
        depositAmount,
        protectionPlan: resolvedPlan,
        deliveryRequested: Boolean(deliveryRequested),
        coDriverRequested: Boolean(coDriverRequested),
        coDriverName: coDriverRequested ? String(coDriverName).trim() : null,
        coDriverLicenseNumber: coDriverRequested ? String(coDriverLicenseNumber).trim() : null,
        promoCode: normalizedPromo,
        status: BookingStatus.PENDING_PAYMENT,
      },
    });

    res.status(201).json({ success: true, bookingId: booking.id });
  } catch (error: any) {
    res.status(500).json({ error: `Booking failed: ${error.message}` });
  }
});

// Starts (or restarts) a PayU Hosted Checkout session for a pending booking.
// The checkout page POSTs the returned {url, fields} straight to PayU — real
// confirmation only ever happens via the hash-verified callback in
// payuCallback.routes.ts, never from this endpoint.
router.post('/booking/:id/checkout-session', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, customer: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return res.status(400).json({ error: `Cannot start checkout from status ${booking.status}` });
  }

  try {
    // Deposit is charged in the same PayU transaction as the trip cost, not
    // held separately — booking.totalAmount itself stays deposit-exclusive
    // since PayoutEngine.splitAmount reads it at trip completion, and the
    // deposit isn't host revenue to split.
    const checkout = await paymentGateway.initiateCheckout({
      bookingId: booking.id,
      amount: booking.totalAmount + booking.depositAmount,
      customerName: booking.customer.fullName,
      customerEmail: booking.customer.email,
      customerPhone: booking.customer.phoneNumber,
      productInfo: `${booking.car.make} ${booking.car.model} — ${booking.car.city}`,
    });

    await prisma.booking.update({ where: { id }, data: { paymentIntentId: checkout.txnid } });

    res.json({ success: true, data: { url: checkout.checkoutUrl, fields: checkout.fields } });
  } catch (error: any) {
    res.status(502).json({ error: `Could not start payment: ${error.message}` });
  }
});

// Start a confirmed trip (pickup)
router.post('/booking/:id/start', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== BookingStatus.CONFIRMED) {
    return res.status(400).json({ error: `Cannot start trip from status ${booking.status}` });
  }
  if (!(await hasRequiredConditionPhotos(id, TripStage.PRE_TRIP))) {
    return res.status(400).json({ error: 'Upload all 4 required pickup photos (front, rear, left, right) before starting the trip.' });
  }

  // Generate the trip-end handover code now — shown only to the host, and
  // required from whoever calls /complete, so a trip can't be closed out
  // without the two parties actually meeting for the handover.
  const endOtp = String(Math.floor(1000 + Math.random() * 9000));
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

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED },
    });
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
    res.status(500).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Guest-initiated cancellation, before a trip has actually started. Applies
// the tiered refund from the published Refund & Cancellation Policy §3 —
// platform fee is never refunded (§3's "minus... platform fees"); the
// security deposit is always refunded in full since a cancelled trip never
// happened, so there's nothing for it to cover (§8). No live PayU refund
// call — creates a RefundRequest for the same manual admin queue the
// deposit-release/damage-claim flows already use.
router.post('/bookings/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  const cancellableStatuses: BookingStatus[] = [BookingStatus.PENDING_HOST_REVIEW, BookingStatus.CONFIRMED];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking with status ${booking.status}` });
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
    res.status(502).json({ error: error.message ?? 'Hardware command failed' });
  }
});

export default router;
