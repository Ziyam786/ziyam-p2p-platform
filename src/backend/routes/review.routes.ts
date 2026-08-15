import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

// Leave a review for a completed trip (renter reviews the car + host)
router.post('/reviews', requireAuth, async (req: Request, res: Response) => {
  const { bookingId, rating, comment } = req.body;
  if (!bookingId || !rating) return res.status(400).json({ error: 'bookingId and rating are required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' });

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { car: true, review: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== BookingStatus.COMPLETED) {
    return res.status(400).json({ error: 'You can only review completed trips' });
  }
  if (booking.review) return res.status(409).json({ error: 'You already reviewed this trip' });

  const review = await prisma.review.create({
    data: {
      id: uuidv4(),
      bookingId,
      carId: booking.carId,
      authorId: req.user!.userId,
      targetHostId: booking.car.ownerId,
      rating,
      comment,
    },
  });

  await notify(
    booking.car.ownerId,
    'REVIEW_RECEIVED',
    `New ${rating}-star review`,
    `A renter reviewed your ${booking.car.make} ${booking.car.model}.`,
    `/host/dashboard`
  );

  res.status(201).json({ success: true, data: review });
});

router.get('/cars/:id/reviews', async (req: Request, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { carId: req.params.id },
    include: { author: { select: { fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: reviews.length, data: reviews });
});

router.get('/hosts/:id/reviews', async (req: Request, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { targetHostId: req.params.id },
    include: { author: { select: { fullName: true, avatarUrl: true } }, car: { select: { make: true, model: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: reviews.length, data: reviews });
});

// Public host profile (Turo-style host page)
router.get('/hosts/:id', async (req: Request, res: Response) => {
  const host = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, fullName: true, avatarUrl: true, bio: true, role: true, isKycVerified: true, createdAt: true },
  });
  if (!host || !['SELF_HOST', 'FLEET_OPERATOR'].includes(host.role)) {
    return res.status(404).json({ error: 'Host not found' });
  }
  res.json({ success: true, data: host });
});

// A host's publicly bookable cars
router.get('/hosts/:id/cars', async (req: Request, res: Response) => {
  const cars = await prisma.car.findMany({
    where: { ownerId: req.params.id, isAvailable: true },
    include: { reviews: { select: { rating: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const data = cars.map((c) => {
    const { reviews, ...rest } = c;
    const reviewCount = reviews.length;
    const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(1));
    return { ...rest, rating, reviewCount };
  });
  res.json({ success: true, count: data.length, data });
});

export default router;
