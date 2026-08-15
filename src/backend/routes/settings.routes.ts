import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { recordAudit } from '../middleware/auditLog';
import { getAllSettings, getPublicSettings, setSetting } from '../services/settingsService';

const router = Router();

// Renter-site-safe subset — no auth required.
router.get('/settings/public', async (_req: Request, res: Response) => {
  const data = await getPublicSettings();
  res.json({ success: true, data });
});

router.get('/admin/settings', requireAuth, requireRole(Role.ADMIN), async (_req: Request, res: Response) => {
  const data = await getAllSettings();
  res.json({ success: true, data });
});

router.put('/admin/settings/:key', requireAuth, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });

  const updated = await setSetting(key, value);
  await recordAudit(req.user!.userId, 'UPDATE_SETTING', 'Setting', key, { value });
  res.json({ success: true, data: updated });
});

export default router;
