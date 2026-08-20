import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyPaymentSignature, verifyWebhookSignature } from '../src/backend/utils/razorpaySignature';

// Must match tests/setup.ts — these tests compute real HMACs, so the secrets
// are part of the assertion, not incidental scaffolding.
const KEY_SECRET = 'rzp_test_key_secret';
const WEBHOOK_SECRET = 'rzp_test_webhook_secret';

const sign = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('verifyPaymentSignature — the client "I paid" callback', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  it('accepts a signature computed per Razorpay\'s orderId|paymentId formula', () => {
    const sig = sign(`${orderId}|${paymentId}`, KEY_SECRET);
    expect(verifyPaymentSignature(orderId, paymentId, sig)).toBe(true);
  });

  it('rejects a signature for a DIFFERENT payment id', () => {
    // The attack this actually stops: replaying one real payment's signature
    // to confirm a second, unpaid booking.
    const sig = sign(`${orderId}|pay_SOMEONE_ELSE`, KEY_SECRET);
    expect(verifyPaymentSignature(orderId, paymentId, sig)).toBe(false);
  });

  it('rejects a signature for a different order id', () => {
    const sig = sign(`order_OTHER|${paymentId}`, KEY_SECRET);
    expect(verifyPaymentSignature(orderId, paymentId, sig)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const sig = sign(`${orderId}|${paymentId}`, 'attacker-guessed-secret');
    expect(verifyPaymentSignature(orderId, paymentId, sig)).toBe(false);
  });

  it('rejects empty, malformed and truncated signatures without throwing', () => {
    const valid = sign(`${orderId}|${paymentId}`, KEY_SECRET);
    for (const bad of ['', 'not-hex', valid.slice(0, -1), valid + '00', 'zz'.repeat(32)]) {
      expect(verifyPaymentSignature(orderId, paymentId, bad)).toBe(false);
    }
  });

  it('accepts an uppercase hex signature (case-insensitive comparison)', () => {
    const sig = sign(`${orderId}|${paymentId}`, KEY_SECRET).toUpperCase();
    expect(verifyPaymentSignature(orderId, paymentId, sig)).toBe(true);
  });

  it('does not confuse the separator — orderId|paymentId is not concatenation', () => {
    const sig = sign(`${orderId}${paymentId}`, KEY_SECRET);
    expect(verifyPaymentSignature(orderId, paymentId, sig)).toBe(false);
  });
});

describe('verifyWebhookSignature — the authoritative server-to-server path', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: 'order_1' } } } }));

  it('accepts a correctly signed raw body', () => {
    expect(verifyWebhookSignature(rawBody, sign(rawBody.toString('utf8'), WEBHOOK_SECRET))).toBe(true);
  });

  it('uses the WEBHOOK secret, not the key secret', () => {
    // These are two distinct secrets in the Razorpay dashboard; signing a
    // webhook with the key secret must not authenticate it.
    expect(verifyWebhookSignature(rawBody, sign(rawBody.toString('utf8'), KEY_SECRET))).toBe(false);
  });

  it('rejects a body tampered with after signing', () => {
    const sig = sign(rawBody.toString('utf8'), WEBHOOK_SECRET);
    const tampered = Buffer.from(rawBody.toString('utf8').replace('order_1', 'order_2'));
    expect(verifyWebhookSignature(tampered, sig)).toBe(false);
  });

  it('is byte-exact — re-serialized JSON with identical meaning must fail', () => {
    // This is why the route uses express.raw(). If someone "helpfully"
    // switches it to express.json() and re-stringifies, key order and
    // whitespace shift and every real webhook starts failing. This test is
    // the tripwire for that regression.
    const sig = sign(rawBody.toString('utf8'), WEBHOOK_SECRET);
    const reserialized = Buffer.from(JSON.stringify(JSON.parse(rawBody.toString('utf8')), null, 2));
    expect(verifyWebhookSignature(reserialized, sig)).toBe(false);
  });

  it('accepts a string body equivalently to a Buffer', () => {
    const sig = sign(rawBody.toString('utf8'), WEBHOOK_SECRET);
    expect(verifyWebhookSignature(rawBody.toString('utf8'), sig)).toBe(true);
  });

  it('rejects an empty signature on a valid body', () => {
    expect(verifyWebhookSignature(rawBody, '')).toBe(false);
  });
});
