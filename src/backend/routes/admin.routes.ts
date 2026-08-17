import { Router, Request, Response } from 'express';
import { PrismaClient, Role, BookingStatus, PayoutStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth';
import { recordAudit } from '../middleware/auditLog';
import { PayoutEngine } from '../services/payoutEngine';
import { hashPassword } from '../utils/password';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

router.use('/admin', requireAuth, requireRole(Role.ADMIN));

router.get('/admin/stats', async (_req: Request, res: Response) => {
  const [userCount, carCount, bookingCount, gmv, activeTrips, pendingKyc] = await Promise.all([
    prisma.user.count(),
    prisma.car.count(),
    prisma.booking.count(),
    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { status: BookingStatus.COMPLETED } }),
    prisma.booking.count({ where: { status: BookingStatus.ACTIVE } }),
    prisma.user.count({ where: { isKycVerified: false, role: { in: [Role.SELF_HOST, Role.FLEET_OPERATOR] } } }),
  ]);

  res.json({
    success: true,
    data: {
      userCount,
      carCount,
      bookingCount,
      gmv: gmv._sum.totalAmount ?? 0,
      activeTrips,
      pendingKyc,
    },
  });
});

/* ── Bookings ─────────────────────────────────────────────────────── */
router.get('/admin/bookings', async (req: Request, res: Response) => {
  const { status } = req.query;
  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as BookingStatus } : undefined,
    include: {
      car: { select: { make: true, model: true, city: true } },
      customer: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, count: bookings.length, data: bookings });
});

// Admin-created booking — for walk-in or phone bookings where the customer
// isn't self-serving through the app. Mirrors the real customer-facing
// POST /booking (booking.routes.ts) for availability/blackout checks and
// the payout split, with two differences: (1) it accepts either an existing
// customerId or inline name/phone/email to create one on the spot, since a
// walk-in customer usually has no account yet, and (2) it skips the
// self-serve KYC gate — the ops staff creating this booking is verifying
// the customer's ID in person, which is what the reference app's Handover
// flow (DL/Aadhaar capture) does explicitly; the new customer record is
// marked isKycVerified for that reason, not left permanently blocked.
router.post('/admin/bookings', async (req: Request, res: Response) => {
  const {
    customerId, customerName, customerPhone, customerEmail,
    carId, startTime, endTime, totalAmount, protectionPlan, status,
    coDriverRequested, coDriverName, coDriverLicenseNumber,
  } = req.body;

  if (!carId || !startTime || !endTime || !totalAmount) {
    return res.status(400).json({ error: 'carId, startTime, endTime, and totalAmount are required' });
  }
  if (!customerId && (!customerName || !customerPhone || !customerEmail)) {
    return res.status(400).json({ error: 'Provide either customerId, or customerName + customerPhone + customerEmail for a new customer' });
  }
  if (coDriverRequested && (!String(coDriverName ?? '').trim() || !String(coDriverLicenseNumber ?? '').trim())) {
    return res.status(400).json({ error: 'Co-driver name and license number are required when adding a co-driver' });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) return res.status(400).json({ error: 'endTime must be after startTime' });

  const bookingStatus: BookingStatus = status && Object.values(BookingStatus).includes(status) ? status : BookingStatus.CONFIRMED;

  try {
    const car = await prisma.car.findUnique({ where: { id: carId }, include: { owner: true } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (!car.isAvailable) return res.status(409).json({ error: 'Car is not available for booking' });
    if (!car.owner.payoutAccountId) return res.status(422).json({ error: 'Host payout account not configured' });

    const conflictingBooking = await prisma.booking.findFirst({
      where: { carId, status: { notIn: [BookingStatus.CANCELLED] }, startTime: { lt: end }, endTime: { gt: start } },
    });
    if (conflictingBooking) return res.status(409).json({ error: 'This car is already booked for part of the selected dates' });

    const conflictingBlackout = await prisma.blackout.findFirst({ where: { carId, startDate: { lt: end }, endDate: { gt: start } } });
    if (conflictingBlackout) return res.status(409).json({ error: 'The host has blocked out part of the selected dates' });

    let finalCustomerId = customerId;
    if (!finalCustomerId) {
      const existingByContact = await prisma.user.findFirst({ where: { OR: [{ email: customerEmail }, { phoneNumber: customerPhone }] } });
      if (existingByContact) {
        return res.status(409).json({ error: 'A customer with that email or phone already exists — search for them instead of creating a new one.' });
      }
      const passwordHash = await hashPassword(uuidv4());
      const newCustomer = await prisma.user.create({
        data: {
          id: uuidv4(), fullName: customerName, email: customerEmail, phoneNumber: customerPhone,
          passwordHash, role: Role.CUSTOMER, isKycVerified: true,
        },
      });
      finalCustomerId = newCustomer.id;
    }

    const { platformFee, hostPayout } = await PayoutEngine.splitAmount(Number(totalAmount));
    // Same fractions as the guest-facing POST /booking (booking.routes.ts) —
    // an admin-entered booking (e.g. a phone booking) should carry the same
    // real deposit tracking as a self-service one.
    const DEPOSIT_HOLD_FRACTION: Record<string, number> = { BASIC: 1, STANDARD: 0.6, PREMIUM: 0.3 };
    const resolvedPlan = protectionPlan || 'BASIC';
    const depositAmount = Math.round((car.securityDeposit ?? 0) * (DEPOSIT_HOLD_FRACTION[resolvedPlan] ?? 1));

    const booking = await prisma.booking.create({
      data: {
        id: uuidv4(),
        carId,
        customerId: finalCustomerId,
        startTime: start,
        endTime: end,
        totalAmount: Number(totalAmount),
        platformFee,
        hostPayoutAmount: hostPayout,
        depositAmount,
        protectionPlan: resolvedPlan,
        coDriverRequested: Boolean(coDriverRequested),
        coDriverName: coDriverRequested ? String(coDriverName).trim() : null,
        coDriverLicenseNumber: coDriverRequested ? String(coDriverLicenseNumber).trim() : null,
        status: bookingStatus,
      },
      include: { car: { select: { make: true, model: true, city: true } }, customer: { select: { fullName: true, email: true } } },
    });
    await recordAudit(req.user!.userId, 'CREATE_BOOKING', 'Booking', booking.id, { carId, customerId: finalCustomerId, totalAmount, status: bookingStatus });
    res.status(201).json({ success: true, data: booking });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `That ${err.meta?.target?.[0] ?? 'value'} is already in use by another account.` });
    }
    console.error('[ADMIN] Create booking failed:', err);
    res.status(500).json({ error: 'Could not create the booking. Please try again.' });
  }
});

router.patch('/admin/bookings/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!Object.values(BookingStatus).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const booking = await prisma.booking.update({ where: { id }, data: { status } });
  await recordAudit(req.user!.userId, 'UPDATE_BOOKING_STATUS', 'Booking', id, { status });
  res.json({ success: true, data: booking });
});

/* ── Users ────────────────────────────────────────────────────────── */
router.get('/admin/users', async (req: Request, res: Response) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: role as Role } : undefined,
    select: {
      id: true, fullName: true, email: true, phoneNumber: true, role: true, bio: true,
      isKycVerified: true, isSuspended: true, createdAt: true,
      // KYC evidence — which of the three verification paths (see kyc.routes.ts)
      // a user actually went through, so an admin isn't just flipping a blind
      // boolean. aadhaarVerifiedName/digilockerStatus set = real Sandbox/DigiLocker
      // government-backed check already happened; kycDocUrl set with neither of
      // those = the legacy no-review "instant pass" upload path, worth an actual
      // look before trusting it.
      kycDocUrl: true, aadhaarVerifiedName: true, digilockerStatus: true,
      customRoleId: true, customRole: { select: { name: true } },
      _count: { select: { cars: true, bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: users.length, data: users });
});

router.patch('/admin/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isSuspended, isKycVerified, role, customRoleId, fullName, email, phoneNumber, bio } = req.body;

  if (role !== undefined && !Object.values(Role).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(isSuspended !== undefined && { isSuspended: Boolean(isSuspended) }),
        ...(isKycVerified !== undefined && { isKycVerified: Boolean(isKycVerified) }),
        ...(role !== undefined && { role }),
        ...(customRoleId !== undefined && { customRoleId: customRoleId || null }),
        ...(fullName !== undefined && { fullName }),
        ...(email !== undefined && { email }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(bio !== undefined && { bio }),
      },
      select: {
        id: true, fullName: true, email: true, phoneNumber: true, bio: true, role: true, isKycVerified: true, isSuspended: true,
        kycDocUrl: true, aadhaarVerifiedName: true, digilockerStatus: true,
        customRoleId: true, customRole: { select: { name: true } },
      },
    });
    await recordAudit(req.user!.userId, 'UPDATE_USER', 'User', id, req.body);
    res.json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `That ${err.meta?.target?.[0] ?? 'value'} is already in use by another account.` });
    }
    throw err;
  }
});

/* ── Custom Roles ("Who Can Do What" RBAC) ───────────────────────────── */
// Kept ADMIN-only even though 'roles' is one of the 9 granted permission
// keys elsewhere — granting a non-admin the power to create/edit permission
// sets (including their own) is a meaningfully different, higher-stakes
// capability than granting them read/write on a finance screen.
const PERMISSION_KEYS = ['dashboard', 'earnings', 'collections', 'expenses', 'outstandings', 'balanceSheet', 'plStatement', 'config', 'roles'];

router.get('/admin/custom-roles', async (_req: Request, res: Response) => {
  const roles = await prisma.customRole.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, count: roles.length, data: roles });
});

router.post('/admin/custom-roles', async (req: Request, res: Response) => {
  const { name, description, permissions } = req.body;
  if (!name || typeof permissions !== 'object' || permissions === null) {
    return res.status(400).json({ error: 'name and permissions are required' });
  }
  const cleaned = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, Boolean(permissions[k])]));
  try {
    const role = await prisma.customRole.create({ data: { name, description, permissions: cleaned } });
    await recordAudit(req.user!.userId, 'CREATE_CUSTOM_ROLE', 'CustomRole', role.id, req.body);
    res.status(201).json({ success: true, data: role });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A role with this name already exists' });
    throw err;
  }
});

router.patch('/admin/custom-roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (permissions !== undefined) data.permissions = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, Boolean(permissions[k])]));

  const role = await prisma.customRole.update({ where: { id }, data });
  await recordAudit(req.user!.userId, 'UPDATE_CUSTOM_ROLE', 'CustomRole', id, req.body);
  res.json({ success: true, data: role });
});

router.delete('/admin/custom-roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // Unassign before deleting rather than leaving users pointed at a dangling
  // role — they fall back to whatever their base Role enum alone grants
  // (nothing, for the internal-staff roles, until reassigned).
  await prisma.user.updateMany({ where: { customRoleId: id }, data: { customRoleId: null } });
  await prisma.customRole.delete({ where: { id } });
  await recordAudit(req.user!.userId, 'DELETE_CUSTOM_ROLE', 'CustomRole', id, {});
  res.json({ success: true });
});

/* ── Cars ─────────────────────────────────────────────────────────── */
router.get('/admin/cars', async (_req: Request, res: Response) => {
  const cars = await prisma.car.findMany({
    include: { owner: { select: { fullName: true, email: true } }, _count: { select: { bookings: true, reviews: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: cars.length, data: cars });
});

// Admin-scoped car edit — deliberately mirrors the full field set the owner-scoped
// PATCH /cars/:id supports (car.routes.ts), since that route 403s anyone whose
// userId isn't car.ownerId and admins legitimately need to correct any host's
// listing (typo fixes, mis-set category/pricing, etc). Excludes document URLs,
// onboarding step, and booking-window policy fields — those belong to the host's
// own verification/business-rule flows, not general admin correction.
router.patch('/admin/cars/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    isAvailable, featured, dailyRate, city, category,
    make, model, year, fuelType, transmission, seats,
    securityDeposit, kmIncludedPerDay, extraKmCharge,
    description, features, address,
    instantBook, offersDelivery, deliveryFee, offersPickup, pickupFee,
  } = req.body;

  const car = await prisma.car.update({
    where: { id },
    data: {
      ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
      ...(featured !== undefined && { featured: Boolean(featured) }),
      ...(dailyRate !== undefined && { dailyRate: Number(dailyRate) }),
      ...(city !== undefined && { city }),
      ...(category !== undefined && { category }),
      ...(make !== undefined && { make }),
      ...(model !== undefined && { model }),
      ...(year !== undefined && { year: Number(year) }),
      ...(fuelType !== undefined && { fuelType }),
      ...(transmission !== undefined && { transmission }),
      ...(seats !== undefined && { seats: Number(seats) }),
      ...(securityDeposit !== undefined && { securityDeposit: Number(securityDeposit) }),
      ...(kmIncludedPerDay !== undefined && { kmIncludedPerDay: Number(kmIncludedPerDay) }),
      ...(extraKmCharge !== undefined && { extraKmCharge: Number(extraKmCharge) }),
      ...(description !== undefined && { description }),
      ...(features !== undefined && { features }),
      ...(address !== undefined && { address }),
      ...(instantBook !== undefined && { instantBook: Boolean(instantBook) }),
      ...(offersDelivery !== undefined && { offersDelivery: Boolean(offersDelivery) }),
      ...(deliveryFee !== undefined && { deliveryFee: Number(deliveryFee) }),
      ...(offersPickup !== undefined && { offersPickup: Boolean(offersPickup) }),
      ...(pickupFee !== undefined && { pickupFee: Number(pickupFee) }),
    },
  });
  await recordAudit(req.user!.userId, 'UPDATE_CAR', 'Car', id, req.body);
  res.json({ success: true, data: car });
});

// Manual document review — car.routes.ts auto-marks VERIFIED the moment a
// host has all three docs on file (self-attested, no review gate), which is
// enough to unblock listing but not a substitute for someone actually looking
// at the RC/insurance/PUC. This lets an admin override that to REJECTED (with
// a reason the host sees) or confirm it back to VERIFIED after review.
router.patch('/admin/cars/:id/verification', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verificationStatus, reason } = req.body;
  if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(verificationStatus)) {
    return res.status(400).json({ error: 'verificationStatus must be PENDING, VERIFIED, or REJECTED' });
  }
  if (verificationStatus === 'REJECTED' && !String(reason ?? '').trim()) {
    return res.status(400).json({ error: 'A reason is required when rejecting documents' });
  }

  const car = await prisma.car.update({ where: { id }, data: { verificationStatus } });
  await recordAudit(req.user!.userId, 'UPDATE_CAR_VERIFICATION', 'Car', id, { verificationStatus, reason });

  await notify(
    car.ownerId,
    'GENERIC',
    verificationStatus === 'VERIFIED' ? 'Your vehicle documents were approved' : verificationStatus === 'REJECTED' ? 'Your vehicle documents were rejected' : 'Your vehicle documents are pending review',
    verificationStatus === 'REJECTED' ? `Reason: ${reason}. Please re-upload corrected documents from your listing.` : verificationStatus === 'VERIFIED' ? 'Your RC, insurance, and pollution certificate have been verified.' : 'Your vehicle documents are back under review.',
    '/host/dashboard'
  );

  res.json({ success: true, data: car });
});

/* ── Reviews ──────────────────────────────────────────────────────── */
router.get('/admin/reviews', async (_req: Request, res: Response) => {
  const reviews = await prisma.review.findMany({
    include: {
      author: { select: { fullName: true } },
      car: { select: { make: true, model: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: reviews.length, data: reviews });
});

// Soft-moderation: hides the review from all public listings (car detail,
// search rating aggregation, host profile, AI review-summary) without
// destroying it — preferred over delete for a disputed/reported review so
// there's still a record if it's contested later. Delete remains for
// genuinely bogus/spam reviews that don't need to be kept around.
router.patch('/admin/reviews/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { hidden } = req.body;
  if (typeof hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be a boolean' });
  const review = await prisma.review.update({ where: { id }, data: { hidden } });
  await recordAudit(req.user!.userId, hidden ? 'HIDE_REVIEW' : 'UNHIDE_REVIEW', 'Review', id);
  res.json({ success: true, data: review });
});

router.delete('/admin/reviews/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.review.delete({ where: { id } });
  await recordAudit(req.user!.userId, 'DELETE_REVIEW', 'Review', id);
  res.json({ success: true });
});

/* ── Service Requests (Agent jobs) ────────────────────────────────── */
// Edit + reassignment, separate from the agent's own PATCH
// /agent/service-requests/:id (agent.routes.ts) which only ever touches
// status. Correcting a job's price/date/location/notes or moving it to a
// different agent is a dispatcher decision, not something an agent does to
// their own assignment.
router.patch('/admin/service-requests/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { priceEstimate, scheduledDate, serviceLocation, notes, assignedAgentId } = req.body;

  if (assignedAgentId) {
    const agent = await prisma.user.findUnique({ where: { id: assignedAgentId } });
    if (!agent || agent.role !== 'AGENT') return res.status(400).json({ error: 'assignedAgentId must be an existing user with the AGENT role' });
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      ...(priceEstimate !== undefined && { priceEstimate: Number(priceEstimate) }),
      ...(scheduledDate !== undefined && { scheduledDate: new Date(scheduledDate) }),
      ...(serviceLocation !== undefined && { serviceLocation }),
      ...(notes !== undefined && { notes }),
      ...(assignedAgentId !== undefined && { assignedAgentId: assignedAgentId || null }),
    },
  });
  await recordAudit(req.user!.userId, 'UPDATE_SERVICE_REQUEST', 'ServiceRequest', id, req.body);
  res.json({ success: true, data: updated });
});

/* ── Payouts ──────────────────────────────────────────────────────── */
router.get('/admin/payouts', async (req: Request, res: Response) => {
  const { status } = req.query;
  const payouts = await prisma.payoutLedger.findMany({
    where: status ? { status: status as PayoutStatus } : undefined,
    include: { host: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ success: true, count: payouts.length, data: payouts });
});

router.post('/admin/payouts/:id/retry', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await PayoutEngine.retryPayout(id);
    await recordAudit(req.user!.userId, 'RETRY_PAYOUT', 'PayoutLedger', id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/* ── Audit log ────────────────────────────────────────────────────── */
router.get('/admin/audit-log', async (_req: Request, res: Response) => {
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  res.json({ success: true, count: entries.length, data: entries });
});

export default router;
