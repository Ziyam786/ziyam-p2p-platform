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
    try {
      const payout = payload.payload?.payout?.entity;
      const ledgerId = payout?.reference_id;
      if (ledgerId && (event === 'payout.processed' || event === 'payout.failed' || event === 'payout.reversed')) {
        const ledger = await prisma.payoutLedger.findUnique({ where: { id: ledgerId } });
        if (ledger) {
          const newStatus = event === 'payout.processed' ? PayoutStatus.SETTLED : PayoutStatus.FAILED;
          await prisma.payoutLedger.update({ where: { id: ledgerId }, data: { status: newStatus, payoutTxnId: payout.id } });
          if (newStatus === PayoutStatus.SETTLED) {
            await notify(
              ledger.hostId,
              'PAYOUT_SETTLED',
              'Payout settled',
              `₹${ledger.netPayout.toLocaleString()} has been sent to your linked account.`,
              '/host/dashboard'
            );
          }
        }
      }
    } catch (err: any) {
      console.error('[RAZORPAYX WEBHOOK] Failed to process event %s:', event, err.message ?? err);
      return res.status(200).json({ received: true, processed: false });
    }

    return res.status(200).json({ received: true });
  }
);

export default router;
