import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

/**
 * Stub for the DigiLocker / Aadhaar-XML KYC provider (see config.kyc).
 * Wire this up to the real provider's SDK before going live; until then it
 * simulates an "instant" verification the way DigiLocker's flow behaves.
 */
router.post('/kyc/submit', requireAuth, async (req: Request, res: Response) => {
  const { docUrl } = req.body;
  if (!docUrl) return res.status(400).json({ error: 'docUrl is required (driving licence / Aadhaar document)' });

  if (config.nodeEnv === 'production' && !config.kyc.apiKey) {
    return res.status(503).json({ error: `${config.kyc.provider} API key is not configured` });
  }

  // TODO: replace with a real provider call, e.g.:
  // const result = await digilocker.verifyDocument({ docUrl, apiKey: config.kyc.apiKey });
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { isKycVerified: true, kycDocUrl: docUrl },
    select: { id: true, isKycVerified: true, kycDocUrl: true },
  });

  await notify(user.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed. You can now book or list cars.', '/account');

  res.json({ success: true, message: 'KYC verified instantly via ' + config.kyc.provider, data: user });
});

export default router;
