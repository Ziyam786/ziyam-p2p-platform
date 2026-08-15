import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { sandboxService } from '../services/sandboxService';

const router = Router();
const prisma = new PrismaClient();

/**
 * Step 1: send an Aadhaar OTP via Sandbox's eKYC API. Falls back to the old
 * "instant pass" stub (see kyc.routes.ts history) if SANDBOX_API_KEY/SECRET
 * aren't set, same "stub the unavailable external service" pattern used by
 * paymentGateway.ts / telematicsService.ts.
 */
router.post('/kyc/aadhaar/otp', requireAuth, async (req: Request, res: Response) => {
  const { aadhaarNumber } = req.body;
  if (!/^[0-9]{12}$/.test(aadhaarNumber ?? '')) {
    return res.status(400).json({ error: 'aadhaarNumber must be exactly 12 digits' });
  }

  if (!sandboxService.isConfigured()) {
    return res.json({ success: true, stubbed: true, message: 'KYC provider not configured — using instant verification instead.' });
  }

  try {
    const result = await sandboxService.generateAadhaarOtp(aadhaarNumber, 'Ziyam host/renter identity verification');
    res.json({ success: true, stubbed: false, referenceId: result.referenceId, message: result.message });
  } catch (err: any) {
    console.error('[KYC] Aadhaar OTP generate failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not send Aadhaar OTP right now. Please try again shortly.' });
  }
});

/**
 * Step 2: verify the OTP. If Sandbox isn't configured, this is called with no
 * referenceId and just performs the old instant-pass behavior.
 */
router.post('/kyc/aadhaar/verify', requireAuth, async (req: Request, res: Response) => {
  const { referenceId, otp } = req.body;

  let verifiedName: string | undefined;

  if (sandboxService.isConfigured()) {
    if (!referenceId || !/^[0-9]{6}$/.test(otp ?? '')) {
      return res.status(400).json({ error: 'referenceId and a 6-digit otp are required' });
    }
    try {
      const result = await sandboxService.verifyAadhaarOtp(referenceId, otp);
      verifiedName = result.name;
    } catch (err: any) {
      console.error('[KYC] Aadhaar OTP verify failed:', err.response?.data ?? err.message);
      return res.status(422).json({ error: 'Aadhaar verification failed — check the OTP and try again.' });
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { isKycVerified: true, ...(verifiedName && { aadhaarVerifiedName: verifiedName }) },
    select: { id: true, isKycVerified: true, aadhaarVerifiedName: true },
  });

  await notify(user.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed. You can now book or list cars.', '/account');

  res.json({ success: true, message: 'KYC verified', data: user });
});

/** Legacy single-step submit (kept for the .env-less / doc-URL fallback path). */
router.post('/kyc/submit', requireAuth, async (req: Request, res: Response) => {
  const { docUrl } = req.body;
  if (!docUrl) return res.status(400).json({ error: 'docUrl is required (driving licence / Aadhaar document)' });

  if (config.nodeEnv === 'production' && !config.kyc.apiKey && !sandboxService.isConfigured()) {
    return res.status(503).json({ error: 'No KYC provider is configured' });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { isKycVerified: true, kycDocUrl: docUrl },
    select: { id: true, isKycVerified: true, kycDocUrl: true },
  });

  await notify(user.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed. You can now book or list cars.', '/account');

  res.json({ success: true, message: 'KYC verified instantly', data: user });
});

export default router;
