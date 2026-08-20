import Razorpay from 'razorpay';
import { config } from '../config';

interface InitiateCheckoutParams {
  /** Rupees — converted to paise (Razorpay's base unit) before calling the Orders API. */
  amount: number;
  /** Short, unique-enough label stored on the order (Razorpay allows up to 40 chars). */
  receipt: string;
  /** Arbitrary metadata echoed back on the order/payment — not relied on for
   * routing (see razorpayPaymentHandler.ts, which resolves the entity by
   * matching the stored order id instead), but useful for reconciliation in
   * the Razorpay Dashboard. */
  notes?: Record<string, string>;
}

export interface RazorpayCheckoutSession {
  /** Razorpay's order id — stored as Booking/DamageClaim/ItineraryUnlock's `paymentIntentId`. */
  orderId: string;
  /** Paise — what Razorpay Checkout expects for its `amount` option. */
  amount: number;
  currency: string;
  /** Public key id — safe to hand to the client, it's not a secret. */
  keyId: string;
}

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (!client) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error('Razorpay key id/secret are not configured');
    }
    client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return client;
}

/**
 * Razorpay Orders + Checkout integration (https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/).
 *
 * We collect the FULL booking amount into our own (aggregator) Razorpay
 * account here — hosts are paid out later on the existing N+1 escrow
 * schedule via PayoutEngine, which calls Razorpay's Transfers API against
 * the captured payment. This matches our escrow/hold-then-release model;
 * marking transfers at order-creation time would send the host's cut
 * instantly and bypass N+1, so we intentionally don't use that here.
 */
class PaymentGateway {
  async initiateCheckout(params: InitiateCheckoutParams): Promise<RazorpayCheckoutSession> {
    if (config.nodeEnv === 'production' && (!config.razorpay.keyId || !config.razorpay.keySecret)) {
      throw new Error('Razorpay key id/secret are not configured');
    }

    const amountPaise = Math.round(params.amount * 100);
    const order = await getClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    });

    return { orderId: order.id, amount: amountPaise, currency: order.currency, keyId: config.razorpay.keyId };
  }
}

export default new PaymentGateway();
