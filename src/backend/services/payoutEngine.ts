import { PrismaClient, PayoutStatus, BookingStatus, BookingDepositStatus, RefundRequestType, CancelledBy } from '@prisma/client';
import cron from 'node-cron';
import Razorpay from 'razorpay';
import { config } from '../config';
import { getSetting } from './settingsService';
import { notify } from './notificationService';
import { razorpayxPayoutService } from './razorpayxPayoutService';

const prisma = new PrismaClient();

let razorpayClient: Razorpay | null = null;
function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error('Razorpay key id/secret are not configured');
    }
    razorpayClient = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return razorpayClient;
}

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
   *
   * Also the single gate for the Sandbox-verified bank account and PAN
   * (Aug-2026 policy) — previously the bank check was duplicated across
   * three separate call sites; centralized here alongside PAN so there's one
   * place that decides "is this host actually payable."
   */
  private static assertPayoutEligible(host: {
    partnerAgreementWetSignedUrl: string | null;
    partnerAgreementEsignStatus: string | null;
    payoutAccountId: string | null;
    bankAccountVerified: boolean;
    isPanVerified: boolean;
  }) {
    const eligible = Boolean(host.partnerAgreementWetSignedUrl) && host.partnerAgreementEsignStatus === 'sign_complete';
    if (!eligible) {
      throw new Error(
        'Payout blocked: this host has not completed the Host Onboarding Agreement (both wet and e-signature required). ' +
        'Ask them to finish it from Account → Host Agreement.'
      );
    }
    if (!host.payoutAccountId || !host.bankAccountVerified) {
      throw new Error('Host has no linked, Sandbox-verified payout account');
    }
    if (!host.isPanVerified) {
      throw new Error('Payout blocked: this host has not completed PAN verification. Ask them to verify it from their dashboard.');
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
    let hostShare = await getSetting<number>('host_share_percentage', config.payout.hostShare);

    // commission_percentage and host_share_percentage are two INDEPENDENT
    // admin-editable settings, so nothing structurally stops them summing to
    // something other than 1. If they sum above 1 we would pay out more than
    // we ever collected, silently, on every booking until someone noticed it
    // in the bank balance — so clamp the host's share to whatever is actually
    // left after commission and make the misconfiguration loud.
    //
    // Clamping (rather than throwing) is deliberate: a bad setting must not
    // take the whole payout run down, and under-paying a host is recoverable
    // by a corrective transfer where over-paying largely is not.
    if (commission + hostShare > 1) {
      const corrected = Math.max(0, 1 - commission);
      console.error(
        '[PAYOUT] MISCONFIGURED SPLIT: commission_percentage (%s) + host_share_percentage (%s) = %s > 1. ' +
          'Clamping host share to %s for this payout. Fix these settings in admin > settings immediately.',
        commission, hostShare, commission + hostShare, corrected
      );
      hostShare = corrected;
    }

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

    // Any accumulated flat fees (e.g. the ₹149 dispute-support resolution
    // fee — see DisputeSupportRequest) come off whichever payout reaches
    // the host first, this one or a fast issue-report reimbursement.
    const feeDeducted = Math.min(host.pendingFeeDeductions, hostPayout);
    const netPayout = hostPayout - feeDeducted;

    let scheduledFor: Date;
    if (host?.payoutFrequency === 'WEEKLY') {
      scheduledFor = this.nextWeeklyPayoutRun();
    } else {
      const settlementHours = await getSetting<number>('settlement_hours', config.payout.settlementHours);
      scheduledFor = new Date(booking.endTime.getTime() + settlementHours * 60 * 60 * 1000);
    }

    const ledger = await prisma.payoutLedger.create({
      data: {
        bookingId: booking.id,
        hostId: booking.car.ownerId,
        grossAmount: booking.totalAmount,
        ziyamCut: platformFee,
        netPayout,
        status: PayoutStatus.HELD_IN_ESCROW,
        scheduledFor,
      },
    });
    if (feeDeducted > 0) {
      await prisma.user.update({ where: { id: host.id }, data: { pendingFeeDeductions: { decrement: feeDeducted } } });
    }
    return ledger;
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
          this.assertPayoutEligible(payout.host);
          if (payout.booking.source === 'AXON_PARTNER') {
            const fundAccountId = await razorpayxPayoutService.getOrCreateFundAccount(payout.host);
            const result = await razorpayxPayoutService.createPayout(fundAccountId, payout.netPayout, payout.id);
            // Left HELD_IN_ESCROW here on purpose — the webhook
            // (razorpayxWebhook.routes.ts) is the authoritative confirmation
            // and moves it to SETTLED once RazorpayX actually reports
            // `payout.processed`, same "webhook is the source of truth"
            // pattern as the existing Razorpay Payments webhook.
            await prisma.payoutLedger.update({ where: { id: payout.id }, data: { payoutTxnId: result.id } });
          } else {
            if (!payout.booking.razorpayPaymentId) {
              throw new Error('Underlying booking has no captured Razorpay payment to split from');
            }
            const payoutTxnId = await this.executeBankTransfer(
              payout.host.payoutAccountId!,
              payout.netPayout,
              payout.booking.razorpayPaymentId,
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
          }
          console.log(`[PAYOUT SUCCESS] ₹${payout.netPayout} -> host ${payout.hostId}`);
        } catch (error: any) {
          console.error('[PAYOUT ERROR] Ledger %s:', payout.id, error.message);
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
   * "manual admin queue over live gateway refunds" decision) once the damage-claim
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
          damageClaims: { none: {} },
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
          console.error('[DEPOSIT RELEASE ERROR] Booking %s:', booking.id, error.message);
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
            booking.customerId!,
            'GENERIC',
            'Booking declined',
            `The host didn't respond in time for your ${booking.car.make} ${booking.car.model} booking — you've been fully refunded.`,
            `/account/trips/${booking.id}`
          );
          console.log(`[HOST REVIEW TIMEOUT] Booking ${booking.id} auto-rejected — ₹${refundAmount} queued for admin refund`);
        } catch (error: any) {
          console.error('[HOST REVIEW TIMEOUT ERROR] Booking %s:', booking.id, error.message);
        }
      }
    });
  }

  /**
   * Runs hourly alongside the other crons — a booking that sat RESERVED past
   * its 24h reservationDeadline with the balance unpaid auto-cancels: dates
   * release for other guests, and the reservation fee is forfeited by design
   * (no RefundRequest — see booking.routes.ts/razorpayVerify.routes.ts's
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
            booking.customerId!,
            'GENERIC',
            'Reservation expired',
            `Your reservation for the ${booking.car.make} ${booking.car.model} expired before the balance was paid — the ₹${booking.reservationFeeAmount} reservation fee isn't refundable, and the dates are open to other guests now.`,
            `/account/trips/${booking.id}`
          );
          console.log(`[RESERVATION TIMEOUT] Booking ${booking.id} auto-cancelled — ₹${booking.reservationFeeAmount} reservation fee forfeited`);
        } catch (error: any) {
          console.error('[RESERVATION TIMEOUT ERROR] Booking %s:', booking.id, error.message);
        }
      }
    });
  }

  /** Admin-triggered retry of a single FAILED payout ledger entry. */
  static async retryPayout(ledgerId: string) {
    const payout = await prisma.payoutLedger.findUnique({ where: { id: ledgerId }, include: { host: true, booking: true } });
    if (!payout) throw new Error('Payout ledger entry not found');
    if (payout.status !== PayoutStatus.FAILED) throw new Error(`Cannot retry a payout in status ${payout.status}`);
    this.assertPayoutEligible(payout.host);

    if (payout.booking.source === 'AXON_PARTNER') {
      try {
        const fundAccountId = await razorpayxPayoutService.getOrCreateFundAccount(payout.host);
        const result = await razorpayxPayoutService.createPayout(fundAccountId, payout.netPayout, payout.id);
        // Left HELD_IN_ESCROW here on purpose — see initializePayoutCron above;
        // the RazorpayX webhook is what actually confirms settlement.
        return await prisma.payoutLedger.update({
          where: { id: ledgerId },
          data: { payoutTxnId: result.id },
        });
      } catch (error: any) {
        await prisma.payoutLedger.update({ where: { id: ledgerId }, data: { status: PayoutStatus.FAILED } });
        throw error;
      }
    }

    if (!payout.booking.razorpayPaymentId) throw new Error('Underlying booking has no captured Razorpay payment to split from');

    try {
      const payoutTxnId = await this.executeBankTransfer(
        payout.host.payoutAccountId!,
        payout.netPayout,
        payout.booking.razorpayPaymentId,
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
   * Called immediately after an admin approves a trip issue report (see
   * damageClaim.routes.ts's PATCH /admin/issue-reports/:id) — a SEPARATE
   * payout from the trip's regular one (createEscrowLedger already ran at
   * trip completion), reimbursing the host for the approved amount. Real
   * money movement, not just a status flag: this is what "amount will be
   * sent to host" in the reimbursement flow actually means.
   *
   * A Razorpay Route transfer splits ONE specific captured payment's held
   * funds, so the approved amount is split into up to two legs depending on where
   * it came from: the portion within the deposit splits from the booking's
   * original transaction (the deposit was charged as part of it); any
   * portion beyond the deposit splits from the guest's separate excess
   * charge (see /issue-reports/:id/pay-excess), which must have actually
   * succeeded first.
   */
  static async fastPayoutForIssueReport(claimId: string): Promise<void> {
    const claim = await prisma.damageClaim.findUnique({ where: { id: claimId }, include: { booking: { include: { car: true } } } });
    if (!claim || claim.approvedDeduction == null) throw new Error('Claim has no approved amount to pay out');
    const { booking } = claim;

    const host = await prisma.user.findUnique({ where: { id: booking.car.ownerId } });
    if (!host) throw new Error('Host account not found');
    this.assertPayoutEligible(host);
    // AXON_PARTNER bookings never carry a captured Razorpay Payments payment
    // (the partner, not Ziyam Checkout, collects the fare — see
    // axon.routes.ts) and are always created with depositAmount = 0, so the
    // deposit-portion leg below never actually fires for them. This guard
    // only protects the GUEST-path deposit-portion transfer.
    if (booking.source !== 'AXON_PARTNER' && !booking.razorpayPaymentId) {
      throw new Error('Underlying booking has no captured Razorpay payment to split from');
    }

    const depositPortion = Math.min(claim.approvedDeduction, booking.depositAmount);
    const excessPortion = Math.max(0, claim.approvedDeduction - booking.depositAmount);
    if (excessPortion > 0 && !claim.excessChargePaidAt) {
      throw new Error('The excess amount beyond the deposit has not been collected from the guest yet');
    }
    if (excessPortion > 0 && !claim.excessChargeRazorpayPaymentId) {
      throw new Error('Excess charge has no captured Razorpay payment to split from');
    }

    let netPayout = claim.approvedDeduction;
    const feeDeducted = Math.min(host.pendingFeeDeductions, netPayout);
    netPayout -= feeDeducted;

    const ledger = await prisma.payoutLedger.create({
      data: {
        bookingId: booking.id,
        hostId: host.id,
        grossAmount: claim.approvedDeduction,
        ziyamCut: 0, // full reimbursement passes through — Ziyam takes no cut on a damage/expense repayment
        netPayout,
        status: PayoutStatus.HELD_IN_ESCROW,
        scheduledFor: new Date(),
      },
    });
    if (feeDeducted > 0) {
      await prisma.user.update({ where: { id: host.id }, data: { pendingFeeDeductions: { decrement: feeDeducted } } });
    }

    try {
      const txnIds: string[] = [];
      // Fetched once and reused for both legs below — getOrCreateFundAccount
      // is idempotent but there's no reason to round-trip it twice for the
      // same host within a single reimbursement.
      const axonFundAccountId =
        booking.source === 'AXON_PARTNER' ? await razorpayxPayoutService.getOrCreateFundAccount(host) : null;

      if (depositPortion > 0) {
        const amount = excessPortion > 0 ? depositPortion : netPayout; // single-leg case carries the fee-adjusted total
        if (booking.source === 'AXON_PARTNER') {
          const result = await razorpayxPayoutService.createPayout(axonFundAccountId!, amount, ledger.id);
          txnIds.push(result.id);
        } else {
          txnIds.push(await this.executeBankTransfer(host.payoutAccountId!, amount, booking.razorpayPaymentId!, ledger.id));
        }
      }
      if (excessPortion > 0) {
        const amount = depositPortion > 0 ? netPayout - depositPortion : netPayout;
        if (booking.source === 'AXON_PARTNER') {
          const result = await razorpayxPayoutService.createPayout(axonFundAccountId!, amount, ledger.id);
          txnIds.push(result.id);
        } else {
          txnIds.push(await this.executeBankTransfer(host.payoutAccountId!, amount, claim.excessChargeRazorpayPaymentId!, ledger.id));
        }
      }

      if (booking.source === 'AXON_PARTNER') {
        // Left HELD_IN_ESCROW here on purpose — same "webhook is the
        // authoritative confirmation" reasoning as the other two RazorpayX
        // call sites above.
        await prisma.payoutLedger.update({ where: { id: ledger.id }, data: { payoutTxnId: txnIds.join(',') } });
      } else {
        await prisma.payoutLedger.update({ where: { id: ledger.id }, data: { status: PayoutStatus.SETTLED, payoutTxnId: txnIds.join(',') } });
        await notify(
          host.id,
          'PAYOUT_SETTLED',
          'Reimbursement sent',
          `₹${netPayout.toLocaleString()} for your approved trip issue report has been sent to your linked account.`,
          '/host/dashboard'
        );
      }
    } catch (error: any) {
      await prisma.payoutLedger.update({ where: { id: ledger.id }, data: { status: PayoutStatus.FAILED } });
      throw error;
    }
  }

  /**
   * Moves a host's cut out of our aggregator Razorpay account after the
   * fact, using Razorpay Route's "create transfers from payment" API
   * (`POST /payments/{id}/transfers`). `accountId` is the host's Razorpay
   * *linked account id* (`acc_...`) — hosts must already be onboarded as a
   * Razorpay Route linked account for this to succeed; that onboarding is a
   * manual/KYC business process on Razorpay's side, not something this app
   * can do for them. `razorpayPaymentId` is the CAPTURED PAYMENT id (not
   * the order id — Route transfers split a specific payment, and only a
   * payment, not an order), i.e. Booking.razorpayPaymentId /
   * DamageClaim.excessChargeRazorpayPaymentId, set once
   * razorpayPaymentHandler.ts has confirmed the payment.
   *
   * We only request the host's own line item here — Razorpay leaves
   * whatever isn't transferred on the aggregator (platform) account, same
   * "remainder implicitly stays with us" behavior the old gateway integration
   * relied on, so no second transfer entry for our own cut is needed.
   */
  private static async executeBankTransfer(
    accountId: string,
    amount: number,
    razorpayPaymentId: string,
    ledgerId: string
  ): Promise<string> {
    const { items } = await getRazorpayClient().payments.transfer(razorpayPaymentId, {
      transfers: [
        {
          account: accountId,
          amount: Math.round(amount * 100),
          currency: 'INR',
          notes: { payoutLedgerId: ledgerId },
        },
      ],
    });

    const transfer = items[0];
    if (!transfer?.id) {
      throw new Error('Razorpay transfer did not return a transfer id');
    }

    return transfer.id;
  }
}
