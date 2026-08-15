import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/users/me/notifications', requireAuth, async (req: Request, res: Response) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: req.user!.userId, read: false } }),
  ]);
  res.json({ success: true, count: notifications.length, unreadCount, data: notifications });
});

router.post('/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  if (notification.userId !== req.user!.userId) return res.status(403).json({ error: 'Not your notification' });

  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ success: true, data: updated });
});

router.post('/notifications/read-all', requireAuth, async (req: Request, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.userId, read: false }, data: { read: true } });
  res.json({ success: true });
});

export default router;
