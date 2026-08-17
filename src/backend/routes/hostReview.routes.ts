import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus, RefundRequestType, CancelledBy } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { startLeaseAgreementEsign } from '../services/leaseAgreementEsign';
import { isSetuConfigured } from '../services/setuService';
import { sendBookingConfirmedNotifications } from '../services/bookingConfirmationService';

const router = Router();
const prisma = new PrismaClient();

// Reasons that mean "this specific listing needs attention right now" — the
// host gets a one-click pause prompt for these, not for e.g. "Other".
const PAUSE_SUGGESTING_REASONS = ['VEHICLE_NOT_AVAILABLE', 'VEHICLE_UNDER_SERVICE'];

// A paid booking sits here until the host verifies the car is actually
// available. Accept confirms the trip and kicks off the lease eSign (moved
// here from payuCallback.routes.ts — no point signing a lease for a booking
// that might still be declined). Reject always fully refunds the guest,
// per the published Refund & Cancellation Policy §5 ("Company-initiated
// cancellations... full refund... no cancellation fee").
router.post('/bookings/:id/host-review', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, reason, note } = req.body;
  if (!['ACCEPT', 'REJECT'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be ACCEPT or REJECT' });
  }

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Not your listing' });
  if (booking.status !== BookingStatus.PENDING_HOST_REVIEW) {
    return res.status(400).json({ error: `This booking is no longer awaiting review (status: ${booking.status})` });
  }

  if (decision === 'ACCEPT') {
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED, hostReviewDeadline: null },
    });
    await notify(updated.customerId, 'BOOKING_CONFIRMED', 'Booking confirmed!', `Your trip in the ${booking.car.make} ${booking.car.model} is booked.`, `/account/trips/${updated.id}`);

    // Best-effort, same as the original trigger site — never blocks the response.
    if (isSetuConfigured()) {
      startLeaseAgreementEsign(id).catch((err) => {
        console.error(`[HOST REVIEW] Auto eSign trigger failed for booking ${id}:`, err.response?.data ?? err.message);
      });
    }
    // Best-effort SMS/WhatsApp/email to both parties — this is "the car is
    // booked" moment (see bookingConfirmationService.ts). Never blocks the response.
    sendBookingConfirmedNotifications(id).catch((err) => {
      console.error(`[HOST REVIEW] Booking-confirmed notifications failed for booking ${id}:`, err.message);
    });
    return res.json({ success: true, data: updated });
  }

  // REJECT — always a full refund of trip cost (minus the never-refundable
  // platform fee, per policy) plus the full deposit; nothing was the guest's
  // fault here.
  const refundAmount = booking.totalAmount - booking.platformFee + booking.depositAmount;
  const rejectionReason = String(reason ?? 'Other').trim() || 'Other';

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.REJECTED,
        hostReviewDeadline: null,
        rejectionReason: note ? `${rejectionReason}: ${String(note).trim()}` : rejectionReason,
        cancelledBy: CancelledBy.HOST,
      },
    }),
    prisma.refundRequest.create({
      data: { bookingId: id, type: RefundRequestType.CANCELLATION, amount: refundAmount, notes: `Host rejected — ${rejectionReason}` },
    }),
  ]);
  await notify(
    updated.customerId,
    'GENERIC',
    'Booking declined',
    `The host declined your ${booking.car.make} ${booking.car.model} booking (${rejectionReason}) — you've been fully refunded.`,
    `/account/trips/${updated.id}`
  );

  res.json({ success: true, data: updated, suggestPause: PAUSE_SUGGESTING_REASONS.includes(reason) });
});

// A host's own pending booking requests — feeds the dashboard's "Booking
// Requests" tab and any badge/count elsewhere.
router.get('/host/booking-requests', requireAuth, async (req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    where: { status: BookingStatus.PENDING_HOST_REVIEW, car: { ownerId: req.user!.userId } },
    include: { car: { select: { make: true, model: true, id: true } }, customer: { select: { fullName: true } } },
    orderBy: { hostReviewDeadline: 'asc' },
  });
  res.json({ success: true, count: bookings.length, data: bookings });
});

export default router;
