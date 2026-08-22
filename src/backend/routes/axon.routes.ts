import { Router, Request, Response, NextFunction } from 'express';
import { Prisma, PrismaClient, AxonPartnerStatus } from '@prisma/client';
import { AxonSupplyGateway } from '../services/axonSupplyGateway';
import { AxonPricingEngine } from '../services/axonPricingEngine';
import { PayoutEngine } from '../services/payoutEngine';
import { comparePassword } from '../utils/password';
import { isBookable } from '../utils/carPhotoAngles';
import { notify } from '../services/notificationService';
import { isBookingOverlapViolation, BOOKING_OVERLAP_MESSAGE } from '../utils/bookingOverlap';
import { config } from '../config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      axonPartner?: { id: string; name: string; status: AxonPartnerStatus };
    }
  }
}

/** Thrown inside the booking-creation transaction below to distinguish an intentional 409 conflict from any other transaction failure — mirrors booking.routes.ts's BookingConflictError (not exported there, so not reused directly). */
class AxonBookingConflictError extends Error {}

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

    const fare = AxonPricingEngine.calculateFare({ dailyRate: car.dailyRate, pickupTime: pickup, dropTime: drop });

    // Booking.platformFee/hostPayoutAmount are the same Ziyam-commission
    // split every other booking-creation path computes (see
    // booking.routes.ts, admin.routes.ts) — PayoutEngine.splitAmount reads
    // this at trip completion (booking.totalAmount - booking.platformFee),
    // so an Axon booking must populate it the same way, not leave it at 0.
    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(fare.baseFare, 0);

    // The availability check and the create must happen as one atomic unit
    // — a plain check-then-create (this route's original shape) lets two
    // concurrent partner requests both pass the check before either
    // commits, double-booking the car. Mirrors booking.routes.ts's fix for
    // the identical race: Serializable isolation makes Postgres detect the
    // write-write conflict and abort the loser with P2034, which we
    // translate back into the same 409 the plain check used to return. The
    // DB-level exclusion constraint (isBookingOverlapViolation) is the
    // backstop that still holds even if this is ever weakened to a lower
    // isolation level.
    let bookingId: string;
    try {
      bookingId = await prisma.$transaction(
        async (tx) => {
          // Same rule as AxonSupplyGateway.isCarAvailableForWindow (same
          // statuses, same 2-hour Mechanix Pro sanitization buffer),
          // inlined here rather than called out to, so the check runs
          // against `tx` — Serializable isolation only protects a
          // check-then-write pair when both run on the same transaction
          // client, not the bare module-level `prisma`.
          const SANITIZATION_BUFFER_MS = 2 * 60 * 60 * 1000;
          const requestedEndWithBuffer = new Date(drop.getTime() + SANITIZATION_BUFFER_MS);
          const conflict = await tx.booking.findFirst({
            where: {
              carId,
              status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT'] },
              startTime: { lte: requestedEndWithBuffer },
              endTime: { gte: pickup },
            },
            select: { id: true },
          });
          if (conflict) {
            throw new AxonBookingConflictError('This car is already booked for the requested window');
          }

          const created = await tx.booking.create({
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
          return created.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error instanceof AxonBookingConflictError) {
        return res.status(409).json({ error: error.message });
      }
      // P2034: Prisma/Postgres detected the serialization conflict itself —
      // the losing request's inline conflict check above would have
      // passed, so this IS a double-booking attempt, not a generic failure.
      if (error?.code === 'P2034') {
        return res.status(409).json({ error: BOOKING_OVERLAP_MESSAGE });
      }
      // Belt and braces: the serializable transaction above should already
      // have caught any real race as P2034, but the database's exclusion
      // constraint is the backstop that holds even if this path is ever
      // refactored to a weaker isolation level.
      if (isBookingOverlapViolation(error)) {
        return res.status(409).json({ error: BOOKING_OVERLAP_MESSAGE });
      }
      throw error;
    }

    await notify(car.ownerId, 'GENERIC', 'New booking (Axon partner)', `A partner booking is confirmed for your ${car.make} ${car.model}.`, '/host/dashboard');

    return res.json({
      success: true,
      data: { bookingId, status: 'CONFIRMED', fare },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Axon booking failed' });
  }
});

export default router;