import { Router, Request, Response } from 'express';
import { PrismaClient, OpsInvoiceStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeGst } from '../services/gstService';
import { getSetting } from '../services/settingsService';
import { recordAudit } from '../middleware/auditLog';
import { pickLeastLoadedOpsAgent } from '../services/agentAssignment';
import { digilockerApi, isSetuConfigured } from '../services/setuService';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.opsInvoice.count();
  return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
}

// Fleet Ops trip lifecycle. Operations Executives, Fleet Admins, and platform
// Admins see and manage every trip; AGENT is the standalone ground-staff app
// (src/agent) and is scoped to only its own assigned trips (see
// assignedFilter/assertOwnsTrip below) — added alongside AGENT_APP_ROLES in
// src/agent's auth-context.tsx, which previously had no working backend route
// to call despite the admin Agent Portal already wiring up opsTripApi.
router.use('/ops-trips', requireAuth, requireRole('AGENT', 'OPERATIONS_EXECUTIVE', 'FLEET_ADMIN', 'ADMIN'));

function assignedFilter(req: Request) {
  return req.user!.role === 'AGENT' ? { assignedAgentId: req.user!.userId } : {};
}

function assertOwnsTrip(req: Request, trip: { assignedAgentId: string | null }) {
  return req.user!.role !== 'AGENT' || trip.assignedAgentId === req.user!.userId;
}

router.get('/ops-trips', async (req: Request, res: Response) => {
  const { status, carId } = req.query;
  const data = await prisma.opsTrip.findMany({
    where: {
      ...assignedFilter(req),
      ...(status && status !== 'All' && { status: String(status) as any }),
      ...(carId && { carId: String(carId) }),
    },
    include: { car: true, createdBy: { select: { fullName: true } }, agent: { select: { fullName: true } }, images: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, count: data.length, data });
});

// Reusable verified-identity lookup for a repeat walk-in customer — must be
// registered ahead of the /:id routes below or Express would swallow "vault"
// as an :id value.
router.get('/ops-trips/vault/:phone', async (req: Request, res: Response) => {
  const entry = await prisma.customerVaultEntry.findUnique({ where: { phoneNumber: req.params.phone } });
  if (!entry) return res.status(404).json({ error: 'No saved identity for this number' });
  res.json({ success: true, data: entry });
});

router.get('/ops-trips/:id', async (req: Request, res: Response) => {
  const trip = await prisma.opsTrip.findUnique({
    where: { id: req.params.id },
    include: { car: true, createdBy: { select: { fullName: true } }, agent: { select: { fullName: true } }, images: true, invoices: true },
  });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
  res.json({ success: true, data: trip });
});

// Check-in: creates the trip in RUNNING status with pickup-side details.
router.post('/ops-trips', async (req: Request, res: Response) => {
  const {
    carId, tripCode, bookingPlatform, externalBookingId, driverRef,
    customerName, customerMobile, pickupLocation, dropLocation, pickupType,
    startTime, odometerStart, fastag, baseFare, addonTotal, addons, notes,
    depositAmount, assignedAgentId: requestedAgentId,
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

  // An agent always checks themself in; dispatchers (ops exec/fleet admin/
  // admin) may hand a trip to a specific agent, otherwise it's "finger-crossed"
  // to whichever on-duty agent currently has the fewest open trips.
  const assignedAgentId = req.user!.role === 'AGENT'
    ? req.user!.userId
    : requestedAgentId || (await pickLeastLoadedOpsAgent()) || undefined;

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
      depositAmount: depositAmount !== undefined ? Number(depositAmount) : undefined,
      assignedAgentId,
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
  if (!assertOwnsTrip(req, existing)) return res.status(403).json({ error: 'Not assigned to you' });
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

// Handover: records identity verification, signature, vehicle condition
// photos, and deposit collection — the paperwork step between check-in and
// handing the keys over. Doesn't change trip status (the trip is already
// RUNNING from check-in); this just fills in the compliance record.
router.patch('/ops-trips/:id/handover', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    idVerificationMethod, maskedIdPhotoUrl, dlFrontUrl, dlBackUrl, dlNumber,
    customerSignatureUrl, vehiclePhotoUrls, depositCollected, depositPaymentMode,
    saveIdentityToVault,
  } = req.body;

  const trip = await prisma.opsTrip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
  if (trip.status !== 'RUNNING') return res.status(400).json({ error: `Cannot record a handover for a trip in status ${trip.status}` });

  if (idVerificationMethod !== undefined && !['MASKED_PHOTO', 'DIGILOCKER'].includes(idVerificationMethod)) {
    return res.status(400).json({ error: 'idVerificationMethod must be MASKED_PHOTO or DIGILOCKER' });
  }

  const updated = await prisma.opsTrip.update({
    where: { id },
    data: {
      ...(idVerificationMethod !== undefined && { idVerificationMethod }),
      ...(maskedIdPhotoUrl !== undefined && { maskedIdPhotoUrl }),
      ...(dlFrontUrl !== undefined && { dlFrontUrl }),
      ...(dlBackUrl !== undefined && { dlBackUrl }),
      ...(dlNumber !== undefined && { dlNumber }),
      ...(customerSignatureUrl !== undefined && { customerSignatureUrl }),
      ...(vehiclePhotoUrls !== undefined && { vehiclePhotoUrls }),
      ...(depositCollected !== undefined && { depositCollected: Number(depositCollected) }),
      ...(depositPaymentMode !== undefined && { depositPaymentMode }),
      ...(saveIdentityToVault !== undefined && { saveIdentityToVault: Boolean(saveIdentityToVault) }),
    },
  });

  if (saveIdentityToVault && trip.customerMobile) {
    const identity = {
      fullName: trip.customerName,
      idVerificationMethod: idVerificationMethod ?? trip.idVerificationMethod,
      maskedIdPhotoUrl: maskedIdPhotoUrl ?? trip.maskedIdPhotoUrl,
      dlFrontUrl: dlFrontUrl ?? trip.dlFrontUrl,
      dlBackUrl: dlBackUrl ?? trip.dlBackUrl,
      dlNumber: dlNumber ?? trip.dlNumber,
      digilockerVerifiedName: trip.digilockerVerifiedName,
      digilockerAddress: trip.digilockerAddress,
      digilockerAadhaarLast4: trip.digilockerAadhaarLast4,
    };
    await prisma.customerVaultEntry.upsert({
      where: { phoneNumber: trip.customerMobile },
      create: { phoneNumber: trip.customerMobile, ...identity },
      update: identity,
    });
  }

  res.json({ success: true, data: updated });
});

/**
 * Real DigiLocker consent flow (Setu), scoped to a specific walk-in trip
 * rather than a User — same digilockerApi already powering renter/host KYC
 * in kyc.routes.ts, redirecting back into the agent app instead of the
 * renter frontend.
 */
router.post('/ops-trips/:id/identity/digilocker/start', async (req: Request, res: Response) => {
  if (!isSetuConfigured()) return res.status(503).json({ error: 'DigiLocker verification is not configured yet' });
  const { id } = req.params;
  const trip = await prisma.opsTrip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });

  try {
    const redirectUrl = `${config.agentUrl}/bookings/${id}?digilocker=1`;
    const request = await digilockerApi.createRequest(redirectUrl);
    await prisma.opsTrip.update({
      where: { id },
      data: { digilockerRequestId: request.id, digilockerStatus: 'unauthenticated' },
    });
    res.json({ success: true, data: { url: request.url } });
  } catch (err: any) {
    console.error('[OpsTrip] DigiLocker request creation failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not start DigiLocker verification right now. Please try again shortly.' });
  }
});

/** Polled by the agent app after the customer returns from DigiLocker's consent screen. */
router.get('/ops-trips/:id/identity/digilocker/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const trip = await prisma.opsTrip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
  if (!trip.digilockerRequestId) return res.status(400).json({ error: 'No DigiLocker verification in progress for this trip' });
  if (trip.digilockerStatus === 'authenticated') {
    return res.json({ success: true, data: { status: 'authenticated', name: trip.digilockerVerifiedName, address: trip.digilockerAddress } });
  }

  try {
    const status = await digilockerApi.getStatus(trip.digilockerRequestId);
    if (status.status === 'authenticated') {
      const aadhaar = await digilockerApi.fetchAadhaar(trip.digilockerRequestId).catch(() => null);
      const updated = await prisma.opsTrip.update({
        where: { id },
        data: {
          digilockerStatus: 'authenticated',
          idVerificationMethod: 'DIGILOCKER',
          ...(aadhaar?.name && { digilockerVerifiedName: aadhaar.name }),
          ...(aadhaar?.address && { digilockerAddress: aadhaar.address }),
        },
      });
      return res.json({ success: true, data: { status: 'authenticated', name: updated.digilockerVerifiedName, address: updated.digilockerAddress } });
    }
    res.json({ success: true, data: { status: status.status } });
  } catch (err: any) {
    console.error('[OpsTrip] DigiLocker status check failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not check DigiLocker status right now.' });
  }
});

// Prefilled WhatsApp message text for the three ground-staff resend actions —
// the agent app opens https://wa.me/91<mobile>?text=<this> so no WhatsApp
// Business API integration is needed to send a "real" templated message.
router.get('/ops-trips/:id/whatsapp-templates', async (req: Request, res: Response) => {
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id }, include: { car: true } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });

  const vehicle = `${trip.car.make} ${trip.car.model} (${trip.car.registrationNo})`;
  const start = trip.startTime.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const balance = (trip.amount ?? 0) - (trip.amountPaidGuest ?? 0);

  const bookingConfirmation =
    `Booking Confirmation\n\nDear ${trip.customerName},\n\nThank you for booking with ZiyamSelfDrive. Your reservation is confirmed.\n\nVehicle: ${vehicle}\nPickup: ${start}\n\nSee you soon!`;

  const handoverConfirmation =
    `Handover Confirmation\n\nDear ${trip.customerName},\n\nYour ${vehicle} has been handed over.\nOdometer at handover: ${trip.odometerStart ?? '—'} km\n\nPlease drive safe and return the vehicle on time to avoid late charges.`;

  const returnReminder =
    `Return Reminder\n\nDear ${trip.customerName},\n\nThis is a reminder that your ${vehicle} rental is due for return.\nBalance due: ₹${balance}\n\nNeed more time? Reply here and we'll help you extend.`;

  res.json({ success: true, data: { bookingConfirmation, handoverConfirmation, returnReminder } });
});

// Check-out: closes the trip with return-side details.
router.patch('/ops-trips/:id/checkout', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    endTime, odometerEnd, checkoutFastag, fuelEst, carWashed, washingCharges,
    tyreHealth, newDamages, amountCollected, amountPaidGuest, checkoutAddons,
    customerDecision, refundDeposit,
  } = req.body;

  const trip = await prisma.opsTrip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
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
      ...(customerDecision !== undefined && { customerDecision }),
      ...(refundDeposit && { depositRefundedAt: new Date() }),
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

// Reassign a trip to a different on-duty agent — dispatcher-only, since an
// agent reassigning themself off a trip would just be handing off work
// without anyone actually deciding to take it.
router.patch('/ops-trips/:id/assign', requireRole('OPERATIONS_EXECUTIVE', 'FLEET_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const { assignedAgentId } = req.body;
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (assignedAgentId) {
    const agent = await prisma.user.findUnique({ where: { id: assignedAgentId } });
    if (!agent || agent.role !== 'AGENT') return res.status(400).json({ error: 'assignedAgentId must be an on-duty agent' });
  }
  const updated = await prisma.opsTrip.update({ where: { id: req.params.id }, data: { assignedAgentId: assignedAgentId || null } });
  res.json({ success: true, data: updated });
});

router.patch('/ops-trips/:id/cancel', async (req: Request, res: Response) => {
  const trip = await prisma.opsTrip.findUnique({ where: { id: req.params.id } });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
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
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
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
  if (!assertOwnsTrip(req, trip)) return res.status(403).json({ error: 'Not assigned to you' });
  const image = await prisma.opsTripImage.create({ data: { tripId: req.params.id, url } });
  res.status(201).json({ success: true, data: image });
});

/* ── Invoices — "Vehicle Rental Invoice" (trip) / "Vehicle Service Invoice"
   (maintenance job), same model+format, matching the real production system. */

router.get('/ops-invoices', requireAuth, requireRole('OPERATIONS_EXECUTIVE', 'FLEET_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
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

router.get('/ops-invoices/:id', requireAuth, requireRole('OPERATIONS_EXECUTIVE', 'FLEET_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
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
