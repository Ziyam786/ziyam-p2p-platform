import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { FleetService } from '../services/fleetService';

const router = Router();
const prisma = new PrismaClient();

// Register as a self-host or fleet operator
router.post('/host/register', async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, role } = req.body;
  const validRoles = [Role.SELF_HOST, Role.FLEET_OPERATOR];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'role must be SELF_HOST or FLEET_OPERATOR' });
  }

  const host = await prisma.user.create({
    data: { id: uuidv4(), fullName, email, phoneNumber, role, isKycVerified: false },
  });
  res.status(201).json({ success: true, data: host });
});

// List a car under a host/fleet operator
router.post('/host/:hostId/cars', async (req: Request, res: Response) => {
  const { hostId } = req.params;
  const { make, model, registrationNo, year, fuelType, transmission, dailyRate, city, telematicsImei } = req.body;

  const host = await prisma.user.findUnique({ where: { id: hostId } });
  if (!host) return res.status(404).json({ error: 'Host not found' });
  if (!host.isKycVerified) return res.status(403).json({ error: 'Host KYC not verified' });

  const car = await prisma.car.create({
    data: {
      id: uuidv4(),
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
router.get('/host/:hostId/earnings', async (req: Request, res: Response) => {
  const { hostId } = req.params;
  const overview = await FleetService.getEarningsOverview(hostId);
  res.json({ success: true, data: overview });
});

// Fleet utilization data
router.get('/host/:hostId/utilization', async (req: Request, res: Response) => {
  const { hostId } = req.params;
  const utilization = await FleetService.getFleetUtilization(hostId);
  res.json({ success: true, data: utilization });
});

export default router;
