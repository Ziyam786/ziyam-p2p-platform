import { Router, Request, Response } from 'express';
import { PrismaClient, Role, BookingStatus, PayoutStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { recordAudit } from '../middleware/auditLog';
import { PayoutEngine } from '../services/payoutEngine';

const router = Router();
const prisma = new PrismaClient();

router.use('/admin', requireAuth, requireRole(Role.ADMIN));

router.get('/admin/stats', async (_req: Request, res: Response) => {
  const [userCount, carCount, bookingCount, gmv, activeTrips, pendingKyc] = await Promise.all([
    prisma.user.count(),
    prisma.car.count(),
    prisma.booking.count(),
    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { status: BookingStatus.COMPLETED } }),
    prisma.booking.count({ where: { status: BookingStatus.ACTIVE } }),
    prisma.user.count({ where: { isKycVerified: false, role: { in: [Role.SELF_HOST, Role.FLEET_OPERATOR] } } }),
  ]);

  res.json({
    success: true,
    data: {
      userCount,
      carCount,
      bookingCount,
      gmv: gmv._sum.totalAmount ?? 0,
      activeTrips,
      pendingKyc,
    },
  });
});

/* ── Bookings ─────────────────────────────────────────────────────── */
router.get('/admin/bookings', async (req: Request, res: Response) => {
  const { status } = req.query;
  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as BookingStatus } : undefined,
    include: {
      car: { select: { make: true, model: true, city: true } },
      customer: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, count: bookings.length, data: bookings });
});

router.patch('/admin/bookings/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!Object.values(BookingStatus).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const booking = await prisma.booking.update({ where: { id }, data: { status } });
  await recordAudit(req.user!.userId, 'UPDATE_BOOKING_STATUS', 'Booking', id, { status });
  res.json({ success: true, data: booking });
});

/* ── Users ────────────────────────────────────────────────────────── */
router.get('/admin/users', async (req: Request, res: Response) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: role as Role } : undefined,
    select: {
      id: true, fullName: true, email: true, phoneNumber: true, role: true,
      isKycVerified: true, isSuspended: true, createdAt: true,
      _count: { select: { cars: true, bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: users.length, data: users });
});

router.patch('/admin/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isSuspended, isKycVerified, role } = req.body;

  if (role !== undefined && !Object.values(Role).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(isSuspended !== undefined && { isSuspended: Boolean(isSuspended) }),
      ...(isKycVerified !== undefined && { isKycVerified: Boolean(isKycVerified) }),
      ...(role !== undefined && { role }),
    },
    select: {
      id: true, fullName: true, email: true, role: true, isKycVerified: true, isSuspended: true,
    },
  });
  await recordAudit(req.user!.userId, 'UPDATE_USER', 'User', id, req.body);
  res.json({ success: true, data: user });
});

/* ── Cars ─────────────────────────────────────────────────────────── */
router.get('/admin/cars', async (_req: Request, res: Response) => {
  const cars = await prisma.car.findMany({
    include: { owner: { select: { fullName: true, email: true } }, _count: { select: { bookings: true, reviews: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: cars.length, data: cars });
});

router.patch('/admin/cars/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isAvailable, featured, dailyRate, city, category } = req.body;

  const car = await prisma.car.update({
    where: { id },
    data: {
      ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
      ...(featured !== undefined && { featured: Boolean(featured) }),
      ...(dailyRate !== undefined && { dailyRate: Number(dailyRate) }),
      ...(city !== undefined && { city }),
      ...(category !== undefined && { category }),
    },
  });
  await recordAudit(req.user!.userId, 'UPDATE_CAR', 'Car', id, req.body);
  res.json({ success: true, data: car });
});

/* ── Reviews ──────────────────────────────────────────────────────── */
router.get('/admin/reviews', async (_req: Request, res: Response) => {
  const reviews = await prisma.review.findMany({
    include: {
      author: { select: { fullName: true } },
      car: { select: { make: true, model: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: reviews.length, data: reviews });
});

router.delete('/admin/reviews/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.review.delete({ where: { id } });
  await recordAudit(req.user!.userId, 'DELETE_REVIEW', 'Review', id);
  res.json({ success: true });
});

/* ── Payouts ──────────────────────────────────────────────────────── */
router.get('/admin/payouts', async (req: Request, res: Response) => {
  const { status } = req.query;
  const payouts = await prisma.payoutLedger.findMany({
    where: status ? { status: status as PayoutStatus } : undefined,
    include: { host: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: payouts.length, data: payouts });
});

router.post('/admin/payouts/:id/retry', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await PayoutEngine.retryPayout(id);
    await recordAudit(req.user!.userId, 'RETRY_PAYOUT', 'PayoutLedger', id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/* ── Audit log ────────────────────────────────────────────────────── */
router.get('/admin/audit-log', async (_req: Request, res: Response) => {
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  res.json({ success: true, count: entries.length, data: entries });
});

export default router;
