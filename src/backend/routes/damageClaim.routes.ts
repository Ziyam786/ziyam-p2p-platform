import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus, DamageClaimStatus, BookingDepositStatus, RefundRequestType } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

// A host must report damage against a completed trip's deposit within this
// window — matches the 24-hour figure already published in the Host FAQ
// ("Contact support with your booking ID and photos within 24 hours of trip
// end") so this system doesn't ship contradicting content that's already live.
// Kept in sync manually with DEPOSIT_REPORT_WINDOW_HOURS in payoutEngine.ts.
const REPORT_WINDOW_HOURS = 24;

// Host reports damage against a completed booking's security deposit —
// replaces the old "contact support" advisory-only flow with a real ticket.
router.post('/bookings/:id/damage-claim', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, estimatedCost, images } = req.body;

  if (!description || !String(description).trim()) return res.status(400).json({ error: 'description is required' });
  if (typeof estimatedCost !== 'number' || estimatedCost <= 0) return res.status(400).json({ error: 'estimatedCost must be a positive number' });

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, damageClaim: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can report damage on this booking' });
  if (booking.status !== BookingStatus.COMPLETED) return res.status(400).json({ error: 'Damage can only be reported on a completed trip' });
  if (booking.damageClaim) return res.status(409).json({ error: 'A damage claim already exists for this booking' });

  const reportDeadline = new Date(booking.endTime.getTime() + REPORT_WINDOW_HOURS * 60 * 60 * 1000);
  if (new Date() > reportDeadline) {
    return res.status(400).json({ error: `Damage must be reported within ${REPORT_WINDOW_HOURS} hours of trip end` });
  }

  const claim = await prisma.damageClaim.create({
    data: {
      bookingId: id,
      reportedById: req.user!.userId,
      description: String(description).trim(),
      estimatedCost,
      images: Array.isArray(images) ? images.filter((u: unknown) => typeof u === 'string') : [],
    },
  });

  await notify(
    booking.customerId,
    'GENERIC',
    'Damage reported on your trip',
    `The host reported damage on your ${booking.car.make} ${booking.car.model} trip — our team will review it.`,
    `/account/trips/${booking.id}`
  );

  res.status(201).json({ success: true, data: claim });
});

// Either party on the booking (or an admin) can check claim status.
router.get('/bookings/:id/damage-claim', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, damageClaim: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Not part of this booking' });

  res.json({ success: true, data: booking.damageClaim });
});

// Admin review queue.
router.get('/admin/damage-claims', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { status } = req.query;
  const claims = await prisma.damageClaim.findMany({
    where: status ? { status: status as DamageClaimStatus } : undefined,
    include: {
      booking: { include: { car: true, customer: { select: { id: true, fullName: true, email: true } } } },
      reportedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: claims.length, data: claims });
});

// Admin resolves a claim — approves a deduction (partial or full) or rejects
// it outright. Either resolution moves the held deposit forward: an approval
// forfeits some/all of it to cover the damage, a rejection releases all of it
// back to the guest via a RefundRequest for an admin to action manually.
router.patch('/admin/damage-claims/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, approvedDeduction, adminNotes } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
  }

  const claim = await prisma.damageClaim.findUnique({ where: { id }, include: { booking: true } });
  if (!claim) return res.status(404).json({ error: 'Damage claim not found' });
  if (claim.status !== DamageClaimStatus.SUBMITTED && claim.status !== DamageClaimStatus.UNDER_REVIEW) {
    return res.status(400).json({ error: `Claim already resolved (${claim.status})` });
  }

  const { booking } = claim;
  const now = new Date();

  if (status === 'REJECTED') {
    await prisma.$transaction([
      prisma.damageClaim.update({
        where: { id },
        data: { status: DamageClaimStatus.REJECTED, adminNotes, reviewedByAdminId: req.user!.userId, resolvedAt: now },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: { depositStatus: BookingDepositStatus.RELEASED, depositReleasedAt: now },
      }),
      prisma.refundRequest.create({
        data: { bookingId: booking.id, type: RefundRequestType.DEPOSIT_RELEASE, amount: booking.depositAmount },
      }),
    ]);
    await notify(booking.customerId, 'GENERIC', 'Damage claim rejected', 'The damage claim on your trip was rejected — your full deposit is queued for release.', `/account/trips/${booking.id}`);
    return res.json({ success: true, message: 'Claim rejected, full deposit queued for release.' });
  }

  if (typeof approvedDeduction !== 'number' || approvedDeduction <= 0) {
    return res.status(400).json({ error: 'approvedDeduction must be a positive number when approving' });
  }
  const deduction = Math.min(approvedDeduction, booking.depositAmount);
  const remainder = booking.depositAmount - deduction;
  const forfeited = remainder <= 0;

  const ops: any[] = [
    prisma.damageClaim.update({
      where: { id },
      data: { status: DamageClaimStatus.APPROVED, approvedDeduction: deduction, adminNotes, reviewedByAdminId: req.user!.userId, resolvedAt: now },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        depositStatus: forfeited ? BookingDepositStatus.FORFEITED : BookingDepositStatus.PARTIALLY_DEDUCTED,
        ...(!forfeited && { depositReleasedAt: now }),
      },
    }),
  ];
  if (!forfeited) {
    ops.push(
      prisma.refundRequest.create({
        data: { bookingId: booking.id, type: RefundRequestType.DEPOSIT_PARTIAL, amount: remainder },
      })
    );
  }
  await prisma.$transaction(ops);

  await notify(
    booking.customerId,
    'GENERIC',
    'Damage claim resolved',
    forfeited
      ? 'The damage claim on your trip was approved for the full deposit amount.'
      : `The damage claim on your trip was approved for ₹${deduction} — the remaining ₹${remainder} is queued for release.`,
    `/account/trips/${booking.id}`
  );
  res.json({ success: true, message: 'Claim approved.' });
});

export default router;
