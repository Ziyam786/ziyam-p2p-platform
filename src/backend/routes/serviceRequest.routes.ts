import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Unlike the Fleet Ledger (fleet-ops-only), vehicle service booking is useful
// to any host managing their own car(s), not just multi-platform fleet
// operators — so this is gated more broadly.
router.use('/services', requireAuth, requireRole('SELF_HOST', 'FLEET_OPERATOR', 'ADMIN'));

async function ownedCarIds(req: Request): Promise<string[] | undefined> {
  if (req.user!.role === 'ADMIN') return undefined;
  const cars = await prisma.car.findMany({ where: { ownerId: req.user!.userId }, select: { id: true } });
  return cars.map((c) => c.id);
}

const SERVICE_CATALOG = [
  { serviceType: 'Basic Service', description: 'Basic inspection of important vehicle components to identify potential maintenance or repair requirements.', priceFrom: 1999 },
  { serviceType: 'Standard Services', description: 'Essential car maintenance including oil, filter, fluid, brake, tyre, battery, and overall vehicle checks.', priceFrom: 5999 },
];

router.get('/services/catalog', (_req: Request, res: Response) => {
  res.json({ success: true, data: SERVICE_CATALOG });
});

router.get('/services', async (req: Request, res: Response) => {
  const ownIds = await ownedCarIds(req);
  const { carId } = req.query;
  const where: Prisma.ServiceRequestWhereInput = {
    ...(ownIds && { carId: { in: ownIds } }),
    ...(carId && { carId: String(carId) }),
  };
  const data = await prisma.serviceRequest.findMany({ where, include: { car: true }, orderBy: { scheduledDate: 'desc' } });
  res.json({ success: true, count: data.length, data });
});

router.post('/services', async (req: Request, res: Response) => {
  const { carId, serviceType, priceEstimate, scheduledDate, serviceLocation, notes } = req.body;
  if (!carId || !serviceType || priceEstimate === undefined || !scheduledDate || !serviceLocation) {
    return res.status(400).json({ error: 'carId, serviceType, priceEstimate, scheduledDate, and serviceLocation are required' });
  }
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(carId)) return res.status(403).json({ error: 'Not your vehicle' });

  const request = await prisma.serviceRequest.create({
    data: {
      carId, serviceType, priceEstimate: Number(priceEstimate), scheduledDate: new Date(scheduledDate),
      serviceLocation, notes, requestedById: req.user!.userId,
    },
  });
  res.status(201).json({ success: true, data: request });
});

router.patch('/services/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, paymentMode } = req.body;
  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service request not found' });
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(existing.carId)) return res.status(403).json({ error: 'Not your vehicle' });

  const validStatuses = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Completing a service auto-logs it as a Routine Maintenance expense in the
  // Fleet Ledger, so hosts (and fleet operators) don't have to double-enter it.
  if (status === 'COMPLETED' && existing.status !== 'COMPLETED' && !existing.fleetExpenseId) {
    const expense = await prisma.fleetExpense.create({
      data: {
        expenseType: 'ROUTINE_MAINTENANCE',
        carId: existing.carId,
        paymentMode: paymentMode ?? 'UPI',
        amount: existing.priceEstimate,
        date: new Date(),
        description: `${existing.serviceType} — auto-logged from completed service request`,
        createdById: req.user!.userId,
      },
    });
    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: { status: 'COMPLETED', fleetExpenseId: expense.id },
    });
    return res.json({ success: true, data: updated });
  }

  const updated = await prisma.serviceRequest.update({ where: { id }, data: { status } });
  res.json({ success: true, data: updated });
});

export default router;
