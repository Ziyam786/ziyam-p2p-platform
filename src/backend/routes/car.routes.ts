import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { generateChatReply } from '../services/aiService';
import { FleetService } from '../services/fleetService';
import { pickFleetOperator } from '../services/fleetOperatorAssignment';
import { esignApi, isSetuConfigured } from '../services/setuService';
import { renderFleetPartnerAgreementPdf } from '../services/fleetPartnerAgreementPdf';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

function withRatingSummary<T extends { reviews: { rating: number }[] }>(car: T) {
  // originalImages holds the unblurred license plate — admin-only (see
  // src/admin/app/cars/page.tsx's document review modal), never sent to a
  // public listing endpoint. Stripped here rather than via a scoped
  // Prisma `select` so this stays a one-line change instead of having to
  // enumerate every other Car scalar field at each call site.
  const { reviews, originalImages, ...rest } = car as any;
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
    include: { reviews: { where: { hidden: false }, select: { rating: true } }, owner: { select: { fullName: true } } },
  });

  const data = cars.map(withRatingSummary);
  const sorted = sort === 'rating' ? [...data].sort((a: any, b: any) => b.rating - a.rating) : data;

  res.json({ success: true, count: sorted.length, data: sorted });
});

// Live market snapshot for a city — average price, most-listed category, and
// how many cars are bookable right now. Powers the homepage's transparency
// section and the search bar's live availability count. Real aggregates,
// not placeholder copy.
router.get('/cars/market-pulse', async (req: Request, res: Response) => {
  const { city } = req.query;
  const where: Prisma.CarWhereInput = city ? { city: String(city) } : {};

  const [availableCount, priceAgg, categoryGroups] = await Promise.all([
    prisma.car.count({ where: { ...where, isAvailable: true } }),
    prisma.car.aggregate({ where, _avg: { dailyRate: true } }),
    prisma.car.groupBy({ by: ['category'], where, _count: { category: true }, orderBy: { _count: { category: 'desc' } }, take: 1 }),
  ]);

  res.json({
    success: true,
    data: {
      city: city ? String(city) : null,
      availableCount,
      averageDailyRate: priceAgg._avg.dailyRate ? Math.round(priceAgg._avg.dailyRate) : null,
      popularCategory: categoryGroups[0]?.category ?? null,
    },
  });
});

// Legacy alias used by the original booking flow
router.get('/cars/search', async (req: Request, res: Response) => {
  const { city } = req.query;
  const cars = await prisma.car.findMany({
    where: { city: String(city ?? ''), isAvailable: true },
    include: { reviews: { where: { hidden: false }, select: { rating: true } }, owner: { select: { fullName: true, role: true } } },
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
        where: { hidden: false },
        include: { author: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!car) return res.status(404).json({ error: 'Car not found' });

  // originalImages (unblurred plate) is admin-only — never sent to this public detail route.
  const { reviews, originalImages, ...rest } = car;
  const reviewCount = reviews.length;
  const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(1));
  res.json({ success: true, data: { ...rest, rating, reviewCount, reviews } });
});

// Public read-only availability calendar — merged booked + host-paused date
// ranges, with no booking/customer details exposed, so renters can see which
// days are unavailable before picking dates (see AvailabilityCalendar.tsx).
router.get('/cars/:id/availability', async (req: Request, res: Response) => {
  const { id } = req.params;
  const [bookings, blackouts] = await Promise.all([
    prisma.booking.findMany({
      where: { carId: id, status: { notIn: ['CANCELLED'] } },
      select: { startTime: true, endTime: true },
    }),
    prisma.blackout.findMany({
      where: { carId: id },
      select: { startDate: true, endDate: true, reason: true },
    }),
  ]);

  const ranges = [
    ...bookings.map((b) => ({ startDate: b.startTime, endDate: b.endTime, type: 'BOOKED' as const })),
    ...blackouts.map((b) => ({ startDate: b.startDate, endDate: b.endDate, type: 'PAUSED' as const, reason: b.reason })),
  ];
  res.json({ success: true, data: ranges });
});

router.patch('/cars/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  if (car.ownerId !== req.user!.userId) return res.status(403).json({ error: 'Not your listing' });

  const {
    make, model, year, category, fuelType, transmission, seats,
    dailyRate, securityDeposit, kmIncludedPerDay, extraKmCharge,
    description, images, originalImages, features, city, address, latitude, longitude, isAvailable, instantBook,
    offersDelivery, deliveryFee, offersPickup, pickupFee,
    rcDocUrl, pollutionCertUrl, insuranceDocUrl, onboardingStep,
    noNightBookings, nightBookingStart, nightBookingEnd,
    minInterBookingHours, minBookingHours, maxBookingDays,
  } = req.body;

  // Documents are self-attested at this stage (no live DigiLocker/RTO integration yet —
  // same "stub as instant pass" pattern as kyc.routes.ts). Once all three are on file we
  // mark the car verified so the host UI can show the green "Verified" badge. Only
  // recompute this when the host is actually touching a document field, not on every
  // unrelated edit (price, description, etc.) — otherwise an admin's manual REJECTED
  // verdict (see PATCH /admin/cars/:id/verification) would silently flip back to
  // VERIFIED the next time the host changed anything at all, since all three doc URLs
  // are still on file from before.
  const docsTouched = rcDocUrl !== undefined || pollutionCertUrl !== undefined || insuranceDocUrl !== undefined;
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
      ...(originalImages !== undefined && { originalImages }),
      ...(features !== undefined && { features }),
      ...(city !== undefined && { city }),
      ...(address !== undefined && { address }),
      ...(latitude !== undefined && { latitude: latitude === null ? null : Number(latitude) }),
      ...(longitude !== undefined && { longitude: longitude === null ? null : Number(longitude) }),
      ...(isAvailable !== undefined && { isAvailable }),
      ...(instantBook !== undefined && { instantBook }),
      ...(offersDelivery !== undefined && { offersDelivery }),
      ...(deliveryFee !== undefined && { deliveryFee }),
      ...(offersPickup !== undefined && { offersPickup }),
      ...(pickupFee !== undefined && { pickupFee }),
      ...(rcDocUrl !== undefined && { rcDocUrl }),
      ...(pollutionCertUrl !== undefined && { pollutionCertUrl }),
      ...(insuranceDocUrl !== undefined && { insuranceDocUrl }),
      ...(docsTouched && docsComplete && { verificationStatus: 'VERIFIED' as const }),
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
    where: { carId: id, comment: { not: null }, hidden: false },
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

// Host incentive-plan progress for this car, current month.
router.get('/cars/:id/incentives', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  if (car.ownerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not your listing' });
  }

  const progress = await FleetService.getIncentiveProgress(id);
  res.json({ success: true, data: progress });
});

/* ── Fleet Partner Onboarding (Audit -> Security -> Agreement -> Go Live) ── */

async function assertOwnsCarForOnboarding(req: Request, carId: string) {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return { ok: false as const, status: 404, error: 'Car not found' };
  if (car.ownerId !== req.user!.userId) return { ok: false as const, status: 403, error: 'Not your listing' };
  return { ok: true as const, car };
}

// Host-only status check (unlike the public GET /cars/:id, this is allowed to
// include the assigned fleet operator's contact details).
router.get('/cars/:id/fleet-onboarding', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const check = await assertOwnsCarForOnboarding(req, id);
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  const car = await prisma.car.findUnique({
    where: { id },
    select: {
      fleetOnboardingStep: true, fleetManaged: true, telematicsImei: true,
      fleetAgreementWetSignedUrl: true, fleetAgreementWetSignedAt: true,
      fleetAgreementEsignStatus: true, fleetAgreementEsignDownloadUrl: true,
      fleetOperator: { select: { fullName: true, phoneNumber: true, email: true } },
    },
  });
  res.json({ success: true, data: car });
});

// Step 1 — Audit: host confirms the eligibility checklist and the car is
// assigned a fleet operator via a random "finger-crossed" shuffle.
router.post('/cars/:id/fleet-onboarding/audit', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const check = await assertOwnsCarForOnboarding(req, id);
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  if (check.car.fleetOnboardingStep > 0) return res.status(409).json({ error: 'Audit already submitted for this car' });

  const { confirmedEligible } = req.body;
  if (!confirmedEligible) return res.status(400).json({ error: 'You must confirm the eligibility checklist to proceed' });

  const fleetOperatorId = await pickFleetOperator();
  if (!fleetOperatorId) return res.status(503).json({ error: 'No fleet operators are available to onboard your car right now — please try again shortly.' });

  const car = await prisma.car.update({
    where: { id },
    data: { fleetOnboardingStep: 1, fleetOperatorId },
    include: { fleetOperator: { select: { fullName: true, phoneNumber: true, email: true } } },
  });
  res.json({ success: true, data: car });
});

// Step 2 — Security: GPS/immobilizer install confirmed via the telematics IMEI.
router.patch('/cars/:id/fleet-onboarding/security', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const check = await assertOwnsCarForOnboarding(req, id);
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  if (check.car.fleetOnboardingStep !== 1) return res.status(409).json({ error: 'Complete the audit step first' });

  const { telematicsImei } = req.body;
  if (!telematicsImei || !String(telematicsImei).trim()) return res.status(400).json({ error: 'telematicsImei is required' });

  const car = await prisma.car.update({
    where: { id },
    data: { fleetOnboardingStep: 2, telematicsImei: String(telematicsImei).trim() },
  });
  res.json({ success: true, data: car });
});

// Step 3 — Agreement: wet-signature upload (a fleet operator hands the host a
// physical/printed agreement to sign and photograph) and Aadhaar e-sign via
// Setu (same integration used for trip lease agreements and the Host
// Onboarding Agreement) are both real — Go Live requires both to be complete.
router.patch('/cars/:id/fleet-onboarding/agreement/wet-signature', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const check = await assertOwnsCarForOnboarding(req, id);
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  if (check.car.fleetOnboardingStep !== 2) return res.status(409).json({ error: 'Complete the Audit and Security steps first' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const car = await prisma.car.update({
    where: { id },
    data: { fleetAgreementWetSignedUrl: url, fleetAgreementWetSignedAt: new Date() },
  });
  res.json({ success: true, data: car, message: 'Wet-signed agreement received — a fleet admin will review and confirm Go Live.' });
});

router.post('/cars/:id/fleet-onboarding/agreement/esign/start', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const check = await assertOwnsCarForOnboarding(req, id);
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  if (check.car.fleetOnboardingStep !== 2) return res.status(409).json({ error: 'Complete the Audit and Security steps first' });
  if (!isSetuConfigured()) return res.status(503).json({ error: 'eSign is not configured yet' });
  if (check.car.fleetAgreementEsignRequestId) return res.status(409).json({ error: 'An eSign request already exists for this agreement' });

  const car = await prisma.car.findUnique({ where: { id }, include: { owner: true, fleetOperator: true } });
  if (!car || !car.fleetOperator) return res.status(409).json({ error: 'No fleet operator is assigned to this car yet' });

  try {
    const pdf = await renderFleetPartnerAgreementPdf({
      carId: car.id,
      createdAt: new Date(),
      ownerName: car.owner.fullName,
      ownerEmail: car.owner.email,
      ownerPhone: car.owner.phoneNumber,
      fleetOperatorName: car.fleetOperator.fullName,
      fleetOperatorEmail: car.fleetOperator.email,
      fleetOperatorPhone: car.fleetOperator.phoneNumber,
      make: car.make,
      model: car.model,
      year: car.year,
      registrationNo: car.registrationNo,
      chassisNo: car.chassis,
      transmission: car.transmission,
      fuelType: car.fuelType,
      hasComprehensiveInsurance: Boolean(car.insuranceDocUrl),
    });
    const { documentId } = await esignApi.uploadDocument(pdf, `fleet-partner-agreement-${car.id.slice(0, 8)}`);
    const signature = await esignApi.createSignatureRequest(
      documentId,
      [
        { identifier: car.owner.email, displayName: car.owner.fullName },
        { identifier: car.fleetOperator.email, displayName: car.fleetOperator.fullName },
      ],
      `${config.clientUrl}/host/cars/${car.id}/manage?esigned=1`
    );
    await prisma.car.update({
      where: { id: car.id },
      data: { fleetAgreementEsignRequestId: signature.id, fleetAgreementEsignStatus: 'sign_initiated' },
    });
    res.json({ success: true, data: { esignRequestId: signature.id } });
  } catch (err: any) {
    console.error('[ESIGN] fleet partner agreement start failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not start eSign right now. Please try again shortly.' });
  }
});

router.get('/cars/:id/fleet-onboarding/agreement/esign/status', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const check = await assertOwnsCarForOnboarding(req, id);
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  if (!check.car.fleetAgreementEsignRequestId) return res.json({ success: true, data: { status: null } });

  if (check.car.fleetAgreementEsignStatus === 'sign_complete' && check.car.fleetAgreementEsignDownloadUrl) {
    return res.json({ success: true, data: { status: check.car.fleetAgreementEsignStatus, downloadUrl: check.car.fleetAgreementEsignDownloadUrl } });
  }

  try {
    const { status } = await esignApi.getStatus(check.car.fleetAgreementEsignRequestId);
    let downloadUrl: string | undefined;
    if (status === 'sign_complete') {
      const download = await esignApi.getDownloadUrl(check.car.fleetAgreementEsignRequestId);
      downloadUrl = download.downloadUrl;
    }
    await prisma.car.update({
      where: { id },
      data: { fleetAgreementEsignStatus: status, ...(downloadUrl && { fleetAgreementEsignDownloadUrl: downloadUrl }) },
    });
    res.json({ success: true, data: { status, downloadUrl } });
  } catch (err: any) {
    console.error('[ESIGN] fleet partner agreement status check failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not check eSign status right now.' });
  }
});

// Step 3->4 — Agreement & Go Live: no self-service completion (no real
// partnership agreement content exists yet) — a fleet admin manually confirms
// once it's actually been executed with the host.
router.post('/admin/cars/:id/fleet-onboarding/go-live', requireAuth, requireRole('FLEET_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  if (car.fleetOnboardingStep < 2) return res.status(409).json({ error: 'Host has not completed the Audit and Security steps yet' });
  if (!car.fleetAgreementWetSignedUrl) return res.status(409).json({ error: 'No wet-signed Fleet Partner Agreement is on file for this car yet' });
  if (car.fleetAgreementEsignStatus !== 'sign_complete') return res.status(409).json({ error: 'The Fleet Partner Agreement has not been e-signed yet' });

  const updated = await prisma.car.update({
    where: { id },
    data: { fleetOnboardingStep: 3, fleetManaged: true },
  });
  res.json({ success: true, data: updated, message: 'Car is now fleet-managed and live.' });
});

export default router;
