"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const paymentGateway_1 = __importDefault(require("../services/paymentGateway"));
const payoutEngine_1 = require("../services/payoutEngine");
const telematicsService_1 = require("../services/telematicsService");
const auth_1 = require("../middleware/auth");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const VALID_PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];
// Create a booking (no payment yet — the checkout page starts a PayU session separately)
router.post('/booking', auth_1.requireAuth, async (req, res) => {
    const { carId, startTime, endTime, totalAmount, protectionPlan, deliveryRequested, promoCode } = req.body;
    const customerId = req.user.userId;
    if (!carId || !startTime || !endTime || !totalAmount) {
        return res.status(400).json({ error: 'carId, startTime, endTime, and totalAmount are required' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
        return res.status(400).json({ error: 'endTime must be after startTime' });
    }
    try {
        const car = await prisma.car.findUnique({ where: { id: carId }, include: { owner: true } });
        if (!car)
            return res.status(404).json({ error: 'Car not found' });
        if (!car.isAvailable)
            return res.status(409).json({ error: 'Car is no longer available' });
        if (!car.owner.payoutAccountId) {
            return res.status(422).json({ error: 'Host payout account not configured' });
        }
        if (deliveryRequested && !car.offersDelivery) {
            return res.status(400).json({ error: 'This host does not offer delivery' });
        }
        // Reject overlapping bookings for the same car. PENDING_PAYMENT counts as
        // holding the slot (prevents a race where two renters both start checkout
        // for the same dates) — in production these should also auto-expire after
        // a short window so an abandoned checkout doesn't permanently lock dates.
        const conflictingBooking = await prisma.booking.findFirst({
            where: {
                carId,
                status: { notIn: [client_1.BookingStatus.CANCELLED] },
                startTime: { lt: end },
                endTime: { gt: start },
            },
        });
        if (conflictingBooking) {
            return res.status(409).json({ error: 'This car is already booked for part of the selected dates' });
        }
        const conflictingBlackout = await prisma.blackout.findFirst({
            where: { carId, startDate: { lt: end }, endDate: { gt: start } },
        });
        if (conflictingBlackout) {
            return res.status(409).json({ error: 'The host has blocked out part of the selected dates' });
        }
        let normalizedPromo = null;
        if (promoCode) {
            const promo = await prisma.promoCode.findUnique({ where: { code: String(promoCode).toUpperCase() } });
            if (!promo || !promo.active || (promo.expiresAt && promo.expiresAt < new Date()) || (promo.maxUses !== null && promo.usedCount >= promo.maxUses)) {
                return res.status(400).json({ error: 'Promo code is no longer valid' });
            }
            normalizedPromo = promo.code;
        }
        const { platformFee, hostPayout } = await payoutEngine_1.PayoutEngine.splitAmount(totalAmount);
        const booking = await prisma.booking.create({
            data: {
                id: (0, uuid_1.v4)(),
                carId,
                customerId,
                startTime: start,
                endTime: end,
                totalAmount,
                platformFee,
                hostPayoutAmount: hostPayout,
                protectionPlan: VALID_PLANS.includes(protectionPlan) ? protectionPlan : 'BASIC',
                deliveryRequested: Boolean(deliveryRequested),
                promoCode: normalizedPromo,
                status: client_1.BookingStatus.PENDING_PAYMENT,
            },
        });
        res.status(201).json({ success: true, bookingId: booking.id });
    }
    catch (error) {
        res.status(500).json({ error: `Booking failed: ${error.message}` });
    }
});
// Starts (or restarts) a PayU Hosted Checkout session for a pending booking.
// The checkout page POSTs the returned {url, fields} straight to PayU — real
// confirmation only ever happens via the hash-verified callback in
// payuCallback.routes.ts, never from this endpoint.
router.post('/booking/:id/checkout-session', auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true, customer: true } });
    if (!booking)
        return res.status(404).json({ error: 'Booking not found' });
    if (booking.customerId !== req.user.userId)
        return res.status(403).json({ error: 'Not your booking' });
    if (booking.status !== client_1.BookingStatus.PENDING_PAYMENT) {
        return res.status(400).json({ error: `Cannot start checkout from status ${booking.status}` });
    }
    try {
        const checkout = await paymentGateway_1.default.initiateCheckout({
            bookingId: booking.id,
            amount: booking.totalAmount,
            customerName: booking.customer.fullName,
            customerEmail: booking.customer.email,
            productInfo: `${booking.car.make} ${booking.car.model} — ${booking.car.city}`,
        });
        await prisma.booking.update({ where: { id }, data: { paymentIntentId: checkout.txnid } });
        res.json({ success: true, data: { url: checkout.checkoutUrl, fields: checkout.fields } });
    }
    catch (error) {
        res.status(502).json({ error: `Could not start payment: ${error.message}` });
    }
});
// Start a confirmed trip (pickup)
router.post('/booking/:id/start', auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
    if (!booking)
        return res.status(404).json({ error: 'Booking not found' });
    if (booking.customerId !== req.user.userId)
        return res.status(403).json({ error: 'Not your booking' });
    if (booking.status !== client_1.BookingStatus.CONFIRMED) {
        return res.status(400).json({ error: `Cannot start trip from status ${booking.status}` });
    }
    const updated = await prisma.booking.update({ where: { id }, data: { status: client_1.BookingStatus.ACTIVE } });
    await (0, notificationService_1.notify)(booking.car.ownerId, 'TRIP_STARTED', 'Trip started', `A renter has picked up your ${booking.car.make} ${booking.car.model}.`, '/host/dashboard');
    res.json({ success: true, data: updated });
});
// Mark a trip completed -> release N+1 payout escrow
router.post('/booking/:id/complete', auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
        if (!existing)
            return res.status(404).json({ error: 'Booking not found' });
        const isCustomer = existing.customerId === req.user.userId;
        const isHost = existing.car.ownerId === req.user.userId;
        if (!isCustomer && !isHost)
            return res.status(403).json({ error: 'Not part of this booking' });
        if (existing.status !== client_1.BookingStatus.ACTIVE) {
            return res.status(400).json({ error: `Cannot complete trip from status ${existing.status}` });
        }
        const booking = await prisma.booking.update({
            where: { id },
            data: { status: client_1.BookingStatus.COMPLETED },
        });
        await payoutEngine_1.PayoutEngine.createEscrowLedger(booking.id);
        res.json({ success: true, message: 'Trip completed. N+1 payout scheduled.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Remote keyless unlock for an active booking
router.post('/booking/:id/unlock', auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
    if (!booking || booking.status !== client_1.BookingStatus.ACTIVE) {
        return res.status(400).json({ error: 'Booking is not active' });
    }
    if (booking.customerId !== req.user.userId)
        return res.status(403).json({ error: 'Not your booking' });
    if (!booking.car.telematicsImei) {
        return res.status(400).json({ error: 'Vehicle has no keyless IoT hardware' });
    }
    try {
        const success = await telematicsService_1.TelematicsService.unlockVehicle(booking.car.telematicsImei, req.user.userId);
        res.json({ success, message: success ? 'Vehicle unlocked' : 'Unlock failed' });
    }
    catch (error) {
        res.status(502).json({ error: error.message ?? 'Hardware command failed' });
    }
});
exports.default = router;
//# sourceMappingURL=booking.routes.js.map