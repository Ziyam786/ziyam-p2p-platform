import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSetting } from '../services/settingsService';

const router = Router();
const prisma = new PrismaClient();

// Financial ERP — internal finance/admin tooling only.
router.use('/finance', requireAuth, requireRole('FLEET_ADMIN', 'ADMIN'));

/**
 * Ground-truthed from the real production Financial ERP's tripCredited()
 * logic: a platform booking counts as credited revenue once its
 * expectedCreditDate has passed, or once it's been explicitly marked
 * received — whichever comes first.
 */
function isCredited(b: { received: boolean; expectedCreditDate: Date | null }, asOf: Date): boolean {
  if (b.received) return true;
  if (b.expectedCreditDate && asOf > b.expectedCreditDate) return true;
  return false;
}

async function revenueAndCollections(to?: Date, from?: Date) {
  const [bookings, collections] = await Promise.all([
    prisma.platformBooking.findMany({
      where: { bookedAt: { ...(from && { gte: from }), ...(to && { lte: to }) } },
    }),
    prisma.journalEntry.findMany({
      where: { collectionDate: { ...(from && { gte: from }), ...(to && { lte: to }) } },
    }),
  ]);
  const asOf = to ?? new Date();
  const creditedRevenue = bookings
    .filter((b) => isCredited(b, asOf))
    .reduce((s, b) => s + b.totalFare + b.doorstepCharges - (b.platformCommission ?? 0), 0);
  const collected = collections.reduce((s, c) => s + c.amountCollected, 0);
  return { creditedRevenue, collected, bookingCount: bookings.length, collectionCount: collections.length };
}

async function totalExpenses(to?: Date, from?: Date) {
  const expenses = await prisma.fleetExpense.findMany({
    where: { date: { ...(from && { gte: from }), ...(to && { lte: to }) } },
  });
  return expenses.reduce((s, e) => s + e.amount, 0);
}

/* ── Command Center ───────────────────────────────────────────────────── */

router.get('/finance/command-center', async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const fromDate = from ? new Date(String(from)) : undefined;
  const toDate = to ? new Date(String(to)) : undefined;

  const openingCapital = await getSetting<number>('finance_opening_capital', 0);

  const [periodRC, allTimeRC, periodExpenses, allTimeExpenses] = await Promise.all([
    revenueAndCollections(toDate, fromDate),
    revenueAndCollections(toDate),
    totalExpenses(toDate, fromDate),
    totalExpenses(toDate),
  ]);

  const moneyIn = periodRC.creditedRevenue + periodRC.collected;
  const moneyOut = periodExpenses;
  const bottomLine = moneyIn - moneyOut;

  const cashPosition = openingCapital + allTimeRC.creditedRevenue + allTimeRC.collected - allTimeExpenses;
  const retainedEarnings = allTimeRC.creditedRevenue + allTimeRC.collected - allTimeExpenses;

  res.json({
    success: true,
    data: {
      cashPosition,
      moneyIn,
      moneyOut,
      bottomLine,
      retainedEarnings,
      openingCapital,
      tripCount: periodRC.bookingCount,
      collectionCount: periodRC.collectionCount,
    },
  });
});

/* ── Balance Sheet ─────────────────────────────────────────────────────── */

router.get('/finance/balance-sheet', async (req: Request, res: Response) => {
  const { asOf } = req.query;
  const asOfDate = asOf ? new Date(String(asOf)) : new Date();

  const openingCapital = await getSetting<number>('finance_opening_capital', 0);
  const rc = await revenueAndCollections(asOfDate);
  const expenses = await totalExpenses(asOfDate);
  const retainedEarnings = rc.creditedRevenue + rc.collected - expenses;
  const cash = openingCapital + retainedEarnings;

  const outstandings = await prisma.outstanding.findMany({
    where: { status: { not: 'PAID' }, expectedDate: { lte: asOfDate } },
  });
  const receivables = outstandings.filter((o) => o.outstandingType === 'RECEIVABLE').reduce((s, o) => s + o.amountOwed, 0);
  const payables = outstandings.filter((o) => o.outstandingType === 'PAYABLE').reduce((s, o) => s + o.amountOwed, 0);

  const assets = cash + receivables;
  const liabilities = payables;
  const equity = openingCapital + retainedEarnings + (receivables - payables);

  res.json({
    success: true,
    data: { openingCapital, retainedEarnings, cash, receivables, payables, assets, liabilities, equity },
  });
});

/* ── Outstandings (Receivables & Payables) ───────────────────────────────── */

router.get('/finance/outstandings', async (req: Request, res: Response) => {
  const { type, status } = req.query;
  const data = await prisma.outstanding.findMany({
    where: {
      ...(type && type !== 'All' && { outstandingType: String(type) as any }),
      ...(status && status !== 'All' && { status: String(status) as any }),
    },
    orderBy: { expectedDate: 'asc' },
  });
  res.json({ success: true, count: data.length, data });
});

router.post('/finance/outstandings', async (req: Request, res: Response) => {
  const { expectedDate, paymentTo, amountOwed, outstandingType, sourceType, frequency, recurringGroup } = req.body;
  if (!expectedDate || !paymentTo || amountOwed === undefined || !outstandingType) {
    return res.status(400).json({ error: 'expectedDate, paymentTo, amountOwed, and outstandingType are required' });
  }
  const entry = await prisma.outstanding.create({
    data: {
      expectedDate: new Date(expectedDate), paymentTo, amountOwed: Number(amountOwed),
      outstandingType, sourceType, frequency: frequency || 'ONCE', recurringGroup,
      createdById: req.user!.userId,
    },
  });
  res.status(201).json({ success: true, data: entry });
});

router.patch('/finance/outstandings/:id/settle', async (req: Request, res: Response) => {
  const entry = await prisma.outstanding.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const updated = await prisma.outstanding.update({
    where: { id: req.params.id },
    data: { status: 'PAID', paidDate: new Date() },
  });
  res.json({ success: true, data: updated });
});

router.delete('/finance/outstandings/:id', async (req: Request, res: Response) => {
  const entry = await prisma.outstanding.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  await prisma.outstanding.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/* ── Monthly Cash Ledger ───────────────────────────────────────────────── */

router.get('/finance/monthly-balances', async (_req: Request, res: Response) => {
  const data = await prisma.monthlyBalance.findMany({ orderBy: { month: 'desc' } });
  res.json({ success: true, count: data.length, data });
});

router.put('/finance/monthly-balances/:month', async (req: Request, res: Response) => {
  const { month } = req.params;
  const { openingBalance, closingBalance } = req.body;
  if (openingBalance === undefined) return res.status(400).json({ error: 'openingBalance is required' });
  const entry = await prisma.monthlyBalance.upsert({
    where: { month },
    update: { openingBalance: Number(openingBalance), closingBalance: closingBalance !== undefined ? Number(closingBalance) : undefined },
    create: { month, openingBalance: Number(openingBalance), closingBalance: closingBalance !== undefined ? Number(closingBalance) : undefined },
  });
  res.json({ success: true, data: entry });
});

export default router;
