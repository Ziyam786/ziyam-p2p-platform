import { Router, Request, Response } from 'express';
import { verifyPaymentSignature } from '../utils/razorpaySignature';
import { processCapturedPayment } from '../services/razorpayPaymentHandler';

const router = Router();

/**
 * Called by the client (web or mobile) right after Razorpay Checkout's
 * `handler` fires with `razorpay_order_id`/`razorpay_payment_id`/
 * `razorpay_signature` — gives the UI instant feedback instead of waiting on
 * the webhook. Not authenticated by session (matches the itinerary-unlock
 * flow, which has never required login) — trust here comes entirely from
 * the signature check, exactly like the PayU callbacks this replaces never
 * trusted a client claim without a verified hash either. The webhook (see
 * razorpayWebhook.routes.ts) is the authoritative backstop if this call
 * never happens (e.g. the guest closes the tab right after paying).
 */
router.post('/payments/razorpay/verify', async (req: Request, res: Response) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body ?? {};

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ success: false, error: 'Missing payment verification fields' });
  }

  if (!verifyPaymentSignature(String(orderId), String(paymentId), String(signature))) {
    console.error('[RAZORPAY VERIFY] Signature verification FAILED for order %s — possible tampering, refusing to confirm.', orderId);
    return res.status(400).json({ success: false, error: 'unverified' });
  }

  const outcome = await processCapturedPayment(String(orderId), String(paymentId), true);
  if (outcome.kind === 'unknown') {
    return res.status(404).json({ success: false, error: 'not_found' });
  }

  return res.json({ success: true, kind: outcome.kind, entityId: outcome.entityId });
});

export default router;
