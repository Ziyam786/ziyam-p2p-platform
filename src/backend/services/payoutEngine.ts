import { PrismaClient, PayoutStatus, BookingStatus, BookingDepositStatus, RefundRequestType, CancelledBy } from '@prisma/client';
import cron from 'node-cron';
import axios from 'axios';
import { config } from '../config';
import { getSetting } from './settingsService';
import { generatePayuCommandHash } from '../utils/payuHash';
import { notify } from './notificationService';

const prisma = new PrismaClient();

const PAYU_COMMAND_URL =
  config.payu.mode === 'live'
    ? 'https://info.payu.in/merchant/postservice.php?form=2'
    : 'https://test.payu.in/merchant/postservice.php?form=2';

// Must match REPORT_WINDOW_HOURS in routes/damageClaim.routes.ts — duplicated
// rather than imported since a service importing a route module (and its
// unused Router()/PrismaClient instantiation) inverts the normal dependency
// direction for one constant.
const DEPOSIT_REPORT_WINDOW_HOURS = 24;

export class PayoutEngine {
  /**
   * Aug-2024 policy: no payout schedules until the host has completed BOTH a
   * wet (physically-signed, photographed) and an e-signed Host Onboarding
   * Agreement — "No payouts will be released until documentation is fully
   * completed." Computed at check-time, matching house style elsewhere
   * (docsComplete/stepsCompleted in CarOnboardingWizard) — never persisted as
   * a boolean since the underlying fields can change at any time.
   */
  private static assertPayoutEligible(host: { partnerAgreementWetSignedUrl: string | null; partnerAgreementEsignStatus: string | null }) {
    const eligible = Boolean(host.partnerAgreementWetSignedUrl) && host.partnerAgreementEsignStatus === 'sign_complete';
    if (!eligible) {
      throw new Error(
        'Payout blocked: this host has not completed the Host Onboarding Agreement (both wet and e-signature required). ' +
        'Ask them to finish it from Account → Host Agreement.'
      );
    }
  }

  /**
   * Splits a gross booking amount into platform fee + host payout, using the
   * live (admin-editable) split if set. `passthroughAmount` (e.g. a
   * doorstep-delivery fee) is excluded from commission entirely and paid
   * 100% to the host/fleet operator — the platform doesn't do the driving,
   * so it doesn't take a cut of that fee.
   */
  static async splitAmount(totalAmount: number, passthroughAmount = 0) {
    const commissionable = Math.max(0, totalAmount - passthroughAmount);
    const commission = await getSetting<number>('commission_percentage', config.payout.platformCommission);
    const hostShare = await getSetting<number>('host_share_percentage', config.payout.hostShare);
    const platformFee = Number((commissionable * commission).toFixed(2));
    const hostPayout = Number((commissionable * hostShare).toFixed(2)) + passthroughAmount;
    return { platformFee, hostPayout };
  }

  /**
   * Creates an escrow ledger entry once a trip is complete and eligible for payout scheduling.
   *
   * Two payout policies, chosen by whether the car is fleet-operator managed:
   *  - Self-hosted (Car.fleetManaged = false): scheduled 24-48hrs after trip end
   *    (settlement_hours, admin-configurable), or bundled into the host's next
   *    weekly run if they've opted into User.payoutFrequency = 'WEEKLY'.
   *  - Fleet-managed: NOT called from trip completion at all — see
   *    confirmFleetReceipt() below, which is the only entry point for those
   *    bookings and starts a flat 1-day window once the fleet operator
   *    confirms they've received a clear payout from the platform.
   */
  static async createEscrowLedger(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { car: true },
    });
    if (!booking) throw new Error('Booking not found');
    if (booking.car.fleetManaged) {
      throw new Error('Fleet-managed bookings must go through confirmFleetReceipt(), not createEscrowLedger()');
    }

    const host = await prisma.user.findUnique({ where: { id: booking.car.ownerId } });
    if (!host) throw new Error('Host account not found');
    this.assertPayoutEligible(host);

    const { platformFee, hostPayout } = await this.splitAmount(booking.totalAmount, booking.deliveryFeeAmount);

    let scheduledFor: Date;
    if (host?.payoutFrequency === 'WEEKLY') {
      scheduledFor = this.nextWeeklyPayoutRun();
    } else {
      const settlementHours = await getSetting<number>('settlement_hours', config.payout.settlementHours);
      scheduledFor = new Date(booking.endTime.getTime() + settlementHours * 60 * 60 * 1000);
    }

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

  /**
   * Fleet-operator counterpart to createEscrowLedger(): called when the fleet
   * operator confirms they've received a clear payout from the platform for
   * this booking. Schedules the host's payout exactly 1 day from now, per the
   * fleet-managed N+1 policy (distinct from the self-hosted 24-48hr/weekly one).
   */
  static async confirmFleetReceipt(bookingId: string, fleetOperatorId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { car: true },
    });
    if (!booking) throw new Error('Booking not found');
    if (!booking.car.fleetManaged) throw new Error('This car is not fleet-managed');
    if (booking.car.fleetOperatorId !== fleetOperatorId) throw new Error('You are not the fleet operator for this car');
    if (booking.fleetReceiptConfirmedAt) throw new Error('Receipt already confirmed for this booking');

    const host = await prisma.user.findUnique({ where: { id: booking.car.ownerId } });
    if (!host) throw new Error('Host account not found');
    this.assertPayoutEligible(host);

    const { platformFee, hostPayout } = await this.splitAmount(booking.totalAmount, booking.deliveryFeeAmount);
    const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.booking.update({
      where: { id: bookingId },
      data: { fleetReceiptConfirmedAt: new Date() },
    });

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

  /** Next Monday 09:00 server time — the fixed weekly payout batch run for hosts who opt into it. */
  private static nextWeeklyPayoutRun(): Date {
    const now = new Date();
    const result = new Date(now);
    const daysUntilMonday = (8 - result.getDay()) % 7 || 7;
    result.setDate(result.getDate() + daysUntilMonday);
    result.setHours(9, 0, 0, 0);
    return result;
  }

  /** Runs hourly and releases any payout whose N+1 window has matured. */
  static initializePayoutCron() {
    cron.schedule('0 * * * *', async () => {
      console.log('[PAYOUT ENGINE] Scanning for mature N+1 payouts...');
      const now = new Date();

      const maturePayouts = await prisma.payoutLedger.findMany({
        where: { status: PayoutStatus.HELD_IN_ESCROW, scheduledFor: { lte: now } },
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
          const payoutTxnId = await this.executeBankTransfer(
            payout.host.payoutAccountId,
            payout.netPayout,
            payout.booking.paymentIntentId,
            payout.id
          );
          await prisma.payoutLedger.update({
            where: { id: payout.id },
            data: { status: PayoutStatus.SETTLED, payoutTxnId },
          });
          await notify(
            payout.hostId,
            'PAYOUT_SETTLED',
            'Payout settled',
            `₹${payout.netPayout.toLocaleString()} has been sent to your linked account.`,
            '/host/dashboard'
          );
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
   * Runs hourly alongside initializePayoutCron — releases a booking's security
   * deposit (creates a RefundRequest for an admin to action manually, per the
   * "manual admin queue over live PayU refunds" decision) once the damage-claim
   * report window has passed with no claim filed. Bookings where a DamageClaim
   * exists are skipped entirely — that claim's own resolution (see
   * damageClaim.routes.ts) is what moves depositStatus forward instead.
   */
  static initializeDepositReleaseCron() {
    cron.schedule('0 * * * *', async () => {
      const cutoff = new Date(Date.now() - DEPOSIT_REPORT_WINDOW_HOURS * 60 * 60 * 1000);

      const releasable = await prisma.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          depositStatus: BookingDepositStatus.HELD,
          depositAmount: { gt: 0 },
          endTime: { lte: cutoff },
          damageClaim: null,
        },
      });

      for (const booking of releasable) {
        try {
          // A late-return fee (see /booking/:id/complete) is recovered by
          // reducing the release, same as a damage deduction would — not a
          // separate live charge.
          const releaseAmount = Math.max(0, booking.depositAmount - booking.lateFeeAmount);
          const depositStatus = booking.lateFeeAmount > 0 ? BookingDepositStatus.PARTIALLY_DEDUCTED : BookingDepositStatus.RELEASED;

          await prisma.$transaction([
            prisma.booking.update({
              where: { id: booking.id },
              data: { depositStatus, depositReleasedAt: new Date() },
            }),
            ...(releaseAmount > 0
              ? [
                  prisma.refundRequest.create({
                    data: {
                      bookingId: booking.id,
                      type: RefundRequestType.DEPOSIT_RELEASE,
                      amount: releaseAmount,
                      notes: booking.lateFeeAmount > 0 ? `₹${booking.lateFeeAmount} late-return fee deducted from the ₹${booking.depositAmount} deposit` : undefined,
                    },
                  }),
                ]
              : []),
          ]);
          console.log(
            `[DEPOSIT RELEASE] Booking ${booking.id} — ₹${releaseAmount} queued for admin refund` +
              (booking.lateFeeAmount > 0 ? ` (₹${booking.lateFeeAmount} late fee deducted)` : '')
          );
        } catch (error: any) {
          console.error(`[DEPOSIT RELEASE ERROR] Booking ${booking.id}:`, error.message);
        }
      }
    });
  }

  /**
   * Runs hourly alongside the other crons — a paid booking that sat in
   * PENDING_HOST_REVIEW past its deadline with no host response is treated
   * the same as an explicit host reject (full refund of trip cost + deposit,
   * per refund-policy §5), not auto-confirmed. Auto-confirming would defeat
   * the whole point of host review: catching a car that turned out to
   * actually be unavailable. See hostReview.routes.ts for the explicit-reject
   * counterpart this mirrors.
   */
  static initializeHostReviewTimeoutCron() {
    cron.schedule('0 * * * *', async () => {
      const expired = await prisma.booking.findMany({
        where: { status: BookingStatus.PENDING_HOST_REVIEW, hostReviewDeadline: { lt: new Date() } },
        include: { car: true },
      });

      for (const booking of expired) {
        try {
          const refundAmount = booking.totalAmount - booking.platformFee + booking.depositAmount;
          await prisma.$transaction([
            prisma.booking.update({
              where: { id: booking.id },
              data: {
                status: BookingStatus.REJECTED,
                hostReviewDeadline: null,
                rejectionReason: 'No host response within the review window',
                cancelledBy: CancelledBy.SYSTEM,
              },
            }),
            prisma.refundRequest.create({
              data: { bookingId: booking.id, type: RefundRequestType.CANCELLATION, amount: refundAmount, notes: 'Host review window expired with no response' },
            }),
          ]);
          await notify(
            booking.customerId,
            'GENERIC',
            'Booking declined',
            `The host didn't respond in time for your ${booking.car.make} ${booking.car.model} booking — you've been fully refunded.`,
            `/account/trips/${booking.id}`
          );
          console.log(`[HOST REVIEW TIMEOUT] Booking ${booking.id} auto-rejected — ₹${refundAmount} queued for admin refund`);
        } catch (error: any) {
          console.error(`[HOST REVIEW TIMEOUT ERROR] Booking ${booking.id}:`, error.message);
        }
      }
    });
  }

  /**
   * Runs hourly alongside the other crons — a booking that sat RESERVED past
   * its 24h reservationDeadline with the balance unpaid auto-cancels: dates
   * release for other guests, and the reservation fee is forfeited by design
   * (no RefundRequest — see booking.routes.ts/payuCallback.routes.ts's
   * two-stage checkout). This is the guest-paced counterpart to
   * initializeHostReviewTimeoutCron above.
   */
  static initializeReservationTimeoutCron() {
    cron.schedule('0 * * * *', async () => {
      const expired = await prisma.booking.findMany({
        where: { status: BookingStatus.RESERVED, reservationDeadline: { lt: new Date() } },
        include: { car: true },
      });

      for (const booking of expired) {
        try {
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.CANCELLED,
              cancellationReason: 'Reservation expired — balance not paid within 24h',
              cancelledBy: CancelledBy.SYSTEM,
            },
          });
          await notify(
            booking.customerId,
            'GENERIC',
            'Reservation expired',
            `Your reservation for the ${booking.car.make} ${booking.car.model} expired before the balance was paid — the ₹${booking.reservationFeeAmount} reservation fee isn't refundable, and the dates are open to other guests now.`,
            `/account/trips/${booking.id}`
          );
          console.log(`[RESERVATION TIMEOUT] Booking ${booking.id} auto-cancelled — ₹${booking.reservationFeeAmount} reservation fee forfeited`);
        } catch (error: any) {
          console.error(`[RESERVATION TIMEOUT ERROR] Booking ${booking.id}:`, error.message);
        }
      }
    });
  }

  /** Admin-triggered retry of a single FAILED payout ledger entry. */
  static async retryPayout(ledgerId: string) {
    const payout = await prisma.payoutLedger.findUnique({ where: { id: ledgerId }, include: { host: true, booking: true } });
    if (!payout) throw new Error('Payout ledger entry not found');
    if (payout.status !== PayoutStatus.FAILED) throw new Error(`Cannot retry a payout in status ${payout.status}`);
    if (!payout.host.payoutAccountId) throw new Error('Host has no linked payout account');
    if (!payout.booking.paymentIntentId) throw new Error('Underlying booking has no PayU transaction id to split from');

    try {
      const payoutTxnId = await this.executeBankTransfer(
        payout.host.payoutAccountId,
        payout.netPayout,
        payout.booking.paymentIntentId,
        payout.id
      );
      const updated = await prisma.payoutLedger.update({
        where: { id: ledgerId },
        data: { status: PayoutStatus.SETTLED, payoutTxnId },
      });
      await notify(
        payout.hostId,
        'PAYOUT_SETTLED',
        'Payout settled',
        `₹${payout.netPayout.toLocaleString()} has been sent to your linked account.`,
        '/host/dashboard'
      );
      return updated;
    } catch (error: any) {
      await prisma.payoutLedger.update({ where: { id: ledgerId }, data: { status: PayoutStatus.FAILED } });
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
  private static async executeBankTransfer(
    accountId: string,
    amount: number,
    originalTxnid: string,
    ledgerId: string
  ): Promise<string> {
    if (!config.payu.key || !config.payu.salt) {
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

    const hash = generatePayuCommandHash('payment_split', var1);

    const response = await axios.post(
      PAYU_COMMAND_URL,
      new URLSearchParams({ key: config.payu.key, command: 'payment_split', var1, hash }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const data = response.data;
    if (data?.status !== 1) {
      throw new Error(`PayU split failed: ${data?.error_desc ?? data?.message ?? 'unknown error'}`);
    }

    return `PAYU_SPLIT_${originalTxnid}_${Date.now()}`;
  }
}
