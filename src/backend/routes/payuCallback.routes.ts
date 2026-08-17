import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { config } from '../config';
import { verifyPayuResponseHash } from '../utils/payuHash';
import { notify } from '../services/notificationService';
import { startLeaseAgreementEsign } from '../services/leaseAgreementEsign';
import { isSetuConfigured } from '../services/setuService';
import { generateChatReply } from '../services/aiService';
import { ITINERARY_DESTINATIONS } from './itinerary.routes';

const router = Router();
const prisma = new PrismaClient();

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
    const alreadyConfirmed = booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.ACTIVE || booking.status === BookingStatus.COMPLETED;
    return res.redirect(303, alreadyConfirmed ? `${redirectBase}/bookings/${bookingId}/confirmation` : `${redirectBase}/checkout/${bookingId}`);
  }

  if (String(status).toLowerCase() === 'success') {
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
      include: { car: true },
    });
    if (booking.promoCode) {
      await prisma.promoCode.update({ where: { code: booking.promoCode }, data: { usedCount: { increment: 1 } } });
    }
    await notify(
      updated.customerId,
      'BOOKING_CONFIRMED',
      'Booking confirmed!',
      `Your trip in the ${updated.car.make} ${updated.car.model} is booked.`,
      `/account/trips/${updated.id}`
    );

    // Best-effort: kick off Setu eSign for the lease agreement right away so
    // both host and guest get their signing link immediately, instead of
    // waiting for either of them to open the agreement page and click "Start
    // eSign". Never blocks the payment redirect — if Setu is unreachable or
    // unconfigured, the manual button on /bookings/:id/agreement is still
    // there as a fallback.
    if (isSetuConfigured()) {
      startLeaseAgreementEsign(bookingId).catch((err) => {
        console.error(`[PAYU CALLBACK] Auto eSign trigger failed for booking ${bookingId}:`, err.response?.data ?? err.message);
      });
    }

    return res.redirect(303, `${redirectBase}/bookings/${bookingId}/confirmation`);
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CANCELLED } });
  return res.redirect(303, `${redirectBase}/checkout/${bookingId}?payment=failed`);
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
