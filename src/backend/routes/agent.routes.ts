import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

router.use('/agent', requireAuth, requireRole('AGENT', 'ADMIN'));

// An admin previewing the portal sees everyone's queue; an agent sees only their own.
function assignedFilter(req: Request) {
  return req.user!.role === 'ADMIN' ? {} : { assignedAgentId: req.user!.userId };
}

router.get('/agent/service-requests', async (req: Request, res: Response) => {
  const requests = await prisma.serviceRequest.findMany({
    where: assignedFilter(req),
    include: {
      car: { select: { make: true, model: true, registrationNo: true, city: true, images: true } },
      requestedBy: { select: { fullName: true, phoneNumber: true } },
      booking: { select: { id: true, startTime: true, endTime: true } },
    },
    orderBy: { scheduledDate: 'desc' },
  });
  res.json({ success: true, count: requests.length, data: requests });
});

router.patch('/agent/service-requests/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service request not found' });
  if (req.user!.role !== 'ADMIN' && existing.assignedAgentId !== req.user!.userId) {
    return res.status(403).json({ error: 'Not assigned to you' });
  }

  const updated = await prisma.serviceRequest.update({ where: { id }, data: { status } });
  if (status === 'COMPLETED') {
    await notify(existing.requestedById, 'GENERIC', 'Wash service completed', `Your ${existing.serviceType.toLowerCase()} service is done.`, '/bookings');
  }
  res.json({ success: true, data: updated });
});

// Minimal car picker for the standalone Agent app's check-in/booking flows —
// /admin/cars is ADMIN-only, and ground-staff need to pick from every active
// vehicle (not just currently-available ones, since availability doesn't
// track walk-in OpsTrip usage — see opsTrip.routes.ts).
router.get('/agent/cars', async (_req: Request, res: Response) => {
  const cars = await prisma.car.findMany({
    where: { fleetStatus: 'active' },
    select: {
      id: true, make: true, model: true, registrationNo: true, city: true, images: true,
      dailyRate: true, securityDeposit: true, kmIncludedPerDay: true, extraKmCharge: true,
    },
    orderBy: { make: 'asc' },
  });
  res.json({ success: true, count: cars.length, data: cars });
});

/* ── Cash Counter — the agent's running cash-in/cash-out ledger ─────────── */

function cashLogFilter(req: Request) {
  return req.user!.role === 'ADMIN' && req.query.agentId ? { agentId: String(req.query.agentId) } : { agentId: req.user!.userId };
}

router.get('/agent/cash-log', async (req: Request, res: Response) => {
  const { days } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - (days ? Number(days) : 60));

  const entries = await prisma.cashLogEntry.findMany({
    where: { ...cashLogFilter(req), createdAt: { gte: since } },
    include: { trip: { select: { customerName: true, car: { select: { make: true, model: true, registrationNo: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const cashIn = entries.filter((e) => e.type === 'CASH_IN').reduce((sum, e) => sum + e.amount, 0);
  const cashOut = entries.filter((e) => e.type === 'CASH_OUT').reduce((sum, e) => sum + e.amount, 0);

  res.json({ success: true, count: entries.length, data: entries, summary: { cashIn, cashOut, net: cashIn - cashOut } });
});

router.post('/agent/cash-log', async (req: Request, res: Response) => {
  const { type, amount, category, note, tripId } = req.body;
  if (!['CASH_IN', 'CASH_OUT'].includes(type)) return res.status(400).json({ error: 'type must be CASH_IN or CASH_OUT' });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  if (!category || !String(category).trim()) return res.status(400).json({ error: 'category is required' });

  if (tripId) {
    const trip = await prisma.opsTrip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
  }

  const entry = await prisma.cashLogEntry.create({
    data: { agentId: req.user!.userId, type, amount: Number(amount), category: String(category).trim(), note, tripId: tripId || undefined },
  });
  res.status(201).json({ success: true, data: entry });
});

export default router;
