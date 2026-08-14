import { PrismaClient, PayoutStatus } from '@prisma/client';
import cron from 'node-cron';
import { config } from '../config';

const prisma = new PrismaClient();

export class PayoutEngine {
  private static PLATFORM_COMMISSION = config.payout.platformCommission; // e.g. 0.30
  private static HOST_SHARE = config.payout.hostShare;                   // e.g. 0.70

  /** Splits a gross booking amount into platform fee + host payout. */
  static splitAmount(totalAmount: number) {
    const platformFee = Number((totalAmount * this.PLATFORM_COMMISSION).toFixed(2));
    const hostPayout = Number((totalAmount * this.HOST_SHARE).toFixed(2));
    return { platformFee, hostPayout };
  }

  /**
   * Creates an escrow ledger entry with the N+1 settlement timestamp
   * once a booking is confirmed.
   */
  static async createEscrowLedger(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { car: true },
    });
    if (!booking) throw new Error('Booking not found');

    const { platformFee, hostPayout } = this.splitAmount(booking.totalAmount);
    const scheduledFor = new Date(
      booking.endTime.getTime() + config.payout.settlementHours * 60 * 60 * 1000
    );

    return prisma.payoutLedger.create({
      data: {
        bookingId: booking.id,
        hostId: booking.car.ownerId,
        grossAmount: booking.totalAmount,
        ziyamCut: platformFee,
        netPayout: hostPayout,
        status: PayoutStatus.HELD_IN_ESCROW,
        scheduledFor,
      },
    });
  }

  /** Runs hourly and releases any payout whose N+1 window has matured. */
  static initializePayoutCron() {
    cron.schedule('0 * * * *', async () => {
      console.log('[PAYOUT ENGINE] Scanning for mature N+1 payouts...');
      const now = new Date();

      const maturePayouts = await prisma.payoutLedger.findMany({
        where: { status: PayoutStatus.HELD_IN_ESCROW, scheduledFor: { lte: now } },
        include: { host: true },
      });

      for (const payout of maturePayouts) {
        try {
          if (!payout.host.payoutAccountId) {
            throw new Error('Host has no linked payout account');
          }
          const payoutTxnId = await this.executeBankTransfer(
            payout.host.payoutAccountId,
            payout.netPayout
          );
          await prisma.payoutLedger.update({
            where: { id: payout.id },
            data: { status: PayoutStatus.SETTLED, payoutTxnId },
          });
          console.log(`[PAYOUT SUCCESS] ₹${payout.netPayout} -> host ${payout.hostId}`);
        } catch (error: any) {
          console.error(`[PAYOUT ERROR] Ledger ${payout.id}:`, error.message);
          await prisma.payoutLedger.update({
            where: { id: payout.id },
            data: { status: PayoutStatus.FAILED },
          });
        }
      }
    });
  }

  /**
   * Placeholder for the real payment-gateway payout call
   * (Razorpay Route transfer, Stripe Connect transfer, or Cashfree payout).
   * Wire this up to your provider's SDK before going live.
   */
  private static async executeBankTransfer(accountId: string, amount: number): Promise<string> {
    if (config.nodeEnv === 'production' && !config.payments.apiKey) {
      throw new Error('Payment provider API key is not configured');
    }
    // TODO: replace with a real provider call, e.g.:
    // const transfer = await razorpay.transfers.create({ account: accountId, amount: amount * 100 });
    // return transfer.id;
    return `TXN_ZIYAM_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }
}
