import { Router, Request, Response } from 'express';
import { PrismaClient, RefundRequestStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Money owed back to a guest (deposit release / partial release today —
// see damageClaim.routes.ts and the depositReleaseCron in payoutEngine.ts).
// No live PayU refund API integration yet — an admin processes the actual
// refund manually in the PayU merchant portal, then marks it complete here.
router.get('/admin/refund-requests', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { status } = req.query;
  const requests = await prisma.refundRequest.findMany({
    where: status ? { status: status as RefundRequestStatus } : undefined,
    include: {
      booking: { include: { car: true, customer: { select: { id: true, fullName: true, email: true, phoneNumber: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: requests.length, data: requests });
});

router.patch('/admin/refund-requests/:id/complete', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.refundRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Refund request not found' });
  if (existing.status === RefundRequestStatus.COMPLETED) return res.status(400).json({ error: 'Already marked complete' });

  const request = await prisma.refundRequest.update({
    where: { id },
    data: { status: RefundRequestStatus.COMPLETED, completedByAdminId: req.user!.userId, completedAt: new Date() },
  });
  res.json({ success: true, data: request });
});

export default router;
