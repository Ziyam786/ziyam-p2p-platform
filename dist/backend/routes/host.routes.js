"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const fleetService_1 = require("../services/fleetService");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Register as a self-host or fleet operator
router.post('/host/register', async (req, res) => {
    const { fullName, email, phoneNumber, role } = req.body;
    const validRoles = [client_1.Role.SELF_HOST, client_1.Role.FLEET_OPERATOR];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'role must be SELF_HOST or FLEET_OPERATOR' });
    }
    const host = await prisma.user.create({
        data: { id: (0, uuid_1.v4)(), fullName, email, phoneNumber, role, isKycVerified: false },
    });
    res.status(201).json({ success: true, data: host });
});
// List a car under a host/fleet operator
router.post('/host/:hostId/cars', async (req, res) => {
    const { hostId } = req.params;
    const { make, model, registrationNo, year, fuelType, transmission, dailyRate, city, telematicsImei } = req.body;
    const host = await prisma.user.findUnique({ where: { id: hostId } });
    if (!host)
        return res.status(404).json({ error: 'Host not found' });
    if (!host.isKycVerified)
        return res.status(403).json({ error: 'Host KYC not verified' });
    const car = await prisma.car.create({
        data: {
            id: (0, uuid_1.v4)(),
            ownerId: hostId,
            make,
            model,
            registrationNo,
            year,
            fuelType,
            transmission,
            dailyRate,
            city,
            telematicsImei,
        },
    });
    res.status(201).json({ success: true, data: car });
});
// Fleet earnings dashboard data
router.get('/host/:hostId/earnings', async (req, res) => {
    const { hostId } = req.params;
    const overview = await fleetService_1.FleetService.getEarningsOverview(hostId);
    res.json({ success: true, data: overview });
});
// Fleet utilization data
router.get('/host/:hostId/utilization', async (req, res) => {
    const { hostId } = req.params;
    const utilization = await fleetService_1.FleetService.getFleetUtilization(hostId);
    res.json({ success: true, data: utilization });
});
exports.default = router;
//# sourceMappingURL=host.routes.js.map