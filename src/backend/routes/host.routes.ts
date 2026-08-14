import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { FleetService } from '../services/fleetService';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/** Only the host themself or an admin may act on a given hostId. */
function assertOwnerOrAdmin(req: AuthenticatedRequest, res: Response, hostId: string): boolean {
  if (req.user!.sub !== hostId && req.user!.role !== Role.ADMIN) {
    res.status(403).json({ error: 'You may only manage your own host account' });
    return false;
  }
  return true;
}

// List a car under a host/fleet operator
router.post(
  '/host/:hostId/cars',
  requireAuth,
  requireRole(Role.SELF_HOST, Role.FLEET_OPERATOR, Role.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    const { hostId } = req.params;
    if (!assertOwnerOrAdmin(req, res, hostId)) return;

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
  }
);

// Fleet earnings dashboard data
router.get(
  '/host/:hostId/earnings',
  requireAuth,
  requireRole(Role.SELF_HOST, Role.FLEET_OPERATOR, Role.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    const { hostId } = req.params;
    if (!assertOwnerOrAdmin(req, res, hostId)) return;
    const overview = await FleetService.getEarningsOverview(hostId);
    res.json({ success: true, data: overview });
  }
);

// Fleet utilization data
router.get(
  '/host/:hostId/utilization',
  requireAuth,
  requireRole(Role.SELF_HOST, Role.FLEET_OPERATOR, Role.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    const { hostId } = req.params;
    if (!assertOwnerOrAdmin(req, res, hostId)) return;
    const utilization = await FleetService.getFleetUtilization(hostId);
    res.json({ success: true, data: utilization });
  }
);

export default router;
