import { config } from '../config';
import { generatePayuHash } from '../utils/payuHash';

interface InitiateCheckoutParams {
  bookingId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productInfo: string;
}

export interface PayuCheckoutSession {
  /** PayU's transaction id for this attempt — stored as Booking.paymentIntentId. */
  txnid: string;
  /** The URL the browser must POST `fields` to (PayU's hosted checkout page). */
  checkoutUrl: string;
  /** Hidden form fields to auto-submit, including the computed hash. */
  fields: Record<string, string>;
}

/**
 * PayU Hosted Checkout integration (https://docs.payu.in/docs/generate-hash-payu-hosted).
 *
 * We collect the FULL booking amount into our own (aggregator) PayU merchant
 * account here — hosts are paid out later on the existing N+1 escrow schedule
 * via PayoutEngine, which calls PayU's Split After Transaction API. This
 * matches our escrow/hold-then-release model; PayU's split-at-checkout
 * feature (splitRequest) would send the host's cut instantly and bypass N+1,
 * so we intentionally don't use it here.
 */
class PaymentGateway {
  async initiateCheckout(params: InitiateCheckoutParams): Promise<PayuCheckoutSession> {
    if (config.nodeEnv === 'production' && (!config.payu.key || !config.payu.salt)) {
      throw new Error('PayU key/salt are not configured');
    }

    const txnid = `ziyam_${params.bookingId.slice(0, 8)}_${Date.now()}`;
    const amount = params.amount.toFixed(2);
    const [firstname, ...rest] = params.customerName.trim().split(' ');

    const hash = generatePayuHash({
      txnid,
      amount,
      productinfo: params.productInfo,
      firstname: firstname || params.customerName,
      email: params.customerEmail,
      udf1: params.bookingId,
    });

    const fields: Record<string, string> = {
      key: config.payu.key,
      txnid,
      amount,
      productinfo: params.productInfo,
      firstname: firstname || params.customerName,
      lastname: rest.join(' '),
      email: params.customerEmail,
      phone: params.customerPhone,
      udf1: params.bookingId,
      surl: `${config.serverUrl}/api/payments/payu/callback`,
      furl: `${config.serverUrl}/api/payments/payu/callback`,
      hash,
    };

    return { txnid, checkoutUrl: config.payu.checkoutUrl, fields };
  }
}

export default new PaymentGateway();
