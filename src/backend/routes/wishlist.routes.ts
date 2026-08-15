import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function withRatingSummary<T extends { reviews: { rating: number }[] }>(car: T) {
  const { reviews, ...rest } = car as any;
  const reviewCount = reviews.length;
  const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviewCount).toFixed(1));
  return { ...rest, rating, reviewCount };
}

router.get('/users/me/wishlist', requireAuth, async (req: Request, res: Response) => {
  const entries = await prisma.wishlist.findMany({
    where: { userId: req.user!.userId },
    include: { car: { include: { reviews: { select: { rating: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const data = entries.map((e) => withRatingSummary(e.car));
  res.json({ success: true, count: data.length, data });
});

// Toggle: adds if not present, removes if already wishlisted. Returns the new state.
router.post('/cars/:id/wishlist', requireAuth, async (req: Request, res: Response) => {
  const { id: carId } = req.params;
  const userId = req.user!.userId;

  const existing = await prisma.wishlist.findUnique({ where: { userId_carId: { userId, carId } } });
  if (existing) {
    await prisma.wishlist.delete({ where: { id: existing.id } });
    return res.json({ success: true, wishlisted: false });
  }

  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return res.status(404).json({ error: 'Car not found' });

  await prisma.wishlist.create({ data: { id: uuidv4(), userId, carId } });
  res.json({ success: true, wishlisted: true });
});

export default router;
