import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { recordAudit } from '../middleware/auditLog';

const router = Router();
const prisma = new PrismaClient();

function computeDiscount(promo: { discountPercent: number | null; discountFlat: number | null }, subtotal: number) {
  if (promo.discountPercent) return Number((subtotal * promo.discountPercent).toFixed(2));
  if (promo.discountFlat) return Math.min(promo.discountFlat, subtotal);
  return 0;
}

// Renter-facing: check a code is valid and see the discount before paying.
router.post('/promo-codes/validate', async (req: Request, res: Response) => {
  const { code, subtotal } = req.body;
  if (!code || subtotal === undefined) return res.status(400).json({ error: 'code and subtotal are required' });

  const promo = await prisma.promoCode.findUnique({ where: { code: String(code).toUpperCase() } });
  if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
  if (!promo.active) return res.status(400).json({ error: 'This promo code is no longer active' });
  if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ error: 'This promo code has expired' });
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return res.status(400).json({ error: 'This promo code has reached its usage limit' });
  }

  const discount = computeDiscount(promo, Number(subtotal));
  res.json({ success: true, data: { code: promo.code, discount } });
});

router.get('/admin/promo-codes', requireAuth, requireRole(Role.ADMIN), async (_req: Request, res: Response) => {
  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, count: codes.length, data: codes });
});

router.post('/admin/promo-codes', requireAuth, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const { code, discountPercent, discountFlat, maxUses, expiresAt } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  if (!discountPercent && !discountFlat) return res.status(400).json({ error: 'Provide either discountPercent or discountFlat' });

  const promo = await prisma.promoCode.create({
    data: {
      code: String(code).toUpperCase(),
      discountPercent: discountPercent ? Number(discountPercent) : null,
      discountFlat: discountFlat ? Number(discountFlat) : null,
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  await recordAudit(req.user!.userId, 'CREATE_PROMO_CODE', 'PromoCode', promo.code, req.body);
  res.status(201).json({ success: true, data: promo });
});

router.patch('/admin/promo-codes/:code', requireAuth, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const { code } = req.params;
  const { active } = req.body;
  const promo = await prisma.promoCode.update({
    where: { code: code.toUpperCase() },
    data: { ...(active !== undefined && { active: Boolean(active) }) },
  });
  await recordAudit(req.user!.userId, 'UPDATE_PROMO_CODE', 'PromoCode', code, req.body);
  res.json({ success: true, data: promo });
});

router.delete('/admin/promo-codes/:code', requireAuth, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const { code } = req.params;
  await prisma.promoCode.delete({ where: { code: code.toUpperCase() } });
  await recordAudit(req.user!.userId, 'DELETE_PROMO_CODE', 'PromoCode', code);
  res.json({ success: true });
});

export default router;
