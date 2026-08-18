import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import paymentGateway from '../services/paymentGateway';
import { safeErrorMessage } from '../utils/errorResponse';

const router = Router();
const prisma = new PrismaClient();

// Ground-truthed against the homepage teaser (src/frontend/app/page.tsx's
// ROAD_TRIPS list) — keep in sync if that list ever changes.
export const ITINERARY_DESTINATIONS: Record<string, string> = {
  Ooty: 'a hill station ~270 km from Bengaluru, known for tea gardens, the Nilgiri toy train, and cool weather',
  Coorg: 'a coffee-growing hill district ~250 km from Bengaluru, known for coffee plantations, waterfalls, and Kodava cuisine',
  Chikmagalur: 'a misty hill town ~245 km from Bengaluru, known for coffee estates, trekking (Mullayanagiri), and quiet homestays',
  Gokarna: 'a beach town ~480 km from Bengaluru, known for its temple town heritage and quieter alternative to Goa',
};

const ITINERARY_PRICE = 49;

router.post('/itineraries/unlock', async (req: Request, res: Response) => {
  const { destination, customerName, customerEmail, customerPhone } = req.body;
  if (!destination || !ITINERARY_DESTINATIONS[destination]) {
    return res.status(400).json({ error: `destination must be one of ${Object.keys(ITINERARY_DESTINATIONS).join(', ')}` });
  }
  if (!customerName?.trim() || !customerEmail?.trim() || !customerPhone?.trim()) {
    return res.status(400).json({ error: 'customerName, customerEmail, and customerPhone are required' });
  }

  const unlock = await prisma.itineraryUnlock.create({
    data: {
      destination,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      amount: ITINERARY_PRICE,
    },
  });

  try {
    const checkout = await paymentGateway.initiateCheckout({
      bookingId: unlock.id,
      amount: ITINERARY_PRICE,
      customerName: unlock.customerName,
      customerEmail: unlock.customerEmail,
      customerPhone: unlock.customerPhone,
      productInfo: `Ziyam Road Trip Itinerary — Bengaluru to ${destination}`,
      callbackPath: '/api/payments/payu/itinerary-callback',
    });

    await prisma.itineraryUnlock.update({ where: { id: unlock.id }, data: { paymentIntentId: checkout.txnid } });

    res.status(201).json({ success: true, data: { id: unlock.id, url: checkout.checkoutUrl, fields: checkout.fields } });
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

/** Persist Firebase-generated copy once payment has already succeeded. First write only. */
router.post('/itineraries/:id/content', async (req: Request, res: Response) => {
  const content = typeof req.body?.generatedContent === 'string' ? req.body.generatedContent.trim() : '';
  if (content.length < 80 || content.length > 50_000) {
    return res.status(400).json({ error: 'generatedContent must be between 80 and 50,000 characters' });
  }

  const unlock = await prisma.itineraryUnlock.findUnique({ where: { id: req.params.id } });
  if (!unlock) return res.status(404).json({ error: 'Itinerary not found' });
  if (unlock.status !== 'PAID') return res.status(409).json({ error: 'Itinerary is not paid yet' });
  if (unlock.generatedContent && unlock.generatedContent.length >= 80 && !/couldn't generate your itinerary/i.test(unlock.generatedContent)) {
    return res.json({ success: true, data: unlock });
  }

  const updated = await prisma.itineraryUnlock.update({
    where: { id: unlock.id },
    data: { generatedContent: content },
  });
  res.json({ success: true, data: updated });
});

export default router;
