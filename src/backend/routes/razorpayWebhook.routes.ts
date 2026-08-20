import express, { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../utils/razorpaySignature';
import { processCapturedPayment } from '../services/razorpayPaymentHandler';
import { razorpayWebhookRateLimiter } from '../middleware/rateLimit';

const router = Router();
router.use(razorpayWebhookRateLimiter);

/**
 * Razorpay posts webhook events here as real server-to-server JSON, signed
 * via the `X-Razorpay-Signature` header (HMAC-SHA256 of the exact raw body —
 * see razorpaySignature.ts). This is the AUTHORITATIVE confirmation path:
 * unlike the client-invoked /payments/razorpay/verify route, this fires even
 * if the guest closes the tab right after paying, so it's what
 * processCapturedPayment must be trusted to run from without any other
 * signal. Mounted on `app` ahead of the CORS/cookie/JSON-body middleware in
 * server.ts, for two reasons: an unrecognized
 * Origin on this server-to-server POST must never hit our strict CORS
 * check, and we need the RAW body for signature verification, not the
 * already-parsed one `express.json()` would produce.
 */
router.post(
  '/payments/razorpay/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body as Buffer;

    if (typeof signature !== 'string' || !Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) {
      console.error('[RAZORPAY WEBHOOK] Signature verification FAILED — possible tampering, refusing to process.');
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
      if (event === 'order.paid') {
        const orderId = payload.payload?.order?.entity?.id;
        const paymentId = payload.payload?.payment?.entity?.id;
        if (orderId && paymentId) await processCapturedPayment(orderId, paymentId, true);
      } else if (event === 'payment.failed') {
        const orderId = payload.payload?.payment?.entity?.order_id;
        const paymentId = payload.payload?.payment?.entity?.id;
        if (orderId && paymentId) await processCapturedPayment(orderId, paymentId, false);
      }
      // Other event types (e.g. payment.captured, which we don't need
      // separately from order.paid for Orders-based checkout) are
      // acknowledged and ignored.
    } catch (err: any) {
      console.error('[RAZORPAY WEBHOOK] Failed to process event %s:', event, err.message ?? err);
      // Still ack 200 — Razorpay retries on non-2xx, and processCapturedPayment
      // is idempotent, so a transient error here is safe to let it retry.
      return res.status(200).json({ received: true, processed: false });
    }

    return res.status(200).json({ received: true });
  }
);

export default router;
