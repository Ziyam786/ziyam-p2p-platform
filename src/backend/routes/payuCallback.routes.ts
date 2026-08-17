import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { config } from '../config';
import { verifyPayuResponseHash } from '../utils/payuHash';
import { notify } from '../services/notificationService';
import { getSetting } from '../services/settingsService';
import { generateChatReply } from '../services/aiService';
import { ITINERARY_DESTINATIONS } from './itinerary.routes';

const router = Router();
const prisma = new PrismaClient();

// How long a guest has to pay the balance after reserving before the dates
// release and the reservation fee is forfeited — see the reservation-timeout
// cron in payoutEngine.ts.
const RESERVATION_WINDOW_HOURS = 24;

/**
 * PayU posts here (both surl and furl point at this one route — `status`
 * tells us which branch we're in) after the user completes or abandons
 * checkout. This is the ONLY place a booking is allowed to move out of
 * PENDING_PAYMENT for a PayU-paid trip — never trust a client-side "I paid"
 * click for real money.
 */
router.post('/payments/payu/callback', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const { status, txnid, amount, productinfo, firstname, email, udf1, hash } = body;
  const bookingId = udf1;

  const redirectBase = config.clientUrl.replace(/\/$/, '');

  if (!bookingId || !hash || !txnid) {
    console.error('[PAYU CALLBACK] Missing required fields', body);
    return res.redirect(303, `${redirectBase}/checkout/error?reason=malformed_callback`);
  }

  const hashValid = verifyPayuResponseHash({
    status: String(status ?? ''),
    txnid: String(txnid),
    amount: String(amount ?? ''),
    productinfo: String(productinfo ?? ''),
    firstname: String(firstname ?? ''),
    email: String(email ?? ''),
    udf1: String(udf1 ?? ''),
    hash: String(hash),
  });

  if (!hashValid) {
    console.error(`[PAYU CALLBACK] Hash verification FAILED for txnid ${txnid} — possible tampering, refusing to confirm.`);
    return res.redirect(303, `${redirectBase}/checkout/${bookingId}?payment=unverified`);
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    console.error(`[PAYU CALLBACK] No booking found for id ${bookingId} (txnid ${txnid})`);
    return res.redirect(303, `${redirectBase}/checkout/error?reason=booking_not_found`);
  }
  if (booking.paymentIntentId !== txnid) {
    console.error(`[PAYU CALLBACK] txnid mismatch for booking ${bookingId}: expected ${booking.paymentIntentId}, got ${txnid}`);
    return res.redirect(303, `${redirectBase}/checkout/${bookingId}?payment=unverified`);
  }

  // Idempotent: PayU may retry the postback, and the browser redirect can also land here twice.
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    const alreadyProcessed = booking.status !== BookingStatus.CANCELLED;
    return res.redirect(303, alreadyProcessed ? `${redirectBase}/bookings/${bookingId}/confirmation` : `${redirectBase}/checkout/${bookingId}`);
  }

  if (String(status).toLowerCase() === 'success') {
    // This confirms STAGE 1 (the reservation fee) only — it holds the dates,
    // it doesn't send anything to the host yet. The guest reviews everything
    // and pays the balance via /balance-checkout-session below, which is
    // what actually enters host review (see RESERVATION_TIMEOUT_HOURS' cron
    // in payoutEngine.ts for what happens if they never do).
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.RESERVED,
        reservationPaidAt: new Date(),
        reservationDeadline: new Date(Date.now() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000),
      },
      include: { car: true },
    });
    await notify(
      updated.customerId,
      'GENERIC',
      'Reservation confirmed',
      `You've reserved the ${updated.car.make} ${updated.car.model} — pay the balance within ${RESERVATION_WINDOW_HOURS}h to lock in your trip.`,
      `/account/trips/${updated.id}`
    );

    return res.redirect(303, `${redirectBase}/bookings/${bookingId}/confirmation`);
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CANCELLED } });
  return res.redirect(303, `${redirectBase}/checkout/${bookingId}?payment=failed`);
});

// STAGE 2 callback — confirms the balance payment (see
// POST /booking/:id/balance-checkout-session), which is the real commitment
// point: this is what actually enters the host-review queue. Same
// hash-verification/idempotency discipline as the callback above, kept in
// its own route so the two payment stages can never be confused, same
// separate-route pattern the itinerary-unlock flow already established.
router.post('/payments/payu/balance-callback', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const { status, txnid, amount, productinfo, firstname, email, udf1, hash } = body;
  const bookingId = udf1;

  const redirectBase = config.clientUrl.replace(/\/$/, '');

  if (!bookingId || !hash || !txnid) {
    console.error('[PAYU BALANCE CALLBACK] Missing required fields', body);
    return res.redirect(303, `${redirectBase}/checkout/error?reason=malformed_callback`);
  }

  const hashValid = verifyPayuResponseHash({
    status: String(status ?? ''),
    txnid: String(txnid),
    amount: String(amount ?? ''),
    productinfo: String(productinfo ?? ''),
    firstname: String(firstname ?? ''),
    email: String(email ?? ''),
    udf1: String(udf1 ?? ''),
    hash: String(hash),
  });

  if (!hashValid) {
    console.error(`[PAYU BALANCE CALLBACK] Hash verification FAILED for txnid ${txnid} — possible tampering, refusing to confirm.`);
    return res.redirect(303, `${redirectBase}/account/trips/${bookingId}?payment=unverified`);
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { car: true } });
  if (!booking) {
    console.error(`[PAYU BALANCE CALLBACK] No booking found for id ${bookingId} (txnid ${txnid})`);
    return res.redirect(303, `${redirectBase}/checkout/error?reason=booking_not_found`);
  }
  if (booking.paymentIntentId !== txnid) {
    console.error(`[PAYU BALANCE CALLBACK] txnid mismatch for booking ${bookingId}: expected ${booking.paymentIntentId}, got ${txnid}`);
    return res.redirect(303, `${redirectBase}/account/trips/${bookingId}?payment=unverified`);
  }

  // Idempotent — PayU may retry the postback, and the browser redirect can also land here twice.
  if (booking.status !== BookingStatus.RESERVED) {
    return res.redirect(303, `${redirectBase}/bookings/${bookingId}/confirmation`);
  }

  if (String(status).toLowerCase() !== 'success') {
    return res.redirect(303, `${redirectBase}/account/trips/${bookingId}?payment=failed`);
  }

  const reviewWindowHours = await getSetting<number>('host_review_window_hours', 2);
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.PENDING_HOST_REVIEW,
      hostReviewDeadline: new Date(Date.now() + reviewWindowHours * 60 * 60 * 1000),
    },
    include: { car: true },
  });
  if (booking.promoCode) {
    await prisma.promoCode.update({ where: { code: booking.promoCode }, data: { usedCount: { increment: 1 } } });
  }
  await notify(
    updated.customerId,
    'GENERIC',
    'Booking request sent',
    `Your request for the ${updated.car.make} ${updated.car.model} is awaiting host confirmation.`,
    `/account/trips/${updated.id}`
  );
  await notify(
    updated.car.ownerId,
    'GENERIC',
    'New booking request',
    `A guest wants to book your ${updated.car.make} ${updated.car.model} — accept or decline within ${reviewWindowHours}h.`,
    '/host/dashboard?tab=requests'
  );

  return res.redirect(303, `${redirectBase}/bookings/${bookingId}/confirmation`);
});

/**
 * Separate callback for itinerary unlocks (see itinerary.routes.ts) — same
 * hash-verification discipline as the booking callback above, kept in its
 * own route (not folded into /payments/payu/callback) so the two payment
 * flows can never be confused with each other. On success, generates the
 * itinerary content via Claude right here before redirecting, so by the time
 * the customer's browser lands on the confirmation page it's already there.
 */
router.post('/payments/payu/itinerary-callback', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const { status, txnid, amount, productinfo, firstname, email, udf1, hash } = body;
  const unlockId = udf1;

  const redirectBase = config.clientUrl.replace(/\/$/, '');

  if (!unlockId || !hash || !txnid) {
    console.error('[PAYU ITINERARY CALLBACK] Missing required fields', body);
    return res.redirect(303, `${redirectBase}/itineraries/error?reason=malformed_callback`);
  }

  const hashValid = verifyPayuResponseHash({
    status: String(status ?? ''),
    txnid: String(txnid),
    amount: String(amount ?? ''),
    productinfo: String(productinfo ?? ''),
    firstname: String(firstname ?? ''),
    email: String(email ?? ''),
    udf1: String(udf1 ?? ''),
    hash: String(hash),
  });

  if (!hashValid) {
    console.error(`[PAYU ITINERARY CALLBACK] Hash verification FAILED for txnid ${txnid} — possible tampering, refusing to confirm.`);
    return res.redirect(303, `${redirectBase}/itineraries/${unlockId}?payment=unverified`);
  }

  const unlock = await prisma.itineraryUnlock.findUnique({ where: { id: unlockId } });
  if (!unlock) {
    console.error(`[PAYU ITINERARY CALLBACK] No itinerary unlock found for id ${unlockId} (txnid ${txnid})`);
    return res.redirect(303, `${redirectBase}/itineraries/error?reason=not_found`);
  }
  if (unlock.paymentIntentId !== txnid) {
    console.error(`[PAYU ITINERARY CALLBACK] txnid mismatch for unlock ${unlockId}: expected ${unlock.paymentIntentId}, got ${txnid}`);
    return res.redirect(303, `${redirectBase}/itineraries/${unlockId}?payment=unverified`);
  }

  // Idempotent — PayU may retry the postback, and the browser redirect can also land here twice.
  if (unlock.status !== 'PENDING_PAYMENT') {
    return res.redirect(303, `${redirectBase}/itineraries/${unlockId}`);
  }

  if (String(status).toLowerCase() !== 'success') {
    await prisma.itineraryUnlock.update({ where: { id: unlockId }, data: { status: 'FAILED' } });
    return res.redirect(303, `${redirectBase}/itineraries/${unlockId}?payment=failed`);
  }

  const destinationBrief = ITINERARY_DESTINATIONS[unlock.destination] ?? unlock.destination;
  const systemPrompt =
    'You are a travel expert writing a road-trip itinerary for a self-drive car rental customer of ZiyamSelfDrive, ' +
    'a P2P car rental platform in Bengaluru. Write a well-organized, specific day-by-day itinerary in plain text ' +
    '(use line breaks and simple dashes for structure, no markdown headers). Include: route overview and driving ' +
    'distance/time from Bengaluru, recommended trip duration, suggested stops along the way, key attractions at the ' +
    'destination, best time to visit, and practical self-drive tips (fuel stops, road conditions, parking). Keep it ' +
    'genuinely useful and specific to the destination, not generic filler.';

  let generatedContent: string;
  try {
    generatedContent = await generateChatReply(systemPrompt, [
      { role: 'user', content: `Write the itinerary for a Bengaluru to ${unlock.destination} road trip. ${destinationBrief}.` },
    ]);
  } catch (err: any) {
    console.error(`[PAYU ITINERARY CALLBACK] AI generation failed for unlock ${unlockId}:`, err.message ?? err);
    generatedContent =
      "We've confirmed your payment, but couldn't generate your itinerary just yet — please contact support and we'll " +
      'get it to you directly, or check back here shortly as we retry automatically.';
  }

  await prisma.itineraryUnlock.update({
    where: { id: unlockId },
    data: { status: 'PAID', generatedContent },
  });

  return res.redirect(303, `${redirectBase}/itineraries/${unlockId}`);
});

export default router;
