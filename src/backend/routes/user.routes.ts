import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  role: true,
  isKycVerified: true,
  avatarUrl: true,
  bio: true,
  payoutAccountId: true,
  createdAt: true,
};

router.get('/users/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: PUBLIC_USER_SELECT });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, data: user });
});

router.patch('/users/me', requireAuth, async (req: Request, res: Response) => {
  const { fullName, bio, avatarUrl, payoutAccountId } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(payoutAccountId !== undefined && { payoutAccountId }),
    },
    select: PUBLIC_USER_SELECT,
  });
  res.json({ success: true, data: user });
});

// Trip history for the logged-in renter
router.get('/users/me/bookings', requireAuth, async (req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    where: { customerId: req.user!.userId },
    include: { car: true, review: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: bookings.length, data: bookings });
});

router.get('/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { car: { include: { owner: { select: { id: true, fullName: true, avatarUrl: true } } } }, review: true },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not part of this booking' });
  }
  res.json({ success: true, data: booking });
});

router.post('/bookings/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  const cancellableStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking in status ${booking.status}` });
  }

  const updated = await prisma.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED } });
  res.json({ success: true, data: updated });
});

export default router;
