import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus, DamageClaimStatus, TripIssueType, BookingDepositStatus, RefundRequestType } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { PayoutEngine } from '../services/payoutEngine';
import paymentGateway from '../services/paymentGateway';
import { safeErrorMessage } from '../utils/errorResponse';

import { computeDepositDeduction } from '../utils/depositDeduction';
const router = Router();
const prisma = new PrismaClient();

// Either party must report an issue against a completed trip's deposit
// within this window — matches the 24-hour figure already published in the
// Host FAQ. Kept in sync manually with DEPOSIT_REPORT_WINDOW_HOURS in payoutEngine.ts.
const REPORT_WINDOW_HOURS = 24;

// Either party reports a trip issue (damage/fuel/FASTag) against a
// completed booking's security deposit — a booking can have several
// (previously host-only and hard-capped at exactly one ever).
router.post('/bookings/:id/issue-reports', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, description, estimatedCost, images } = req.body;

  if (!Object.values(TripIssueType).includes(type)) {
    return res.status(400).json({ error: 'type must be DAMAGE, FUEL, or FASTAG' });
  }
  if (!description || !String(description).trim()) return res.status(400).json({ error: 'description is required' });
  if (typeof estimatedCost !== 'number' || estimatedCost <= 0) return res.status(400).json({ error: 'estimatedCost must be a positive number' });

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });
  if (booking.status !== BookingStatus.COMPLETED) return res.status(400).json({ error: 'Issues can only be reported on a completed trip' });

  const reportDeadline = new Date(booking.endTime.getTime() + REPORT_WINDOW_HOURS * 60 * 60 * 1000);
  if (new Date() > reportDeadline) {
    return res.status(400).json({ error: `Issues must be reported within ${REPORT_WINDOW_HOURS} hours of trip end` });
  }

  const claim = await prisma.damageClaim.create({
    data: {
      bookingId: id,
      reportedById: req.user!.userId,
      type,
      description: String(description).trim(),
      estimatedCost,
      images: Array.isArray(images) ? images.filter((u: unknown) => typeof u === 'string') : [],
    },
  });

  const recipientId = isCustomer ? booking.car.ownerId : booking.customerId!;
  await notify(
    recipientId,
    'GENERIC',
    `${type === 'DAMAGE' ? 'Damage' : type === 'FUEL' ? 'Fuel' : 'FASTag'} issue reported`,
    `${isCustomer ? 'The guest' : 'The host'} reported an issue on your ${booking.car.make} ${booking.car.model} trip — our team will review it.`,
    `/account/trips/${booking.id}`
  );

  res.status(201).json({ success: true, data: claim });
});

// Either party can list every issue report for their booking.
router.get('/bookings/:id/issue-reports', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Not part of this booking' });

  const reports = await prisma.damageClaim.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, count: reports.length, data: reports });
});

// Host uploads the real repair bill + photos once the repair is actually
// done — "host is guided to the garage, repair is done, host uploads the
// accurate bill" step. Queues for admin's fast-track review instead of the
// plain-estimate-only review the claim started with.
router.patch('/issue-reports/:id/submit-bill', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { billUrl, billAmount, photos } = req.body;

  if (!billUrl || typeof billUrl !== 'string') return res.status(400).json({ error: 'billUrl is required' });
  if (typeof billAmount !== 'number' || billAmount <= 0) return res.status(400).json({ error: 'billAmount must be a positive number' });

  const claim = await prisma.damageClaim.findUnique({ where: { id }, include: { booking: { include: { car: true } } } });
  if (!claim) return res.status(404).json({ error: 'Issue report not found' });
  if (claim.booking.car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can submit a repair bill' });
  const billableStatuses: DamageClaimStatus[] = [DamageClaimStatus.SUBMITTED, DamageClaimStatus.UNDER_REVIEW];
  if (!billableStatuses.includes(claim.status)) {
    return res.status(400).json({ error: `Cannot submit a bill for a claim in status ${claim.status}` });
  }

  const updated = await prisma.damageClaim.update({
    where: { id },
    data: {
      status: DamageClaimStatus.BILL_SUBMITTED,
      resolutionBillUrl: billUrl,
      resolutionBillAmount: billAmount,
      resolutionPhotos: Array.isArray(photos) ? photos.filter((u: unknown) => typeof u === 'string') : [],
      resolutionSubmittedAt: new Date(),
    },
  });
  res.json({ success: true, data: updated });
});

// Guest pays the portion of an approved claim that exceeds the held
// deposit — a real Razorpay charge, not an IOU. Only reachable once an
// admin has approved the claim for more than the deposit covers.
router.post('/issue-reports/:id/pay-excess', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const claim = await prisma.damageClaim.findUnique({
    where: { id },
    include: { booking: { include: { car: true, customer: true } } },
  });
  if (!claim) return res.status(404).json({ error: 'Issue report not found' });
  if (claim.booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (claim.status !== DamageClaimStatus.APPROVED || !claim.excessChargeAmount) {
    return res.status(400).json({ error: 'No excess amount is due on this claim' });
  }
  if (claim.excessChargePaidAt) return res.status(400).json({ error: 'The excess amount has already been paid' });

  try {
    const checkout = await paymentGateway.initiateCheckout({
      amount: claim.excessChargeAmount,
      receipt: `issue_${claim.id.slice(0, 20)}`,
      notes: { kind: 'issue_report', claimId: claim.id },
    });
    // Stored on the CLAIM, never on Booking.paymentIntentId — that field is
    // the original trip transaction, still needed later for the
    // deposit-portion split in PayoutEngine.fastPayoutForIssueReport.
    await prisma.damageClaim.update({ where: { id }, data: { excessChargePaymentIntentId: checkout.orderId } });
    res.json({ success: true, data: checkout });
  } catch (error: any) {
    console.error('[pay-excess] payment init failed:', error);
    res.status(502).json({ error: `Could not start payment: ${safeErrorMessage(error)}` });
  }
});

// Admin review queue.
router.get('/admin/issue-reports', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { status } = req.query;
  const reports = await prisma.damageClaim.findMany({
    where: status ? { status: status as DamageClaimStatus } : undefined,
    include: {
      booking: { include: { car: true, customer: { select: { id: true, fullName: true, email: true } } } },
      reportedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: reports.length, data: reports });
});

// Admin resolves a claim — approves a deduction (partial, full, or beyond
// the deposit) or rejects it outright.
router.patch('/admin/issue-reports/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, approvedDeduction, adminNotes } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
  }

  const claim = await prisma.damageClaim.findUnique({ where: { id }, include: { booking: true } });
  if (!claim) return res.status(404).json({ error: 'Issue report not found' });
  const resolvableStatuses: DamageClaimStatus[] = [DamageClaimStatus.SUBMITTED, DamageClaimStatus.UNDER_REVIEW, DamageClaimStatus.BILL_SUBMITTED];
  if (!resolvableStatuses.includes(claim.status)) {
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
    await notify(booking.customerId!, 'GENERIC', 'Issue report rejected', 'The issue reported on your trip was rejected — your full deposit is queued for release.', `/account/trips/${booking.id}`);
    return res.json({ success: true, message: 'Claim rejected, full deposit queued for release.' });
  }

  if (typeof approvedDeduction !== 'number' || approvedDeduction <= 0) {
    return res.status(400).json({ error: 'approvedDeduction must be a positive number when approving' });
  }

  // Arithmetic lives in utils/depositDeduction.ts so it can be tested directly
  // — see tests/depositDeduction.test.ts, which pins the two reconciliation
  // invariants (deposit splits exactly; deduction is fully accounted for).
  const { depositPortion, remainder, excessPortion, forfeited, depositStatus } =
    computeDepositDeduction(approvedDeduction, booking.depositAmount);

  const ops: any[] = [
    prisma.damageClaim.update({
      where: { id },
      data: {
        status: DamageClaimStatus.APPROVED,
        approvedDeduction,
        adminNotes,
        reviewedByAdminId: req.user!.userId,
        resolvedAt: now,
        ...(excessPortion > 0 && { excessChargeAmount: excessPortion }),
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        depositStatus,
        ...(!forfeited && { depositReleasedAt: now }),
      },
    }),
  ];
  if (remainder > 0) {
    ops.push(
      prisma.refundRequest.create({
        data: { bookingId: booking.id, type: RefundRequestType.DEPOSIT_PARTIAL, amount: remainder },
      })
    );
  }
  await prisma.$transaction(ops);

  if (excessPortion > 0) {
    await notify(
      booking.customerId!,
      'GENERIC',
      'Issue report resolved — balance due',
      `Your trip's issue report was approved for ₹${approvedDeduction.toLocaleString('en-IN')}. Your ₹${booking.depositAmount.toLocaleString('en-IN')} deposit covers part of it — please pay the remaining ₹${excessPortion.toLocaleString('en-IN')} from your trip page.`,
      `/account/trips/${booking.id}`
    );
    // Fast payout waits for the excess charge to actually succeed —
    // triggered from the Razorpay excess-charge confirmation instead.
  } else {
    await notify(
      booking.customerId!,
      'GENERIC',
      'Issue report resolved',
      forfeited
        ? 'The issue reported on your trip was approved for the full deposit amount.'
        : `The issue reported on your trip was approved for ₹${depositPortion.toLocaleString('en-IN')} — the remaining ₹${remainder.toLocaleString('en-IN')} is queued for release.`,
      `/account/trips/${booking.id}`
    );
    // Whole approved amount fits inside the deposit — pay the host now, no guest action needed.
    PayoutEngine.fastPayoutForIssueReport(id).catch((err) => {
      console.error('[ISSUE REPORT] Fast payout failed for claim %s:', id, err.message);
    });
  }

  res.json({ success: true, message: 'Claim approved.' });
});

export default router;
