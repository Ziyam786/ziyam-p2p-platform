import { PrismaClient, BookingStatus, ItineraryUnlockStatus } from '@prisma/client';
import { notify } from './notificationService';
import { getSetting } from './settingsService';
import { generateChatReply } from './aiService';
import { ITINERARY_DESTINATIONS } from '../routes/itinerary.routes';
import { PayoutEngine } from './payoutEngine';

const prisma = new PrismaClient();

// Must match RESERVATION_WINDOW_HOURS previously duplicated in
// booking.routes.ts/payoutEngine.ts's reservation-timeout cron.
const RESERVATION_WINDOW_HOURS = 24;

export type PaymentOutcomeKind = 'booking_reservation' | 'booking_balance' | 'issue_report' | 'itinerary' | 'unknown';

export interface PaymentOutcome {
  kind: PaymentOutcomeKind;
  entityId: string | null;
}

/**
 * Single dispatcher shared by the client-invoked verify route (fast path,
 * right after Razorpay Checkout's `handler` fires) and the webhook route
 * (authoritative backstop — covers a user closing the tab before the verify
 * call goes out). Both callers must have ALREADY verified the Razorpay
 * signature before calling this — this function trusts `orderId`/`succeeded`
 * as ground truth.
 *
 * Which of the four payment flows this is gets resolved by matching
 * `orderId` against whichever entity actually stored it (exactly mirroring
 * how the old PayU callbacks were split across four separate routes — the
 * booking reservation vs. balance stages are told apart by `booking.status`
 * alone, not by which endpoint was hit), not by trusting client-supplied
 * "kind" metadata.
 *
 * Idempotent per entity's current status, same discipline as the PayU
 * callbacks this replaces — Razorpay may retry the webhook, and the client
 * verify call can also land twice.
 */
export async function processCapturedPayment(orderId: string, paymentId: string, succeeded: boolean): Promise<PaymentOutcome> {
  const booking = await prisma.booking.findFirst({ where: { paymentIntentId: orderId }, include: { car: true } });
  if (booking) {
    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      // STAGE 1 — reservation fee. Confirms the dates only; the guest still
      // has to pay the balance (see the RESERVED branch below) before this
      // enters host review.
      if (succeeded) {
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.RESERVED,
            reservationPaidAt: new Date(),
            reservationDeadline: new Date(Date.now() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000),
            razorpayPaymentId: paymentId,
          },
          include: { car: true },
        });
        await notify(
          updated.customerId,
          'GENERIC',
          'Reservation confirmed',
          `You've reserved the ${updated.car.make} ${updated.car.model} — pay the balance within ${RESERVATION_WINDOW_HOURS}h to lock in your trip.`,
          `/account/trips/${updated.id}`
        );
      } else {
        await prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED } });
      }
      return { kind: 'booking_reservation', entityId: booking.id };
    }

    if (booking.status === BookingStatus.RESERVED) {
      // STAGE 2 — the balance payment. This is the real commitment point:
      // it's what actually enters the host-review queue. On failure we
      // leave the booking RESERVED (no state change) so the guest can retry
      // the balance payment before their reservationDeadline — mirrors the
      // old balance callback exactly.
      if (succeeded) {
        const reviewWindowHours = await getSetting<number>('host_review_window_hours', 2);
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PENDING_HOST_REVIEW,
            hostReviewDeadline: new Date(Date.now() + reviewWindowHours * 60 * 60 * 1000),
            razorpayPaymentId: paymentId,
          },
          include: { car: true },
        });
        if (booking.promoCode) {
          await prisma.promoCode.update({ where: { code: booking.promoCode }, data: { usedCount: { increment: 1 } } });
        }
        await notify(
          updated.customerId,
          'GENERIC',
          'Booking request sent',
          `Your request for the ${updated.car.make} ${updated.car.model} is awaiting host confirmation.`,
          `/account/trips/${updated.id}`
        );
        await notify(
          updated.car.ownerId,
          'GENERIC',
          'New booking request',
          `A guest wants to book your ${updated.car.make} ${updated.car.model} — accept or decline within ${reviewWindowHours}h.`,
          '/host/dashboard?tab=requests'
        );
      }
      return { kind: 'booking_balance', entityId: booking.id };
    }

    // Already processed (or cancelled) — idempotent no-op.
    return { kind: booking.reservationPaidAt ? 'booking_balance' : 'booking_reservation', entityId: booking.id };
  }

  const claim = await prisma.damageClaim.findFirst({ where: { excessChargePaymentIntentId: orderId } });
  if (claim) {
    if (!claim.excessChargePaidAt && succeeded) {
      await prisma.damageClaim.update({
        where: { id: claim.id },
        data: { excessChargePaidAt: new Date(), excessChargeRazorpayPaymentId: paymentId },
      });
      PayoutEngine.fastPayoutForIssueReport(claim.id).catch((err) => {
        console.error('[ISSUE REPORT] Fast payout failed after excess payment for claim %s:', claim.id, err.message);
      });
    }
    return { kind: 'issue_report', entityId: claim.id };
  }

  const unlock = await prisma.itineraryUnlock.findUnique({ where: { paymentIntentId: orderId } });
  if (unlock) {
    if (unlock.status === ItineraryUnlockStatus.PENDING_PAYMENT) {
      if (!succeeded) {
        await prisma.itineraryUnlock.update({ where: { id: unlock.id }, data: { status: ItineraryUnlockStatus.FAILED } });
      } else {
        const destinationBrief = ITINERARY_DESTINATIONS[unlock.destination] ?? unlock.destination;
        const systemPrompt =
          'You are a travel expert writing a road-trip itinerary for a self-drive car rental customer of ZiyamSelfDrive, ' +
          'a P2P car rental platform in Bengaluru. Write a well-organized, specific day-by-day itinerary in plain text ' +
          '(use line breaks and simple dashes for structure, no markdown headers). Include: route overview and driving ' +
          'distance/time from Bengaluru, recommended trip duration, suggested stops along the way, key attractions at the ' +
          'destination, best time to visit, and practical self-drive tips (fuel stops, road conditions, parking). Keep it ' +
          'genuinely useful and specific to the destination, not generic filler.\n\n' +
          'You have a search_available_cars tool — use it (city: "Bengaluru") to find 1-2 real, currently-bookable Ziyam ' +
          'cars suited to this trip (prefer an SUV/sedan with good boot space for a road trip over a hatchback, unless ' +
          "none are available) and recommend them by make/model/daily rate near the end, under a short 'Suggested Ziyam " +
          "cars for this trip' section. If the tool returns no cars, skip that section entirely — never invent a car or " +
          'price that search_available_cars did not actually return.';

        let generatedContent: string | null = null;
        try {
          generatedContent = await generateChatReply(
            systemPrompt,
            [{ role: 'user', content: `Write the itinerary for a Bengaluru to ${unlock.destination} road trip. ${destinationBrief}.` }],
            { enableTools: true, toolNames: ['search_available_cars'] }
          );
        } catch (err: any) {
          console.error('[RAZORPAY ITINERARY] AI generation failed for unlock %s:', unlock.id, err.message ?? err);
        }

        await prisma.itineraryUnlock.update({
          where: { id: unlock.id },
          data: { status: ItineraryUnlockStatus.PAID, generatedContent, razorpayPaymentId: paymentId },
        });
      }
    }
    return { kind: 'itinerary', entityId: unlock.id };
  }

  return { kind: 'unknown', entityId: null };
}
