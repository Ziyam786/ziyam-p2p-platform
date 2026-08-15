import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { generateChatReply } from '../services/aiService';

const router = Router();
const prisma = new PrismaClient();

function withRatingSummary<T extends { reviews: { rating: number }[] }>(car: T) {
  const { reviews, ...rest } = car as any;
  const reviewCount = reviews.length;
  const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviewCount).toFixed(1));
  return { ...rest, rating, reviewCount };
}

// List / search cars with filters
router.get('/cars', async (req: Request, res: Response) => {
  const { city, category, transmission, fuelType, maxPrice, availableOnly, featured, q, sort } = req.query;

  const where: Prisma.CarWhereInput = {};
  if (city) where.city = String(city);
  if (category && category !== 'All') where.category = String(category);
  if (transmission && transmission !== 'All') where.transmission = String(transmission);
  if (fuelType && fuelType !== 'All') where.fuelType = String(fuelType);
  if (maxPrice) where.dailyRate = { lte: Number(maxPrice) };
  if (availableOnly === 'true') where.isAvailable = true;
  if (featured === 'true') where.featured = true;
  if (q) {
    where.OR = [
      { make: { contains: String(q), mode: 'insensitive' } },
      { model: { contains: String(q), mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.CarOrderByWithRelationInput | Prisma.CarOrderByWithRelationInput[] =
    sort === 'price_asc' ? { dailyRate: 'asc' }
      : sort === 'price_desc' ? { dailyRate: 'desc' }
      : sort === 'featured' ? [{ featured: 'desc' }, { createdAt: 'desc' }]
      : { createdAt: 'desc' };

  const cars = await prisma.car.findMany({
    where,
    orderBy,
    include: { reviews: { select: { rating: true } }, owner: { select: { fullName: true } } },
  });

  const data = cars.map(withRatingSummary);
  const sorted = sort === 'rating' ? [...data].sort((a: any, b: any) => b.rating - a.rating) : data;

  res.json({ success: true, count: sorted.length, data: sorted });
});

// Legacy alias used by the original booking flow
router.get('/cars/search', async (req: Request, res: Response) => {
  const { city } = req.query;
  const cars = await prisma.car.findMany({
    where: { city: String(city ?? ''), isAvailable: true },
    include: { reviews: { select: { rating: true } }, owner: { select: { fullName: true, role: true } } },
  });
  res.json({ success: true, count: cars.length, data: cars.map(withRatingSummary) });
});

router.get('/cars/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await prisma.car.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true, bio: true, createdAt: true } },
      reviews: {
        include: { author: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!car) return res.status(404).json({ error: 'Car not found' });

  const { reviews, ...rest } = car;
  const reviewCount = reviews.length;
  const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(1));
  res.json({ success: true, data: { ...rest, rating, reviewCount, reviews } });
});

router.patch('/cars/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  if (car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Not your listing' });

  const {
    make, model, year, category, fuelType, transmission, seats,
    dailyRate, securityDeposit, kmIncludedPerDay, extraKmCharge,
    description, images, features, city, isAvailable, instantBook,
    offersDelivery, deliveryFee, offersPickup, pickupFee,
    rcDocUrl, pollutionCertUrl, insuranceDocUrl, onboardingStep,
    noNightBookings, nightBookingStart, nightBookingEnd,
    minInterBookingHours, minBookingHours, maxBookingDays,
  } = req.body;

  // Documents are self-attested at this stage (no live DigiLocker/RTO integration yet —
  // same "stub as instant pass" pattern as kyc.routes.ts). Once all three are on file we
  // mark the car verified so the host UI can show the green "Verified" badge.
  const nextRc = rcDocUrl !== undefined ? rcDocUrl : car.rcDocUrl;
  const nextPollution = pollutionCertUrl !== undefined ? pollutionCertUrl : car.pollutionCertUrl;
  const nextInsurance = insuranceDocUrl !== undefined ? insuranceDocUrl : car.insuranceDocUrl;
  const docsComplete = Boolean(nextRc && nextPollution && nextInsurance);

  const updated = await prisma.car.update({
    where: { id },
    data: {
      ...(make !== undefined && { make }),
      ...(model !== undefined && { model }),
      ...(year !== undefined && { year }),
      ...(category !== undefined && { category }),
      ...(fuelType !== undefined && { fuelType }),
      ...(transmission !== undefined && { transmission }),
      ...(seats !== undefined && { seats }),
      ...(dailyRate !== undefined && { dailyRate }),
      ...(securityDeposit !== undefined && { securityDeposit }),
      ...(kmIncludedPerDay !== undefined && { kmIncludedPerDay }),
      ...(extraKmCharge !== undefined && { extraKmCharge }),
      ...(description !== undefined && { description }),
      ...(images !== undefined && { images }),
      ...(features !== undefined && { features }),
      ...(city !== undefined && { city }),
      ...(isAvailable !== undefined && { isAvailable }),
      ...(instantBook !== undefined && { instantBook }),
      ...(offersDelivery !== undefined && { offersDelivery }),
      ...(deliveryFee !== undefined && { deliveryFee }),
      ...(offersPickup !== undefined && { offersPickup }),
      ...(pickupFee !== undefined && { pickupFee }),
      ...(rcDocUrl !== undefined && { rcDocUrl }),
      ...(pollutionCertUrl !== undefined && { pollutionCertUrl }),
      ...(insuranceDocUrl !== undefined && { insuranceDocUrl }),
      ...(docsComplete && { verificationStatus: 'VERIFIED' as const }),
      ...(onboardingStep !== undefined && { onboardingStep: Number(onboardingStep) }),
      ...(noNightBookings !== undefined && { noNightBookings }),
      ...(nightBookingStart !== undefined && { nightBookingStart }),
      ...(nightBookingEnd !== undefined && { nightBookingEnd }),
      ...(minInterBookingHours !== undefined && { minInterBookingHours: Number(minInterBookingHours) }),
      ...(minBookingHours !== undefined && { minBookingHours: Number(minBookingHours) }),
      ...(maxBookingDays !== undefined && { maxBookingDays: Number(maxBookingDays) }),
    },
  });
  res.json({ success: true, data: updated });
});

// AI-generated pro/con summary of a car's guest reviews (reuses the Claude wrapper
// already wired up for the support chatbot — see aiService.ts).
router.get('/cars/:id/review-summary', async (req: Request, res: Response) => {
  const { id } = req.params;
  const reviews = await prisma.review.findMany({
    where: { carId: id, comment: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  if (reviews.length === 0) {
    return res.json({ success: true, data: { summary: null, positiveTags: [], negativeTags: [] } });
  }

  const transcript = reviews.map((r) => `${r.rating}★: ${r.comment}`).join('\n');
  const prompt =
    'You summarize guest reviews for a car rental host. Given the reviews below, respond with ONLY a JSON object ' +
    '(no markdown fences, no prose) of the shape {"summary": string (1-2 sentences), "positiveTags": string[] (max 5, ' +
    'short 1-3 word phrases like "car condition"), "negativeTags": string[] (max 3, same style)}. ' +
    'If everything is positive, negativeTags can be empty.\n\nReviews:\n' + transcript;

  const raw = await generateChatReply('You are a concise, neutral review summarizer that outputs strict JSON only.', [
    { role: 'user', content: prompt },
  ]);

  try {
    const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(cleaned);
    res.json({ success: true, data: { summary: parsed.summary ?? null, positiveTags: parsed.positiveTags ?? [], negativeTags: parsed.negativeTags ?? [] } });
  } catch {
    res.json({ success: true, data: { summary: raw, positiveTags: [], negativeTags: [] } });
  }
});

// Soft-delete (delist) rather than a hard delete, since bookings reference the car.
router.delete('/cars/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  if (car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Not your listing' });

  await prisma.car.update({ where: { id }, data: { isAvailable: false } });
  res.json({ success: true, message: 'Listing delisted' });
});

export default router;
