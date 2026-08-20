import type { RazorpayCheckoutSession } from './api';

export interface RazorpayCheckoutResult {
  orderId: string;
  paymentId: string;
  signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: any) => void) => void;
    };
  }
}

/**
 * Opens Razorpay's Checkout.js modal (loaded via a <Script> tag in
 * app/layout.tsx) and resolves once the guest completes payment. Callers
 * still owe a POST to /payments/razorpay/verify afterward — this only
 * returns what Checkout's own `handler` callback hands back, unverified.
 */
export function openRazorpayCheckout(
  session: RazorpayCheckoutSession,
  opts: { name: string; description: string; prefillEmail?: string; prefillContact?: string },
): Promise<RazorpayCheckoutResult> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Payment gateway failed to load — check your connection and try again.'));
      return;
    }

    const rzp = new window.Razorpay({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency,
      order_id: session.orderId,
      name: opts.name,
      description: opts.description,
      prefill: { email: opts.prefillEmail, contact: opts.prefillContact },
      handler: (response: any) => {
        resolve({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment window closed.')),
      },
    });

    rzp.on('payment.failed', (response: any) => {
      reject(new Error(response?.error?.description ?? 'Payment failed.'));
    });

    rzp.open();
  });
}
