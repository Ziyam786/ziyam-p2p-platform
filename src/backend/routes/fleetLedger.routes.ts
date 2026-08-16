import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Fleet-financial data is internal ops tooling: fleet operators see only their
// own cars' entries, admins see everything.
router.use('/fleet', requireAuth, requireRole('FLEET_OPERATOR', 'ADMIN'));

async function ownedCarIds(req: Request): Promise<string[] | undefined> {
  if (req.user!.role === 'ADMIN') return undefined; // no restriction
  const cars = await prisma.car.findMany({ where: { ownerId: req.user!.userId }, select: { id: true } });
  return cars.map((c) => c.id);
}

function parseFilters(query: Request['query']) {
  const { carId, platform, category, from, to } = query;
  const dateRange: Prisma.DateTimeFilter = {};
  if (from) dateRange.gte = new Date(String(from));
  if (to) dateRange.lte = new Date(String(to));
  return {
    carId: carId ? String(carId) : undefined,
    platform: platform && platform !== 'All' ? String(platform) : undefined,
    category: category && category !== 'All' ? String(category) : undefined,
    dateRange: from || to ? dateRange : undefined,
  };
}

/* ── Platform Bookings (cross-platform revenue) ──────────────────────── */

router.get('/fleet/bookings', async (req: Request, res: Response) => {
  const ownIds = await ownedCarIds(req);
  const { carId, platform, dateRange } = parseFilters(req.query);
  const where: Prisma.PlatformBookingWhereInput = {
    ...(ownIds && { carId: { in: ownIds } }),
    ...(carId && { carId }),
    ...(platform && { platform: platform as any }),
    ...(dateRange && { bookedAt: dateRange }),
  };
  const data = await prisma.platformBooking.findMany({ where, include: { car: true }, orderBy: { bookedAt: 'desc' } });
  res.json({ success: true, count: data.length, data });
});

router.post('/fleet/bookings', async (req: Request, res: Response) => {
  const { carId, platform, externalBookingId, bookedAt, totalFare, doorstepCharges, platformCommission, expectedCreditDate } = req.body;
  if (!carId || !platform || !externalBookingId || !bookedAt || totalFare === undefined) {
    return res.status(400).json({ error: 'carId, platform, externalBookingId, bookedAt, and totalFare are required' });
  }
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(carId)) return res.status(403).json({ error: 'Not your vehicle' });

  try {
    const entry = await prisma.platformBooking.create({
      data: {
        carId, platform, externalBookingId, bookedAt: new Date(bookedAt),
        totalFare: Number(totalFare), doorstepCharges: Number(doorstepCharges ?? 0),
        platformCommission: platformCommission !== undefined ? Number(platformCommission) : undefined,
        expectedCreditDate: expectedCreditDate ? new Date(expectedCreditDate) : undefined,
        createdById: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A booking with this Booking ID already exists for this platform' });
    throw err;
  }
});

// Marks a platform booking's revenue as actually credited/received — gates
// Command Center cash-position math (see ground-truthed tripCredited() logic).
router.patch('/fleet/bookings/:id/received', async (req: Request, res: Response) => {
  const entry = await prisma.platformBooking.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(entry.carId)) return res.status(403).json({ error: 'Not your vehicle' });
  const updated = await prisma.platformBooking.update({ where: { id: req.params.id }, data: { received: true } });
  res.json({ success: true, data: updated });
});

router.delete('/fleet/bookings/:id', async (req: Request, res: Response) => {
  const entry = await prisma.platformBooking.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(entry.carId)) return res.status(403).json({ error: 'Not your vehicle' });
  await prisma.platformBooking.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/* ── Journal Entries (collections & settlements) ─────────────────────── */

router.get('/fleet/journal-entries', async (req: Request, res: Response) => {
  const ownIds = await ownedCarIds(req);
  const { carId, category, dateRange } = parseFilters(req.query);
  const where: Prisma.JournalEntryWhereInput = {
    ...(ownIds && { carId: { in: ownIds } }),
    ...(carId && { carId }),
    ...(category && { category: category as any }),
    ...(dateRange && { collectionDate: dateRange }),
  };
  const data = await prisma.journalEntry.findMany({ where, include: { car: true }, orderBy: { collectionDate: 'desc' } });
  res.json({ success: true, count: data.length, data });
});

router.post('/fleet/journal-entries', async (req: Request, res: Response) => {
  const { carId, collectionDate, amountCollected, totalAmount, category, remarks } = req.body;
  if (!carId || !collectionDate || amountCollected === undefined || totalAmount === undefined || !category) {
    return res.status(400).json({ error: 'carId, collectionDate, amountCollected, totalAmount, and category are required' });
  }
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(carId)) return res.status(403).json({ error: 'Not your vehicle' });

  const entry = await prisma.journalEntry.create({
    data: {
      carId, collectionDate: new Date(collectionDate), amountCollected: Number(amountCollected),
      totalAmount: Number(totalAmount), category, remarks, createdById: req.user!.userId,
    },
  });
  res.status(201).json({ success: true, data: entry });
});

router.delete('/fleet/journal-entries/:id', async (req: Request, res: Response) => {
  const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const ownIds = await ownedCarIds(req);
  if (ownIds && !ownIds.includes(entry.carId)) return res.status(403).json({ error: 'Not your vehicle' });
  await prisma.journalEntry.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/* ── Fleet Expenses ───────────────────────────────────────────────────── */

router.get('/fleet/expenses', async (req: Request, res: Response) => {
  const ownIds = await ownedCarIds(req);
  const { carId, dateRange } = parseFilters(req.query);
  const { expenseType } = req.query;
  const where: Prisma.FleetExpenseWhereInput = {
    ...(ownIds && { OR: [{ carId: { in: ownIds } }, { carId: null }] }),
    ...(carId && { carId }),
    ...(expenseType && expenseType !== 'All' && { expenseType: String(expenseType) as any }),
    ...(dateRange && { date: dateRange }),
  };
  const data = await prisma.fleetExpense.findMany({ where, include: { car: true }, orderBy: { date: 'desc' } });
  res.json({ success: true, count: data.length, data });
});

router.post('/fleet/expenses', async (req: Request, res: Response) => {
  const { expenseType, carId, paymentMode, paidTo, amount, date, description } = req.body;
  if (!expenseType || !paymentMode || amount === undefined || !date) {
    return res.status(400).json({ error: 'expenseType, paymentMode, amount, and date are required' });
  }
  if (carId) {
    const ownIds = await ownedCarIds(req);
    if (ownIds && !ownIds.includes(carId)) return res.status(403).json({ error: 'Not your vehicle' });
  }

  const entry = await prisma.fleetExpense.create({
    data: {
      expenseType, carId: carId || undefined, paymentMode, paidTo, amount: Number(amount),
      date: new Date(date), description, createdById: req.user!.userId,
    },
  });
  res.status(201).json({ success: true, data: entry });
});

router.delete('/fleet/expenses/:id', async (req: Request, res: Response) => {
  const entry = await prisma.fleetExpense.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  if (entry.carId) {
    const ownIds = await ownedCarIds(req);
    if (ownIds && !ownIds.includes(entry.carId)) return res.status(403).json({ error: 'Not your vehicle' });
  }
  await prisma.fleetExpense.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/* ── Summary analytics (drives the dashboard's stat cards + charts) ─────── */

router.get('/fleet/summary', async (req: Request, res: Response) => {
  const ownIds = await ownedCarIds(req);
  const { carId, dateRange } = parseFilters(req.query);
  const carFilter = ownIds ? { in: ownIds } : undefined;

  const [bookings, journalEntries, expenses] = await Promise.all([
    prisma.platformBooking.findMany({
      where: { ...(carFilter && { carId: carFilter }), ...(carId && { carId }), ...(dateRange && { bookedAt: dateRange }) },
    }),
    prisma.journalEntry.findMany({
      where: { ...(carFilter && { carId: carFilter }), ...(carId && { carId }), ...(dateRange && { collectionDate: dateRange }) },
    }),
    prisma.fleetExpense.findMany({
      where: { ...(carFilter && { OR: [{ carId: carFilter }, { carId: null }] }), ...(carId && { carId }), ...(dateRange && { date: dateRange }) },
    }),
  ]);

  const revenueByPlatform: Record<string, number> = {};
  bookings.forEach((b) => {
    revenueByPlatform[b.platform] = (revenueByPlatform[b.platform] ?? 0) + b.totalFare;
  });

  const collectedByCategory: Record<string, number> = {};
  journalEntries.forEach((j) => {
    collectedByCategory[j.category] = (collectedByCategory[j.category] ?? 0) + j.amountCollected;
  });

  const expensesByType: Record<string, number> = {};
  expenses.forEach((e) => {
    expensesByType[e.expenseType] = (expensesByType[e.expenseType] ?? 0) + e.amount;
  });

  const totalRevenue = bookings.reduce((s, b) => s + b.totalFare, 0);
  const totalCollected = journalEntries.reduce((s, j) => s + j.amountCollected, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({
    success: true,
    data: {
      totalRevenue,
      totalCollected,
      totalExpenses,
      netPosition: totalRevenue + totalCollected - totalExpenses,
      revenueByPlatform,
      collectedByCategory,
      expensesByType,
      bookingCount: bookings.length,
      journalEntryCount: journalEntries.length,
      expenseCount: expenses.length,
    },
  });
});

export default router;
