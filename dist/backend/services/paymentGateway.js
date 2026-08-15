"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const payuHash_1 = require("../utils/payuHash");
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
    async initiateCheckout(params) {
        if (config_1.config.nodeEnv === 'production' && (!config_1.config.payu.key || !config_1.config.payu.salt)) {
            throw new Error('PayU key/salt are not configured');
        }
        const txnid = `ziyam_${params.bookingId.slice(0, 8)}_${Date.now()}`;
        const amount = params.amount.toFixed(2);
        const [firstname, ...rest] = params.customerName.trim().split(' ');
        const hash = (0, payuHash_1.generatePayuHash)({
            txnid,
            amount,
            productinfo: params.productInfo,
            firstname: firstname || params.customerName,
            email: params.customerEmail,
            udf1: params.bookingId,
        });
        const fields = {
            key: config_1.config.payu.key,
            txnid,
            amount,
            productinfo: params.productInfo,
            firstname: firstname || params.customerName,
            lastname: rest.join(' '),
            email: params.customerEmail,
            phone: '',
            udf1: params.bookingId,
            surl: `${config_1.config.serverUrl}/api/payments/payu/callback`,
            furl: `${config_1.config.serverUrl}/api/payments/payu/callback`,
            hash,
        };
        return { txnid, checkoutUrl: config_1.config.payu.checkoutUrl, fields };
    }
}
exports.default = new PaymentGateway();
//# sourceMappingURL=paymentGateway.js.map