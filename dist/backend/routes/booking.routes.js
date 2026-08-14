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
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Search available cars by city
router.get('/cars/search', async (req, res) => {
    const { city } = req.query;
    const cars = await prisma.car.findMany({
        where: { city: String(city ?? ''), isAvailable: true },
        include: { owner: { select: { fullName: true, role: true } } },
    });
    res.json({ success: true, count: cars.length, data: cars });
});
// Create a booking + split payment intent
router.post('/booking', async (req, res) => {
    const { customerId, carId, startTime, endTime, totalAmount } = req.body;
    try {
        const car = await prisma.car.findUnique({ where: { id: carId }, include: { owner: true } });
        if (!car)
            return res.status(404).json({ error: 'Car not found' });
        if (!car.isAvailable)
            return res.status(409).json({ error: 'Car is no longer available' });
        if (!car.owner.payoutAccountId) {
            return res.status(422).json({ error: 'Host payout account not configured' });
        }
        const { platformFee, hostPayout } = payoutEngine_1.PayoutEngine.splitAmount(totalAmount);
        const paymentIntent = await paymentGateway_1.default.createSplitPayment({
            amount: totalAmount,
            currency: 'INR',
            destinationAccountId: car.owner.payoutAccountId,
            platformFeeAmount: platformFee,
            metadata: { carId, customerId },
        });
        const booking = await prisma.booking.create({
            data: {
                id: (0, uuid_1.v4)(),
                carId,
                customerId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                totalAmount,
                platformFee,
                hostPayoutAmount: hostPayout,
                paymentIntentId: paymentIntent.id,
                status: client_1.BookingStatus.PENDING_PAYMENT,
            },
        });
        res.status(201).json({ success: true, clientSecret: paymentIntent.clientSecret, bookingId: booking.id });
    }
    catch (error) {
        res.status(500).json({ error: `Booking failed: ${error.message}` });
    }
});
// Mark a trip completed -> release N+1 payout escrow
router.post('/booking/:id/complete', async (req, res) => {
    const { id } = req.params;
    try {
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
router.post('/booking/:id/unlock', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
    if (!booking || booking.status !== client_1.BookingStatus.ACTIVE) {
        return res.status(400).json({ error: 'Booking is not active' });
    }
    if (!booking.car.telematicsImei) {
        return res.status(400).json({ error: 'Vehicle has no keyless IoT hardware' });
    }
    const success = await telematicsService_1.TelematicsService.unlockVehicle(booking.car.telematicsImei, userId);
    res.json({ success, message: success ? 'Vehicle unlocked' : 'Unlock failed' });
});
exports.default = router;
//# sourceMappingURL=booking.routes.js.map