"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
/**
 * Thin abstraction over the split-payment provider so routes/services
 * don't depend on a specific SDK. Implement the marked methods against
 * Razorpay Route, Stripe Connect, or Cashfree.
 */
class PaymentGateway {
    async createSplitPayment(params) {
        if (config_1.config.nodeEnv === 'production' && !config_1.config.payments.apiKey) {
            throw new Error(`${config_1.config.payments.provider} API key is not configured`);
        }
        // TODO: call the real provider, e.g. Razorpay Route:
        // const order = await razorpay.orders.create({
        //   amount: params.amount * 100,
        //   currency: params.currency,
        //   transfers: [{ account: params.destinationAccountId, amount: (params.amount - params.platformFeeAmount) * 100 }],
        // });
        const id = `pi_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        return { id, clientSecret: `${id}_secret` };
    }
    async releaseFunds(paymentIntentId) {
        // TODO: call provider's transfer/payout release for the given payment intent.
        console.log(`[PAYMENT GATEWAY] Released funds for ${paymentIntentId}`);
    }
}
exports.default = new PaymentGateway();
//# sourceMappingURL=paymentGateway.js.map