import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import paymentGateway from '../services/paymentGateway';
import { PayoutEngine } from '../services/payoutEngine';
import { TelematicsService } from '../services/telematicsService';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

const VALID_PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
const REFERRAL_REWARD = 500; // ₹ credited to the referrer once their referred user completes their first trip

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
  const { carId, startTime, endTime, totalAmount, protectionPlan, deliveryRequested, promoCode } = req.body;
  const customerId = req.user!.userId;

  if (!carId || !startTime || !endTime || !totalAmount) {
    return res.status(400).json({ error: 'carId, startTime, endTime, and totalAmount are required' });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) {
    return res.status(400).json({ error: 'endTime must be after startTime' });
  }

  try {
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
        protectionPlan: VALID_PLANS.includes(protectionPlan) ? protectionPlan : 'BASIC',
        deliveryRequested: Boolean(deliveryRequested),
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
    const checkout = await paymentGateway.initiateCheckout({
      bookingId: booking.id,
      amount: booking.totalAmount,
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

  // Generate the trip-end handover code now — shown only to the host, and
  // required from whoever calls /complete, so a trip can't be closed out
  // without the two parties actually meeting for the handover.
  const endOtp = String(Math.floor(1000 + Math.random() * 9000));
  const updated = await prisma.booking.update({ where: { id }, data: { status: BookingStatus.ACTIVE, endOtp } });
  await notify(
    booking.car.ownerId,
    'TRIP_STARTED',
    'Trip started',
    `A renter has picked up your ${booking.car.make} ${booking.car.model}.`,
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

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED },
    });
    await PayoutEngine.createEscrowLedger(booking.id);
    await creditReferralRewardIfFirstTrip(booking.customerId);
    res.json({ success: true, message: 'Trip completed. N+1 payout scheduled.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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
