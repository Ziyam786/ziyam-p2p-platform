import express, { Router, Request, Response } from 'express';
import { PrismaClient, PayoutStatus } from '@prisma/client';
import { verifyRazorpayXWebhookSignature } from '../utils/razorpaySignature';
import { notify } from '../services/notificationService';

const prisma = new PrismaClient();
const router = Router();

/**
 * RazorpayX posts payout status here, signed the same way as the existing
 * Payments webhook (X-Razorpay-Signature, HMAC-SHA256 of the raw body) but
 * with RazorpayX's own separately-configured secret. Mounted ahead of the
 * CORS/cookie/JSON-body middleware in server.ts, same reasoning as the
 * existing razorpayWebhook.routes.ts: a server-to-server POST must skip our
 * strict CORS check, and signature verification needs the raw body.
 *
 * This is the SOLE path to SETTLED for an AXON_PARTNER payout (payoutEngine.ts
 * leaves the ledger at QUEUED_FOR_N1 after dispatch — see its comments) —
 * unlike the Payments webhook, there is no client-invoked verify route as a
 * backup here. So a genuine processing failure below must return a 5xx,
 * not a 200: 200-acking it would mean Razorpay never retries and the ledger
 * is orphaned in QUEUED_FOR_N1 forever. The 400s for bad signature/payload
 * are unaffected by this — those are terminal by design (Razorpay retrying a
 * malformed or unsigned request would never succeed anyway).
 */
router.post(
  '/payments/razorpayx/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body as Buffer;

    if (typeof signature !== 'string' || !Buffer.isBuffer(rawBody) || !verifyRazorpayXWebhookSignature(rawBody, signature)) {
      console.error('[RAZORPAYX WEBHOOK] Signature verification FAILED — refusing to process.');
      return res.status(400).json({ error: 'invalid signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'malformed payload' });
    }

    const event = payload?.event;

    // Event types we deliberately don't act on (e.g. payout.pending,
    // payout.queued) — ack normally, there's nothing to retry into.
    if (event !== 'payout.processed' && event !== 'payout.failed' && event !== 'payout.reversed') {
      return res.status(200).json({ received: true });
    }

    try {
      const payoutEntity = payload.payload?.payout?.entity;
      const ledgerId = payoutEntity?.reference_id;
      if (!ledgerId) {
        // Nothing to key off of — ack, since retrying wouldn't change that.
        return res.status(200).json({ received: true, processed: false });
      }

      const ledger = await prisma.payoutLedger.findUnique({ where: { id: ledgerId }, include: { booking: true } });
      if (!ledger) {
        return res.status(200).json({ received: true, processed: false });
      }

      // Defensive: RazorpayX payouts are only ever created for
      // AXON_PARTNER-sourced bookings (see payoutEngine.ts), so a
      // reference_id collision with a non-Axon ledger should never happen —
      // but never blindly act on a ledger this webhook has no business
      // touching just because the id matched.
      if (ledger.booking.source !== 'AXON_PARTNER') {
        console.error(
          '[RAZORPAYX WEBHOOK] reference_id %s resolved to a non-AXON_PARTNER ledger — refusing to touch it.',
          ledgerId
        );
        return res.status(200).json({ received: true, processed: false });
      }

      // Razorpay redelivers events; a ledger already in a terminal state
      // has already been actioned (including the one notification below) —
      // reprocessing would silently re-fire that notification to the host.
      // Only a QUEUED_FOR_N1 -> terminal transition is valid here.
      if (ledger.status === PayoutStatus.SETTLED || ledger.status === PayoutStatus.FAILED) {
        return res.status(200).json({ received: true, alreadyTerminal: true });
      }

      const newStatus = event === 'payout.processed' ? PayoutStatus.SETTLED : PayoutStatus.FAILED;

      if (newStatus === PayoutStatus.SETTLED) {
        const reportedPaise = Number(payoutEntity.amount);
        const expectedPaise = Math.round(ledger.netPayout * 100);
        if (Number.isFinite(reportedPaise) && reportedPaise !== expectedPaise) {
          // The money has already actually moved on RazorpayX's side by the
          // time this event fires, regardless of what we recorded — so this
          // is logged loudly for a human to reconcile, not treated as a
          // reason to refuse the status transition (that would just leave
          // the ledger permanently stuck with no automated recovery path).
          console.error(
            '[RAZORPAYX WEBHOOK] AMOUNT MISMATCH on ledger %s: RazorpayX settled %s paise, ledger.netPayout implies %s paise. ' +
              'Proceeding with the SETTLED transition since the transfer already happened — this needs a human to reconcile.',
            ledgerId,
            reportedPaise,
            expectedPaise
          );
        }
      }

      await prisma.payoutLedger.update({ where: { id: ledgerId }, data: { status: newStatus, payoutTxnId: payoutEntity.id } });
      if (newStatus === PayoutStatus.SETTLED) {
        await notify(
          ledger.hostId,
          'PAYOUT_SETTLED',
          'Payout settled',
          `₹${ledger.netPayout.toLocaleString()} has been sent to your linked account.`,
          '/host/dashboard'
        );
      }
    } catch (err: any) {
      console.error('[RAZORPAYX WEBHOOK] Failed to process event %s:', event, err.message ?? err);
      // 5xx, not 200 — see the file-level comment above. This is the only
      // signal that makes Razorpay retry, and this webhook is the sole path
      // to SETTLED for an AXON_PARTNER payout.
      return res.status(500).json({ error: 'processing failed' });
    }

    return res.status(200).json({ received: true });
  }
);

export default router;
