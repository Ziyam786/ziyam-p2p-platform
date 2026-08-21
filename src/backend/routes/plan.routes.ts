import { Router, Request, Response } from 'express';
import { geocodeDestination, findNearbyHotels, haversineKm, BENGALURU, isGoogleMapsConfigured } from '../services/googleMapsService';
import { PrismaClient } from '@prisma/client';
import { suggestCategoryForTrip } from '../utils/carSuggestion';
import { planRateLimiter } from '../middleware/rateLimit';

const router = Router();
const prisma = new PrismaClient();

const MAX_DISTANCE_KM = 700;

router.get('/plan/destination-check', planRateLimiter, async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q is required' });

  if (!isGoogleMapsConfigured()) {
    // Not the user's fault, and it would be a lie to blame their spelling —
    // tell them honestly instead of pretending Google couldn't find the place.
    return res.json({
      success: true,
      data: { valid: false, reason: 'The trip planner is temporarily unavailable — please try browsing cars directly.' },
    });
  }

  const place = await geocodeDestination(q);
  if (!place) {
    return res.json({ success: true, data: { valid: false, reason: "Couldn't find that place — check the spelling and try again." } });
  }

  const distanceKm = Math.round(haversineKm(BENGALURU, place));
  if (distanceKm > MAX_DISTANCE_KM) {
    return res.json({
      success: true,
      data: { valid: false, reason: `That's a bit far for a self-drive round trip — try somewhere within ${MAX_DISTANCE_KM}km of Bengaluru.` },
    });
  }

  res.json({ success: true, data: { valid: true, placeName: place.placeName, lat: place.lat, lng: place.lng, distanceKm } });
});

router.get('/plan/suggest-car', async (req: Request, res: Response) => {
  const distanceKm = Number(req.query.distanceKm ?? 0);
  const city = typeof req.query.city === 'string' && req.query.city.trim() ? req.query.city.trim() : 'Bengaluru';
  const category = suggestCategoryForTrip(distanceKm);

  const selectFields = {
    id: true, make: true, model: true, city: true, category: true,
    dailyRate: true, seats: true, transmission: true, fuelType: true,
  };

  let car = await prisma.car.findFirst({
    where: { isAvailable: true, verificationStatus: 'VERIFIED', city: { equals: city, mode: 'insensitive' as const }, category },
    select: selectFields,
    orderBy: { dailyRate: 'asc' },
  });
  let exactMatch = Boolean(car);

  if (!car) {
    car = await prisma.car.findFirst({
      where: { isAvailable: true, verificationStatus: 'VERIFIED', city: { equals: city, mode: 'insensitive' as const } },
      select: selectFields,
      orderBy: { dailyRate: 'asc' },
    });
    exactMatch = false;
  }

  res.json({ success: true, data: { car, exactMatch } });
});

router.get('/plan/hotels', planRateLimiter, async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required numbers' });
  }
  const hotels = await findNearbyHotels(lat, lng);
  res.json({ success: true, data: hotels });
});

export default router;
