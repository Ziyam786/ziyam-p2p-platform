import { Router, Request, Response } from 'express';
import { PrismaClient, DisputeSupportChannel, DisputeSupportStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { pickLeastLoadedDisputeAgent } from '../services/agentAssignment';
import { sendTemplateWhatsapp, isWhatsappConfigured } from '../services/whatsappService';

const router = Router();
const prisma = new PrismaClient();

// Protection plans that include phone/WhatsApp-routed human dispute
// mediation — BASIC does not. Matches the plan tiers already used
// throughout booking.routes.ts (VALID_PLANS).
const CONCIERGE_ELIGIBLE_PLANS = ['STANDARD', 'PREMIUM'];

// Guest requests a human agent for a dispute on their booking — reuses the
// same agent pool/least-loaded assignment as OpsTrip and wash-service
// requests, just a separate open-job queue.
router.post('/bookings/:id/dispute-support', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { channel } = req.body;
  if (!Object.values(DisputeSupportChannel).includes(channel)) {
    return res.status(400).json({ error: 'channel must be PHONE or WHATSAPP' });
  }

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, customer: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (!CONCIERGE_ELIGIBLE_PLANS.includes(booking.protectionPlan)) {
    return res.status(403).json({ error: 'Dispute support is available on Standard and Premium protection plans only.' });
  }

  const existing = await prisma.disputeSupportRequest.findFirst({
    where: { bookingId: id, status: { in: [DisputeSupportStatus.OPEN, DisputeSupportStatus.IN_PROGRESS] } },
  });
  if (existing) return res.status(409).json({ error: 'A dispute support request is already open for this booking' });

  const assignedAgentId = await pickLeastLoadedDisputeAgent();
  const request = await prisma.disputeSupportRequest.create({
    data: { bookingId: id, requestedById: req.user!.userId, channel, assignedAgentId: assignedAgentId ?? undefined },
  });

  if (assignedAgentId) {
    await notify(
      assignedAgentId,
      'GENERIC',
      'New dispute support request',
      `${booking.customer.fullName} needs help with their ${booking.car.make} ${booking.car.model} trip via ${channel === 'PHONE' ? 'phone' : 'WhatsApp'}.`,
      `/admin/dispute-support`
    );
    if (channel === 'WHATSAPP' && isWhatsappConfigured()) {
      const agent = await prisma.user.findUnique({ where: { id: assignedAgentId }, select: { phoneNumber: true } });
      if (agent?.phoneNumber) {
        sendTemplateWhatsapp(agent.phoneNumber, 'dispute_support_request', {
          guest_name: booking.customer.fullName,
          car: `${booking.car.make} ${booking.car.model}`,
          booking_id: id,
        }).catch(() => {});
      }
    }
  }

  res.status(201).json({ success: true, data: request });
});

// Guest checks the status of their own request(s) for a booking.
router.get('/bookings/:id/dispute-support', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });

  const requests = await prisma.disputeSupportRequest.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: requests });
});

// Admin/agent queue.
router.get('/admin/dispute-support', requireAuth, requireRole('ADMIN', 'AGENT'), async (req: Request, res: Response) => {
  const { status } = req.query;
  const requests = await prisma.disputeSupportRequest.findMany({
    where: status ? { status: status as DisputeSupportStatus } : undefined,
    include: {
      booking: { include: { car: true, customer: { select: { id: true, fullName: true, email: true, phoneNumber: true } } } },
      assignedAgent: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: requests.length, data: requests });
});

// Marks a request resolved — the ₹149 host fee is queued for deduction from
// the host's next payout (whichever comes first: their regular trip payout
// or a fast issue-report reimbursement — see payoutEngine.ts), never
// charged directly, since hosts have no stored payment method for that.
router.patch('/admin/dispute-support/:id/resolve', requireAuth, requireRole('ADMIN', 'AGENT'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const request = await prisma.disputeSupportRequest.findUnique({ where: { id }, include: { booking: { include: { car: true } } } });
  if (!request) return res.status(404).json({ error: 'Dispute support request not found' });
  if (request.status === DisputeSupportStatus.RESOLVED) return res.status(400).json({ error: 'Already resolved' });

  const now = new Date();
  await prisma.$transaction([
    prisma.disputeSupportRequest.update({
      where: { id },
      data: { status: DisputeSupportStatus.RESOLVED, resolvedAt: now, hostFeeCharged: true },
    }),
    prisma.user.update({
      where: { id: request.booking.car.ownerId },
      data: { pendingFeeDeductions: { increment: request.hostFeeAmount } },
    }),
  ]);

  await notify(
    request.booking.car.ownerId,
    'GENERIC',
    'Dispute resolved via Ziyam support',
    `A dispute on your ${request.booking.car.make} ${request.booking.car.model} trip was resolved with agent support — a ₹${request.hostFeeAmount} fee will be deducted from your next payout.`,
    '/host/dashboard'
  );

  res.json({ success: true, message: 'Dispute marked resolved.' });
});

export default router;
