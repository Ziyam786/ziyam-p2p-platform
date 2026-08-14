import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import paymentGateway from '../services/paymentGateway';
import { PayoutEngine } from '../services/payoutEngine';
import { TelematicsService } from '../services/telematicsService';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Search available cars by city
router.get('/cars/search', async (req: Request, res: Response) => {
  const { city } = req.query;
  const cars = await prisma.car.findMany({
    where: { city: String(city ?? ''), isAvailable: true },
    include: { owner: { select: { fullName: true, role: true } } },
  });
  res.json({ success: true, count: cars.length, data: cars });
});

// Create a booking + split payment intent
router.post('/booking', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.sub;
  const { carId, startTime, endTime, totalAmount } = req.body;

  try {
    const car = await prisma.car.findUnique({ where: { id: carId }, include: { owner: true } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (!car.isAvailable) return res.status(409).json({ error: 'Car is no longer available' });
    if (!car.owner.payoutAccountId) {
      return res.status(422).json({ error: 'Host payout account not configured' });
    }

    const { platformFee, hostPayout } = PayoutEngine.splitAmount(totalAmount);

    const paymentIntent = await paymentGateway.createSplitPayment({
      amount: totalAmount,
      currency: 'INR',
      destinationAccountId: car.owner.payoutAccountId,
      platformFeeAmount: platformFee,
      metadata: { carId, customerId },
    });

    const booking = await prisma.booking.create({
      data: {
        id: uuidv4(),
        carId,
        customerId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        totalAmount,
        platformFee,
        hostPayoutAmount: hostPayout,
        paymentIntentId: paymentIntent.id,
        status: BookingStatus.PENDING_PAYMENT,
      },
    });

    res.status(201).json({ success: true, clientSecret: paymentIntent.clientSecret, bookingId: booking.id });
  } catch (error: any) {
    res.status(500).json({ error: `Booking failed: ${error.message}` });
  }
});

// Mark a trip completed -> release N+1 payout escrow
router.post('/booking/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED },
    });
    await PayoutEngine.createEscrowLedger(booking.id);
    res.json({ success: true, message: 'Trip completed. N+1 payout scheduled.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remote keyless unlock for an active booking
router.post('/booking/:id/unlock', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.sub;

  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking || booking.status !== BookingStatus.ACTIVE) {
    return res.status(400).json({ error: 'Booking is not active' });
  }
  if (booking.customerId !== userId) {
    return res.status(403).json({ error: 'You may only unlock a vehicle for your own booking' });
  }
  if (!booking.car.telematicsImei) {
    return res.status(400).json({ error: 'Vehicle has no keyless IoT hardware' });
  }

  const success = await TelematicsService.unlockVehicle(booking.car.telematicsImei, userId);
  res.json({ success, message: success ? 'Vehicle unlocked' : 'Unlock failed' });
});

export default router;
