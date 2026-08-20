import { Router, Request, Response } from 'express';
import { geocodeDestination, findNearbyHotels, haversineKm, BENGALURU } from '../services/googleMapsService';

const router = Router();

const MAX_DISTANCE_KM = 700;

router.get('/plan/destination-check', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q is required' });

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

export default router;
