import { Router, Request, Response } from 'express';
import { PrismaClient, OpsInvoiceStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeGst } from '../services/gstService';
import { getSetting } from '../services/settingsService';
import { recordAudit } from '../middleware/auditLog';

const router = Router();
const prisma = new PrismaClient();

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.opsInvoice.count();
  return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
}

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

// Corrects a trip's check-in details (customer/pickup/fare, typically a
// typo) before checkout closes it out — checkout has its own separate
// return-side fields (checkOut below) and isn't affected by this route.
router.patch('/ops-trips/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.opsTrip.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Trip not found' });
  if (existing.status !== 'RUNNING' && existing.status !== 'SCHEDULED') {
    return res.status(409).json({ error: 'Only running or scheduled trips can be edited — this one is already closed out' });
  }

  const {
    tripCode, bookingPlatform, externalBookingId, driverRef,
    customerName, customerMobile, pickupLocation, dropLocation, pickupType,
    startTime, odometerStart, fastag, baseFare, addonTotal, notes,
  } = req.body;

  const nextBaseFare = baseFare !== undefined ? Number(baseFare) : existing.baseFare;
  const nextAddonTotal = addonTotal !== undefined ? Number(addonTotal) : existing.addonTotal;

  const trip = await prisma.opsTrip.update({
    where: { id },
    data: {
      ...(tripCode !== undefined && { tripCode }),
      ...(bookingPlatform !== undefined && { bookingPlatform }),
      ...(externalBookingId !== undefined && { externalBookingId }),
      ...(driverRef !== undefined && { driverRef }),
      ...(customerName !== undefined && { customerName }),
      ...(customerMobile !== undefined && { customerMobile }),
      ...(pickupLocation !== undefined && { pickupLocation }),
      ...(dropLocation !== undefined && { dropLocation }),
      ...(pickupType !== undefined && { pickupType }),
      ...(startTime !== undefined && { startTime: new Date(startTime) }),
      ...(odometerStart !== undefined && { odometerStart: Number(odometerStart) }),
      ...(fastag !== undefined && { fastag }),
      ...(baseFare !== undefined && { baseFare: nextBaseFare }),
      ...(addonTotal !== undefined && { addonTotal: nextAddonTotal }),
      ...(notes !== undefined && { notes }),
      ...((baseFare !== undefined || addonTotal !== undefined) && { amount: (nextBaseFare || 0) + (nextAddonTotal || 0) }),
    },
  });
  res.json({ success: true, data: trip });
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

// Generates the "Vehicle Rental Invoice" for a completed trip — GST computed
// via gstService (CGST+SGST or IGST depending on place of supply), the
// facilitation-fee split frozen from the current fleet_facilitation_fee_pct
// Setting so later config changes don't retroactively alter this invoice.
router.post('/ops-trips/:id/invoice', async (req: Request, res: Response) => {
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id }, include: { car: true } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status !== 'COMPLETED') return res.status(400).json({ error: 'Can only invoice a completed trip' });

  const existing = await prisma.opsInvoice.findFirst({ where: { tripId: trip.id } });
  if (existing) return res.status(409).json({ error: 'This trip has already been invoiced', data: existing });

  const amount = trip.amount ?? 0;
  const serviceChargePct = await getSetting<number>('fleet_facilitation_fee_pct', 20);
  const serviceCharge = Number((amount * (serviceChargePct / 100)).toFixed(2));
  const netToOwner = Number((amount - serviceCharge).toFixed(2));
  const gst = await computeGst(amount, trip.car.city);

  try {
    const invoice = await prisma.opsInvoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(),
        type: 'RENTAL',
        tripId: trip.id,
        amount, serviceChargePct, serviceCharge, netToOwner,
        placeOfSupply: gst.placeOfSupply, gstRate: gst.gstRate,
        cgstAmount: gst.cgstAmount, sgstAmount: gst.sgstAmount, igstAmount: gst.igstAmount,
        customerName: trip.customerName, customerMobile: trip.customerMobile,
        createdById: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Invoice number collision — please try again' });
    throw err;
  }
});

router.post('/ops-trips/:id/images', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const image = await prisma.opsTripImage.create({ data: { tripId: req.params.id, url } });
  res.status(201).json({ success: true, data: image });
});

/* ── Invoices — "Vehicle Rental Invoice" (trip) / "Vehicle Service Invoice"
   (maintenance job), same model+format, matching the real production system. */

router.get('/ops-invoices', async (req: Request, res: Response) => {
  const { type, status } = req.query;
  const data = await prisma.opsInvoice.findMany({
    where: {
      ...(type && type !== 'All' && { type: String(type) as any }),
      ...(status && status !== 'All' && { status: String(status) as any }),
    },
    include: {
      trip: { include: { car: true } },
      service: { include: { car: true } },
      payments: true,
    },
    orderBy: { issuedAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, count: data.length, data });
});

router.get('/ops-invoices/:id', async (req: Request, res: Response) => {
  const invoice = await prisma.opsInvoice.findUnique({
    where: { id: req.params.id },
    include: { trip: { include: { car: true } }, service: { include: { car: true } }, payments: true },
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ success: true, data: invoice });
});

// Admin-only lifecycle transition (DRAFT -> PENDING -> SENT -> PAID). Amount/GST
// are intentionally not editable here — they're frozen at issue time from the
// rate/GST settings in effect that day (see the OpsInvoice model comment); a
// wrong invoice should be handled by generating a corrected one, not silently
// mutating the financial figures on an issued document.
router.patch('/ops-invoices/:id/status', requireAuth, requireRole('ADMIN', 'FLEET_ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!Object.values(OpsInvoiceStatus).includes(status)) {
    return res.status(400).json({ error: `status must be one of ${Object.values(OpsInvoiceStatus).join(', ')}` });
  }
  const existing = await prisma.opsInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  const invoice = await prisma.opsInvoice.update({ where: { id }, data: { status } });
  await recordAudit(req.user!.userId, 'UPDATE_INVOICE_STATUS', 'OpsInvoice', id, { from: existing.status, to: status });
  res.json({ success: true, data: invoice });
});

export default router;
