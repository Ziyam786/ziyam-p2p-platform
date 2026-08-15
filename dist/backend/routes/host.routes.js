"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const fleetService_1 = require("../services/fleetService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
function assertSelfOrAdmin(req, hostId) {
    return req.user.userId === hostId || req.user.role === 'ADMIN';
}
// List a car under a host/fleet operator
router.post('/host/:hostId/cars', auth_1.requireAuth, async (req, res) => {
    const { hostId } = req.params;
    if (!assertSelfOrAdmin(req, hostId))
        return res.status(403).json({ error: 'Not your host account' });
    const { make, model, registrationNo, year, category, fuelType, transmission, seats, dailyRate, securityDeposit, kmIncludedPerDay, extraKmCharge, description, images, features, city, telematicsImei, instantBook, offersDelivery, deliveryFee, } = req.body;
    const host = await prisma.user.findUnique({ where: { id: hostId } });
    if (!host)
        return res.status(404).json({ error: 'Host not found' });
    if (!host.isKycVerified)
        return res.status(403).json({ error: 'Host KYC not verified' });
    if (!make || !model || !registrationNo || !year || !dailyRate || !city) {
        return res.status(400).json({ error: 'make, model, registrationNo, year, dailyRate, and city are required' });
    }
    const car = await prisma.car.create({
        data: {
            id: (0, uuid_1.v4)(),
            ownerId: hostId,
            make,
            model,
            registrationNo,
            year: Number(year),
            category: category ?? 'Hatchback',
            fuelType: fuelType ?? 'Petrol',
            transmission: transmission ?? 'Manual',
            seats: seats ? Number(seats) : 5,
            dailyRate: Number(dailyRate),
            ...(securityDeposit !== undefined && { securityDeposit: Number(securityDeposit) }),
            ...(kmIncludedPerDay !== undefined && { kmIncludedPerDay: Number(kmIncludedPerDay) }),
            ...(extraKmCharge !== undefined && { extraKmCharge: Number(extraKmCharge) }),
            description,
            images: images ?? [],
            features: features ?? [],
            city,
            telematicsImei,
            ...(instantBook !== undefined && { instantBook: Boolean(instantBook) }),
            ...(offersDelivery !== undefined && { offersDelivery: Boolean(offersDelivery) }),
            ...(deliveryFee !== undefined && { deliveryFee: Number(deliveryFee) }),
        },
    });
    res.status(201).json({ success: true, data: car });
});
// A host's own fleet (including delisted cars)
router.get('/host/:hostId/cars', auth_1.requireAuth, async (req, res) => {
    const { hostId } = req.params;
    if (!assertSelfOrAdmin(req, hostId))
        return res.status(403).json({ error: 'Not your host account' });
    const cars = await prisma.car.findMany({
        where: { ownerId: hostId },
        include: { reviews: { select: { rating: true } }, _count: { select: { bookings: true } } },
        orderBy: { createdAt: 'desc' },
    });
    const data = cars.map((c) => {
        const { reviews, ...rest } = c;
        const reviewCount = reviews.length;
        const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(1));
        return { ...rest, rating, reviewCount };
    });
    res.json({ success: true, count: data.length, data });
});
// Fleet earnings dashboard data
router.get('/host/:hostId/earnings', auth_1.requireAuth, async (req, res) => {
    const { hostId } = req.params;
    if (!assertSelfOrAdmin(req, hostId))
        return res.status(403).json({ error: 'Not your host account' });
    const overview = await fleetService_1.FleetService.getEarningsOverview(hostId);
    res.json({ success: true, data: overview });
});
// Fleet utilization data
router.get('/host/:hostId/utilization', auth_1.requireAuth, async (req, res) => {
    const { hostId } = req.params;
    if (!assertSelfOrAdmin(req, hostId))
        return res.status(403).json({ error: 'Not your host account' });
    const utilization = await fleetService_1.FleetService.getFleetUtilization(hostId);
    res.json({ success: true, data: utilization });
});
/* ── Blackout dates (host-blocked availability) ──────────────────── */
async function assertOwnsCar(req, carId) {
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car)
        return { ok: false, status: 404, error: 'Car not found' };
    if (car.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
        return { ok: false, status: 403, error: 'Not your listing' };
    }
    return { ok: true, car };
}
router.get('/cars/:carId/blackouts', auth_1.requireAuth, async (req, res) => {
    const check = await assertOwnsCar(req, req.params.carId);
    if (!check.ok)
        return res.status(check.status).json({ error: check.error });
    const blackouts = await prisma.blackout.findMany({
        where: { carId: req.params.carId },
        orderBy: { startDate: 'asc' },
    });
    res.json({ success: true, count: blackouts.length, data: blackouts });
});
router.post('/cars/:carId/blackouts', auth_1.requireAuth, async (req, res) => {
    const check = await assertOwnsCar(req, req.params.carId);
    if (!check.ok)
        return res.status(check.status).json({ error: check.error });
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate)
        return res.status(400).json({ error: 'startDate and endDate are required' });
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start)
        return res.status(400).json({ error: 'endDate must be after startDate' });
    const blackout = await prisma.blackout.create({
        data: { id: (0, uuid_1.v4)(), carId: req.params.carId, startDate: start, endDate: end, reason },
    });
    res.status(201).json({ success: true, data: blackout });
});
router.delete('/blackouts/:id', auth_1.requireAuth, async (req, res) => {
    const blackout = await prisma.blackout.findUnique({ where: { id: req.params.id } });
    if (!blackout)
        return res.status(404).json({ error: 'Blackout not found' });
    const check = await assertOwnsCar(req, blackout.carId);
    if (!check.ok)
        return res.status(check.status).json({ error: check.error });
    await prisma.blackout.delete({ where: { id: req.params.id } });
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=host.routes.js.map