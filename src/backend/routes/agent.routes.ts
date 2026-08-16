import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

router.use('/agent', requireAuth, requireRole('AGENT', 'ADMIN'));

// An admin previewing the portal sees everyone's queue; an agent sees only their own.
function assignedFilter(req: Request) {
  return req.user!.role === 'ADMIN' ? {} : { assignedAgentId: req.user!.userId };
}

router.get('/agent/service-requests', async (req: Request, res: Response) => {
  const requests = await prisma.serviceRequest.findMany({
    where: assignedFilter(req),
    include: {
      car: { select: { make: true, model: true, registrationNo: true, city: true, images: true } },
      requestedBy: { select: { fullName: true, phoneNumber: true } },
      booking: { select: { id: true, startTime: true, endTime: true } },
    },
    orderBy: { scheduledDate: 'desc' },
  });
  res.json({ success: true, count: requests.length, data: requests });
});

router.patch('/agent/service-requests/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service request not found' });
  if (req.user!.role !== 'ADMIN' && existing.assignedAgentId !== req.user!.userId) {
    return res.status(403).json({ error: 'Not assigned to you' });
  }

  const updated = await prisma.serviceRequest.update({ where: { id }, data: { status } });
  if (status === 'COMPLETED') {
    await notify(existing.requestedById, 'GENERIC', 'Wash service completed', `Your ${existing.serviceType.toLowerCase()} service is done.`, '/bookings');
  }
  res.json({ success: true, data: updated });
});

export default router;
