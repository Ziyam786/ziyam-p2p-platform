import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { config } from '../config';
import { verifyPayuResponseHash } from '../utils/payuHash';
import { notify } from '../services/notificationService';
import { startLeaseAgreementEsign } from '../services/leaseAgreementEsign';
import { isSetuConfigured } from '../services/setuService';

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

export default router;
