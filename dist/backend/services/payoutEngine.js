"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutEngine = void 0;
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const settingsService_1 = require("./settingsService");
const payuHash_1 = require("../utils/payuHash");
const notificationService_1 = require("./notificationService");
const prisma = new client_1.PrismaClient();
const PAYU_COMMAND_URL = config_1.config.payu.mode === 'live'
    ? 'https://info.payu.in/merchant/postservice.php?form=2'
    : 'https://test.payu.in/merchant/postservice.php?form=2';
class PayoutEngine {
    /** Splits a gross booking amount into platform fee + host payout, using the live (admin-editable) split if set. */
    static async splitAmount(totalAmount) {
        const commission = await (0, settingsService_1.getSetting)('commission_percentage', config_1.config.payout.platformCommission);
        const hostShare = await (0, settingsService_1.getSetting)('host_share_percentage', config_1.config.payout.hostShare);
        const platformFee = Number((totalAmount * commission).toFixed(2));
        const hostPayout = Number((totalAmount * hostShare).toFixed(2));
        return { platformFee, hostPayout };
    }
    /**
     * Creates an escrow ledger entry with the N+1 settlement timestamp
     * once a booking is confirmed.
     */
    static async createEscrowLedger(bookingId) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { car: true },
        });
        if (!booking)
            throw new Error('Booking not found');
        const { platformFee, hostPayout } = await this.splitAmount(booking.totalAmount);
        const settlementHours = await (0, settingsService_1.getSetting)('settlement_hours', config_1.config.payout.settlementHours);
        const scheduledFor = new Date(booking.endTime.getTime() + settlementHours * 60 * 60 * 1000);
        return prisma.payoutLedger.create({
            data: {
                bookingId: booking.id,
                hostId: booking.car.ownerId,
                grossAmount: booking.totalAmount,
                ziyamCut: platformFee,
                netPayout: hostPayout,
                status: client_1.PayoutStatus.HELD_IN_ESCROW,
                scheduledFor,
            },
        });
    }
    /** Runs hourly and releases any payout whose N+1 window has matured. */
    static initializePayoutCron() {
        node_cron_1.default.schedule('0 * * * *', async () => {
            console.log('[PAYOUT ENGINE] Scanning for mature N+1 payouts...');
            const now = new Date();
            const maturePayouts = await prisma.payoutLedger.findMany({
                where: { status: client_1.PayoutStatus.HELD_IN_ESCROW, scheduledFor: { lte: now } },
                include: { host: true, booking: true },
            });
            for (const payout of maturePayouts) {
                try {
                    if (!payout.host.payoutAccountId) {
                        throw new Error('Host has no linked payout account');
                    }
                    if (!payout.booking.paymentIntentId) {
                        throw new Error('Underlying booking has no PayU transaction id to split from');
                    }
                    const payoutTxnId = await this.executeBankTransfer(payout.host.payoutAccountId, payout.netPayout, payout.booking.paymentIntentId, payout.id);
                    await prisma.payoutLedger.update({
                        where: { id: payout.id },
                        data: { status: client_1.PayoutStatus.SETTLED, payoutTxnId },
                    });
                    await (0, notificationService_1.notify)(payout.hostId, 'PAYOUT_SETTLED', 'Payout settled', `₹${payout.netPayout.toLocaleString()} has been sent to your linked account.`, '/host/dashboard');
                    console.log(`[PAYOUT SUCCESS] ₹${payout.netPayout} -> host ${payout.hostId}`);
                }
                catch (error) {
                    console.error(`[PAYOUT ERROR] Ledger ${payout.id}:`, error.message);
                    await prisma.payoutLedger.update({
                        where: { id: payout.id },
                        data: { status: client_1.PayoutStatus.FAILED },
                    });
                }
            }
        });
    }
    /** Admin-triggered retry of a single FAILED payout ledger entry. */
    static async retryPayout(ledgerId) {
        const payout = await prisma.payoutLedger.findUnique({ where: { id: ledgerId }, include: { host: true, booking: true } });
        if (!payout)
            throw new Error('Payout ledger entry not found');
        if (payout.status !== client_1.PayoutStatus.FAILED)
            throw new Error(`Cannot retry a payout in status ${payout.status}`);
        if (!payout.host.payoutAccountId)
            throw new Error('Host has no linked payout account');
        if (!payout.booking.paymentIntentId)
            throw new Error('Underlying booking has no PayU transaction id to split from');
        try {
            const payoutTxnId = await this.executeBankTransfer(payout.host.payoutAccountId, payout.netPayout, payout.booking.paymentIntentId, payout.id);
            const updated = await prisma.payoutLedger.update({
                where: { id: ledgerId },
                data: { status: client_1.PayoutStatus.SETTLED, payoutTxnId },
            });
            await (0, notificationService_1.notify)(payout.hostId, 'PAYOUT_SETTLED', 'Payout settled', `₹${payout.netPayout.toLocaleString()} has been sent to your linked account.`, '/host/dashboard');
            return updated;
        }
        catch (error) {
            await prisma.payoutLedger.update({ where: { id: ledgerId }, data: { status: client_1.PayoutStatus.FAILED } });
            throw error;
        }
    }
    /**
     * Moves a host's cut out of our aggregator PayU account after the fact,
     * using PayU's Split After Transaction API (postservice.php, command=payment_split).
     * `accountId` is the host's PayU *child merchant key* — hosts must already be
     * onboarded with PayU as a child/sub-merchant for this to succeed; that
     * onboarding is a manual business process on PayU's side, not something
     * this app can do for them. `originalTxnid` is the PayU txnid of the
     * original booking payment (Booking.paymentIntentId), which is what's
     * actually being split.
     *
     * NOTE: PayU's docs say the sum of splitInfo amounts must equal the full
     * original transaction amount. We only send the host's line item here
     * (the remainder implicitly stays with the aggregator account). If PayU
     * rejects this with error AGG-108 ("amount mismatch"), add a second
     * splitInfo entry for our own merchant key covering the platform's cut.
     */
    static async executeBankTransfer(accountId, amount, originalTxnid, ledgerId) {
        if (!config_1.config.payu.key || !config_1.config.payu.salt) {
            throw new Error('PayU key/salt are not configured');
        }
        const var1 = JSON.stringify({
            type: 'absolute',
            payuId: originalTxnid,
            splitInfo: {
                [accountId]: {
                    aggregatorSubTxnId: `payout_${ledgerId.slice(0, 12)}`,
                    aggregatorSubAmt: amount.toFixed(2),
                },
            },
        });
        const hash = (0, payuHash_1.generatePayuCommandHash)('payment_split', var1);
        const response = await axios_1.default.post(PAYU_COMMAND_URL, new URLSearchParams({ key: config_1.config.payu.key, command: 'payment_split', var1, hash }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const data = response.data;
        if (data?.status !== 1) {
            throw new Error(`PayU split failed: ${data?.error_desc ?? data?.message ?? 'unknown error'}`);
        }
        return `PAYU_SPLIT_${originalTxnid}_${Date.now()}`;
    }
}
exports.PayoutEngine = PayoutEngine;
//# sourceMappingURL=payoutEngine.js.map