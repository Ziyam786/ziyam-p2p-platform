import crypto from 'crypto';
import { config } from '../config';

function hmacSha256Hex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(actualHex.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verifies the signature Razorpay Checkout's client-side `handler` returns
 * alongside `razorpay_order_id`/`razorpay_payment_id` — HMAC-SHA256(orderId
 * + '|' + paymentId, keySecret), per Razorpay's documented payment
 * verification formula. This is the ONLY thing that makes the client-side
 * "I paid" callback trustworthy; never confirm a payment from the client
 * response alone.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = hmacSha256Hex(`${orderId}|${paymentId}`, config.razorpay.keySecret);
  return timingSafeEqualHex(expected, signature);
}

/**
 * Verifies the `X-Razorpay-Signature` header on an incoming webhook —
 * HMAC-SHA256 of the exact raw request body (not the parsed/re-serialized
 * JSON, which can differ byte-for-byte) using the webhook secret configured
 * in the Razorpay Dashboard.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  const expected = hmacSha256Hex(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'), config.razorpay.webhookSecret);
  return timingSafeEqualHex(expected, signature);
}
