import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import paymentGateway from '../services/paymentGateway';
import { safeErrorMessage } from '../utils/errorResponse';
import { geocodeDestination, isGoogleMapsConfigured } from '../services/googleMapsService';

const router = Router();
const prisma = new PrismaClient();

const MAX_DESTINATION_LENGTH = 120;

// No longer used for validation or kept in sync with any homepage list —
// ROAD_TRIPS was removed from src/frontend/app/page.tsx earlier in this plan.
// This is now only an optional hint-text lookup: razorpayPaymentHandler.ts
// uses it (with a `?? unlock.destination` fallback) to give the itinerary
// AI prompt a short brief for these 4 originally-known destinations; any
// other free-text destination just falls back to the raw string.
export const ITINERARY_DESTINATIONS: Record<string, string> = {
  Ooty: 'a hill station ~270 km from Bengaluru, known for tea gardens, the Nilgiri toy train, and cool weather',
  Coorg: 'a coffee-growing hill district ~250 km from Bengaluru, known for coffee plantations, waterfalls, and Kodava cuisine',
  Chikmagalur: 'a misty hill town ~245 km from Bengaluru, known for coffee estates, trekking (Mullayanagiri), and quiet homestays',
  Gokarna: 'a beach town ~480 km from Bengaluru, known for its temple town heritage and quieter alternative to Goa',
};

const ITINERARY_PRICE = 49;

router.post('/itineraries/unlock', async (req: Request, res: Response) => {
  const { destination, customerName, customerEmail, customerPhone } = req.body;
  // typeof check first: destination?.trim() would throw a TypeError (not a
  // handled 400) for a truthy non-string body value like a number or object,
  // which — inside this async handler with no async-error wrapper — becomes
  // an unhandled rejection Express never turns into a response, hanging the
  // request instead of failing it cleanly.
  if (typeof destination !== 'string' || !destination.trim()) {
    return res.status(400).json({ error: 'destination is required' });
  }
  const trimmedDestination = destination.trim();
  if (trimmedDestination.length > MAX_DESTINATION_LENGTH) {
    return res.status(400).json({ error: `destination must be ${MAX_DESTINATION_LENGTH} characters or fewer` });
  }
  if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
    return res.status(400).json({ error: 'customerName, customerEmail, and customerPhone are required' });
  }

  // Cheap validation above runs before this billed geocode call. When Google
  // Maps isn't configured we fail OPEN (accept the destination as-is) rather
  // than break the whole ₹49 unlock flow — this matches this feature's
  // pre-existing behavior from before free-text destinations were added.
  let persistedDestination = trimmedDestination;
  if (isGoogleMapsConfigured()) {
    const place = await geocodeDestination(trimmedDestination);
    if (!place) {
      return res.status(400).json({ error: "Couldn't find that destination — check the spelling and try again." });
    }
    // Persist Google's normalized name instead of the raw, unnormalized user
    // input, now that we have it.
    persistedDestination = place.placeName;
  }

  const unlock = await prisma.itineraryUnlock.create({
    data: {
      destination: persistedDestination,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      amount: ITINERARY_PRICE,
    },
  });

  try {
    const checkout = await paymentGateway.initiateCheckout({
      amount: ITINERARY_PRICE,
      receipt: `itinerary_${unlock.id.slice(0, 20)}`,
      notes: { kind: 'itinerary', unlockId: unlock.id },
    });

    await prisma.itineraryUnlock.update({ where: { id: unlock.id }, data: { paymentIntentId: checkout.orderId } });

    res.status(201).json({ success: true, data: { id: unlock.id, ...checkout } });
  } catch (error: any) {
    console.error('[itineraries/unlock] payment init failed:', error);
    res.status(502).json({ error: `Could not start payment: ${safeErrorMessage(error)}` });
  }
});

router.get('/itineraries/:id', async (req: Request, res: Response) => {
  const unlock = await prisma.itineraryUnlock.findUnique({ where: { id: req.params.id } });
  if (!unlock) return res.status(404).json({ error: 'Itinerary not found' });
  res.json({ success: true, data: unlock });
});


export default router;
