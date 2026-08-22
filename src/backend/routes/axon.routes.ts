import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, AxonPartnerStatus } from '@prisma/client';
import { AxonSupplyGateway } from '../services/axonSupplyGateway';
import { AxonPricingEngine } from '../services/axonPricingEngine';
import { PayoutEngine } from '../services/payoutEngine';
import { comparePassword } from '../utils/password';
import { isBookable } from '../utils/carPhotoAngles';
import { notify } from '../services/notificationService';
import { config } from '../config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      axonPartner?: { id: string; name: string; status: AxonPartnerStatus };
    }
  }
}

const prisma = new PrismaClient();

const router = Router();

// Every route below is a B2B integration surface for external fleet
// aggregators (Zoomcar, Revv), not an end-user session — there's no cookie
// or JWT to check. Each partner instead gets a static key, sent as the
// X-Axon-Api-Key header (search, pricing) or an apiKey query param (the
// .ics calendar route, since a partner's calendar-sync job may not be able
// to set a custom header on that GET).
async function requireAxonApiKey(req: Request, res: Response, next: NextFunction) {
  const suppliedKey = (req.headers['x-axon-api-key'] as string | undefined) ?? (req.query.apiKey as string | undefined);
  if (!suppliedKey) {
    return res.status(401).json({ error: 'Invalid or missing Axon API key' });
  }

  // apiKeyHash is bcrypt — there's no indexed lookup by the raw key, so this
  // checks every active partner's hash. Axon partners are a small, curated
  // set (a handful, not thousands), so this is not a real cost at this scale.
  const partners = await prisma.axonPartner.findMany({ where: { status: AxonPartnerStatus.ACTIVE } });
  for (const partner of partners) {
    if (await comparePassword(suppliedKey, partner.apiKeyHash)) {
      req.axonPartner = { id: partner.id, name: partner.name, status: partner.status };
      return next();
    }
  }
  return res.status(401).json({ error: 'Invalid or missing Axon API key' });
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

// POST /api/v1/axon/bookings - Create a real, auto-confirmed booking
router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const { carId, pickupTime, dropTime } = req.body;
    if (!carId || !pickupTime || !dropTime) {
      return res.status(400).json({ error: 'carId, pickupTime, and dropTime are required' });
    }

    const pickup = new Date(pickupTime);
    const drop = new Date(dropTime);
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(drop.getTime()) || drop <= pickup) {
      return res.status(400).json({ error: 'pickupTime must be a valid date strictly before dropTime' });
    }

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (!car.isAvailable || car.verificationStatus !== 'VERIFIED' || !isBookable(car, config.photoAngleEnforcementDate)) {
      return res.status(422).json({ error: 'This car is not currently bookable' });
    }

    const available = await AxonSupplyGateway.isCarAvailableForWindow(carId, pickup, drop);
    if (!available) return res.status(409).json({ error: 'This car is already booked for the requested window' });

    const fare = AxonPricingEngine.calculateFare({ dailyRate: car.dailyRate, pickupTime: pickup, dropTime: drop });

    // Booking.platformFee/hostPayoutAmount are the same Ziyam-commission
    // split every other booking-creation path computes (see
    // booking.routes.ts, admin.routes.ts) — PayoutEngine.splitAmount reads
    // this at trip completion (booking.totalAmount - booking.platformFee),
    // so an Axon booking must populate it the same way, not leave it at 0.
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(fare.baseFare, 0);

    const booking = await prisma.booking.create({
      data: {
        carId,
        customerId: null,
        axonPartnerId: req.axonPartner!.id,
        source: 'AXON_PARTNER',
        startTime: pickup,
        endTime: drop,
        totalAmount: fare.baseFare,
        platformFee,
        hostPayoutAmount: hostPayout,
        deliveryFeeAmount: 0,
        depositAmount: 0,
        status: 'CONFIRMED',
      },
    });

    await notify(car.ownerId, 'GENERIC', 'New booking (Axon partner)', `A partner booking is confirmed for your ${car.make} ${car.model}.`, '/host/dashboard');

    return res.json({
      success: true,
      data: { bookingId: booking.id, status: booking.status, fare },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Axon booking failed' });
  }
});

export default router;