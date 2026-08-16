import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Fleet Ops trip lifecycle — internal ops staff only (merged from the
// standalone Fleet Ops Admin Dashboard). Operations Executives run check-in/
// check-out; Fleet Admins and platform Admins see and manage everything.
router.use('/ops-trips', requireAuth, requireRole('OPERATIONS_EXECUTIVE', 'FLEET_ADMIN', 'ADMIN'));

router.get('/ops-trips', async (req: Request, res: Response) => {
  const { status, carId } = req.query;
  const data = await prisma.opsTrip.findMany({
    where: {
      ...(status && status !== 'All' && { status: String(status) as any }),
      ...(carId && { carId: String(carId) }),
    },
    include: { car: true, createdBy: { select: { fullName: true } }, images: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, count: data.length, data });
});

router.get('/ops-trips/:id', async (req: Request, res: Response) => {
  const trip = await prisma.opsTrip.findUnique({
    where: { id: req.params.id },
    include: { car: true, createdBy: { select: { fullName: true } }, images: true, invoices: true },
  });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json({ success: true, data: trip });
});

// Check-in: creates the trip in RUNNING status with pickup-side details.
router.post('/ops-trips', async (req: Request, res: Response) => {
  const {
    carId, tripCode, bookingPlatform, externalBookingId, driverRef,
    customerName, customerMobile, pickupLocation, dropLocation, pickupType,
    startTime, odometerStart, fastag, baseFare, addonTotal, addons, notes,
  } = req.body;

  if (!carId || !customerName || !customerMobile || !startTime) {
    return res.status(400).json({ error: 'carId, customerName, customerMobile, and startTime are required' });
  }

  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return res.status(404).json({ error: 'Car not found' });
  if (car.fleetStatus === 'paused') {
    return res.status(409).json({ error: `This vehicle is paused (${car.pauseReason ?? 'reason not set'}) and cannot be checked in for a trip.` });
  }

  const amount = (Number(baseFare) || 0) + (Number(addonTotal) || 0);

  const trip = await prisma.opsTrip.create({
    data: {
      carId, tripCode, bookingPlatform, externalBookingId, driverRef,
      customerName, customerMobile, pickupLocation, dropLocation, pickupType,
      startTime: new Date(startTime),
      odometerStart: odometerStart !== undefined ? Number(odometerStart) : undefined,
      fastag, baseFare: baseFare !== undefined ? Number(baseFare) : undefined,
      addonTotal: addonTotal !== undefined ? Number(addonTotal) : undefined,
      amount: amount || undefined,
      addons,
      notes,
      status: 'RUNNING',
      createdById: req.user!.userId,
    },
  });

  // Mirrors the real production system: checking a car into a trip doesn't
  // change fleetStatus (that's the separate pause/service workflow) — the
  // renter-facing Blackout calendar already blocks overlapping Booking dates
  // independently, and OpsTrip customers have no renter account to book
  // through that flow anyway.
  res.status(201).json({ success: true, data: trip });
});

// Check-out: closes the trip with return-side details.
router.patch('/ops-trips/:id/checkout', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    endTime, odometerEnd, checkoutFastag, fuelEst, carWashed, washingCharges,
    tyreHealth, newDamages, amountCollected, amountPaidGuest, checkoutAddons,
  } = req.body;

  const trip = await prisma.opsTrip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status !== 'RUNNING') return res.status(400).json({ error: `Cannot check out a trip in status ${trip.status}` });

  const rangeKm = odometerEnd !== undefined && trip.odometerStart != null
    ? Number(odometerEnd) - trip.odometerStart
    : undefined;

  const updated = await prisma.opsTrip.update({
    where: { id },
    data: {
      endTime: endTime ? new Date(endTime) : new Date(),
      odometerEnd: odometerEnd !== undefined ? Number(odometerEnd) : undefined,
      rangeKm,
      checkoutFastag, fuelEst,
      carWashed: Boolean(carWashed),
      washingCharges: washingCharges !== undefined ? Number(washingCharges) : undefined,
      tyreHealth, newDamages,
      amountCollected: amountCollected !== undefined ? Number(amountCollected) : undefined,
      amountPaidGuest: amountPaidGuest !== undefined ? Number(amountPaidGuest) : undefined,
      checkoutAddons,
      status: 'COMPLETED',
    },
  });

  // Keep the car's own odometer current for the Maintenance Hub's
  // service-due tracking.
  if (odometerEnd !== undefined) {
    await prisma.car.update({ where: { id: trip.carId }, data: { currentOdo: Number(odometerEnd) } });
  }

  res.json({ success: true, data: updated });
});

router.patch('/ops-trips/:id/cancel', async (req: Request, res: Response) => {
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status === 'COMPLETED') return res.status(400).json({ error: 'Cannot cancel a completed trip' });
  const updated = await prisma.opsTrip.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  res.json({ success: true, data: updated });
});

router.post('/ops-trips/:id/images', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const image = await prisma.opsTripImage.create({ data: { tripId: req.params.id, url } });
  res.status(201).json({ success: true, data: image });
});

export default router;
