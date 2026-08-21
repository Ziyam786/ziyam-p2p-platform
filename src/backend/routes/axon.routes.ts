import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AxonSupplyGateway } from '../services/axonSupplyGateway';
import { AxonPricingEngine } from '../services/axonPricingEngine';
import { config } from '../config';

const router = Router();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Every route below is a B2B integration surface for external fleet
// aggregators (Zoomcar, Revv), not an end-user session — there's no cookie
// or JWT to check. Each partner instead gets a static key, sent as the
// X-Axon-Api-Key header (search, pricing) or an apiKey query param (the
// .ics calendar route, since a partner's calendar-sync job may not be able
// to set a custom header on that GET). Fails closed: an empty configured
// list (no AXON_PARTNER_API_KEYS set) rejects everyone rather than opening
// the gateway to the public by omission.
function requireAxonApiKey(req: Request, res: Response, next: NextFunction) {
  const configuredKeys = config.axon.partnerApiKeys;
  const suppliedKey = (req.headers['x-axon-api-key'] as string | undefined) ?? (req.query.apiKey as string | undefined);

  if (configuredKeys.length === 0 || !suppliedKey || !configuredKeys.some((key) => safeEqual(key, suppliedKey))) {
    return res.status(401).json({ error: 'Invalid or missing Axon API key' });
  }
  next();
}

router.use(requireAxonApiKey);

// GET /api/v1/axon/search - Search available fleet in real time
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { city, category, pickupTime, dropTime } = req.query;

    if (!city || !pickupTime || !dropTime) {
      return res.status(400).json({ error: 'city, pickupTime, and dropTime are required' });
    }

    const availableCars = await AxonSupplyGateway.searchAvailableFleet({
      city: String(city),
      category: category ? String(category) : undefined,
      pickupTime: new Date(String(pickupTime)),
      dropTime: new Date(String(dropTime)),
    });

    return res.json({
      success: true,
      count: availableCars.length,
      vehicles: availableCars,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Axon search failed' });
  }
});

// POST /api/v1/axon/pricing/quote - Get exact fare breakdown
router.post('/pricing/quote', (req: Request, res: Response) => {
  try {
    const { dailyRate, pickupTime, dropTime } = req.body;

    if (!dailyRate || !pickupTime || !dropTime) {
      return res.status(400).json({ error: 'dailyRate, pickupTime, and dropTime are required' });
    }

    const quote = AxonPricingEngine.calculateFare({
      dailyRate: Number(dailyRate),
      pickupTime: new Date(pickupTime),
      dropTime: new Date(dropTime),
    });

    return res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/axon/calendar/:carId/feed.ics - iCal feed for aggregators (Zoomcar, Revv)
router.get('/calendar/:carId/feed.ics', async (req: Request, res: Response) => {
  try {
    const { carId } = req.params;
    const icsContent = await AxonSupplyGateway.generateICalendarFeed(carId);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ziyam-car-${carId}.ics"`);
    return res.send(icsContent);
  } catch (error: any) {
    return res.status(500).send('Error generating calendar feed');
  }
});

export default router;