import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notificationService';
import { sandboxService } from '../services/sandboxService';
import { digilockerApi, isSetuConfigured } from '../services/setuService';
import {
  isKycExtractionConfigured, extractKycDocument, pickExtractedName, assertReadableDocument,
  isLivenessConfigured, checkLiveness,
  isDeepfakeConfigured, checkDeepfake,
  isFaceMatchConfigured, verifyFaceMatch,
  fetchDocAsBase64,
  isAadhaarMaskConfigured, maskAadhaarDocument, maskedAadhaarBuffer, isLikelyAadhaarKyc,
  type AryaKycResult,
} from '../services/aryaVerificationService';
import { saveFile } from './upload.routes';

const router = Router();
const prisma = new PrismaClient();

async function runSelfieChecks(selfieBase64: string, matchAgainstBase64?: string) {
  const checks: Record<string, unknown> = {};
  let allConfiguredChecksPassed = true;
  let anyConfigured = false;

  if (isLivenessConfigured()) {
    anyConfigured = true;
    const liveness = await checkLiveness(selfieBase64);
    checks.liveness = liveness;
    if (!liveness.success) allConfiguredChecksPassed = false;
  }
  if (isDeepfakeConfigured()) {
    anyConfigured = true;
    const deepfake = await checkDeepfake(selfieBase64);
    checks.deepfake = deepfake;
    const flagged = !deepfake.success || /fake/i.test(deepfake.result ?? '');
    if (flagged) allConfiguredChecksPassed = false;
  }
  if (matchAgainstBase64 && isFaceMatchConfigured()) {
    anyConfigured = true;
    const faceMatch = await verifyFaceMatch(selfieBase64, matchAgainstBase64);
    checks.faceMatch = faceMatch;
    if (!faceMatch.success || !faceMatch.match) allConfiguredChecksPassed = false;
  }

  return {
    attempted: true,
    passed: anyConfigured && allConfiguredChecksPassed,
    detail: checks,
  };
}

async function maybePersistMaskedAadhaar(docBase64: string, result: AryaKycResult): Promise<string | undefined> {
  if (!isLikelyAadhaarKyc(result) || !isAadhaarMaskConfigured()) return undefined;
  try {
    const masked = await maskAadhaarDocument(docBase64);
    const buf = maskedAadhaarBuffer(masked);
    if (!buf) return undefined;
    return saveFile(buf, 'image/jpeg');
  } catch (err: any) {
    console.error('[KYC] Aadhaar mask persist failed:', err.response?.data ?? err.message);
    return undefined;
  }
}

/**
 * Photo identity KYC via Arya.ai v2 extraction (Aadhaar / PAN / Voter ID /
 * Passport). Alternative to Aadhaar OTP. Unmasked images are sent to Arya
 * for extraction and are not stored. If the document is Aadhaar, a masked
 * copy may be kept for review. Optional selfie runs liveness + deepfake +
 * face-match against the ID photo.
 */
router.post('/kyc/identity-document', requireAuth, async (req: Request, res: Response) => {
  const { docBase64, selfieBase64 } = req.body;
  if (typeof docBase64 !== 'string' || docBase64.length === 0) {
    return res.status(400).json({ error: 'docBase64 is required — a clear photo of your Aadhaar, PAN, voter ID, or passport' });
  }
  if (!isKycExtractionConfigured()) {
    return res.status(503).json({ error: 'Identity verification is not configured yet (ARYA_KYC_TOKEN)' });
  }

  try {
    await assertReadableDocument(docBase64);
    const result = await extractKycDocument(docBase64, 'image');
    if (!result.success) {
      await prisma.kycVerificationLog.create({
        data: { userId: req.user!.userId, method: 'DOC_UPLOAD', outcome: 'FAILED', detail: result.error_message ?? 'Arya extraction failed' },
      });
      return res.status(422).json({ error: result.error_message || 'Could not verify that ID — try a clearer, well-lit photo.' });
    }

    const verifiedName = pickExtractedName(result);
    const maskedUrl = await maybePersistMaskedAadhaar(docBase64, result);
    const updateData: Record<string, unknown> = {
      isKycVerified: true,
      ...(verifiedName && { aadhaarVerifiedName: verifiedName }),
      ...(maskedUrl && { kycDocUrl: maskedUrl }),
    };

    let selfieOutcome: { attempted: boolean; passed?: boolean; detail?: Record<string, unknown> } = { attempted: false };
    if (typeof selfieBase64 === 'string' && selfieBase64.length > 0) {
      selfieOutcome = await runSelfieChecks(selfieBase64, docBase64);
      updateData.isSelfieVerified = selfieOutcome.passed;
      updateData.selfieVerificationData = selfieOutcome.detail as Prisma.InputJsonValue;
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: { id: true, isKycVerified: true, aadhaarVerifiedName: true, isSelfieVerified: true },
    });
    await prisma.kycVerificationLog.create({
      data: { userId: user.id, method: 'DOC_UPLOAD', outcome: 'SUCCESS', detail: `arya.ai${verifiedName ? `: ${verifiedName}` : ''}` },
    });
    await notify(user.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed via Arya.ai. You can now book or list cars.', '/account');
    res.json({ success: true, message: 'KYC verified', data: user, selfieCheck: selfieOutcome });
  } catch (err: any) {
    if (err.status === 422 || err.status === 400) return res.status(err.status).json({ error: err.message });
    console.error('[KYC] Arya identity verification failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not verify your ID right now. Please try again shortly.' });
  }
});

/**
 * Aadhaar OTP eKYC via Sandbox (sandbox.co.in). First-class identity path
 * alongside Arya photo KYC. Never stubs an instant pass — if Sandbox is
 * unconfigured, users should use photo ID or DigiLocker instead.
 */
router.post('/kyc/aadhaar/otp', requireAuth, async (req: Request, res: Response) => {
  const { aadhaarNumber } = req.body;
  if (!/^[0-9]{12}$/.test(aadhaarNumber ?? '')) {
    return res.status(400).json({ error: 'aadhaarNumber must be exactly 12 digits' });
  }

  if (!sandboxService.isConfigured()) {
    return res.status(503).json({ error: 'Aadhaar OTP is not configured yet — use photo ID verification or DigiLocker instead.' });
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
 * Step 2: verify the Sandbox Aadhaar OTP. Instant-pass without a provider is
 * not allowed.
 */
router.post('/kyc/aadhaar/verify', requireAuth, async (req: Request, res: Response) => {
  if (!sandboxService.isConfigured()) {
    return res.status(503).json({ error: 'Aadhaar OTP is not configured yet — use photo ID verification or DigiLocker instead.' });
  }
  const { referenceId, otp } = req.body;
  if (!referenceId || !/^[0-9]{6}$/.test(otp ?? '')) {
    return res.status(400).json({ error: 'referenceId and a 6-digit otp are required' });
  }

  let verifiedName: string | undefined;
  try {
    const result = await sandboxService.verifyAadhaarOtp(referenceId, otp);
    verifiedName = result.name;
  } catch (err: any) {
    console.error('[KYC] Aadhaar OTP verify failed:', err.response?.data ?? err.message);
    await prisma.kycVerificationLog.create({
      data: { userId: req.user!.userId, method: 'AADHAAR_OTP', outcome: 'FAILED', detail: err.response?.data?.message ?? err.message },
    });
    return res.status(422).json({ error: 'Aadhaar verification failed — check the OTP and try again.' });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { isKycVerified: true, ...(verifiedName && { aadhaarVerifiedName: verifiedName }) },
    select: { id: true, isKycVerified: true, aadhaarVerifiedName: true },
  });
  await prisma.kycVerificationLog.create({
    data: { userId: user.id, method: 'AADHAAR_OTP', outcome: 'SUCCESS', detail: verifiedName },
  });

  await notify(user.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed via Aadhaar OTP. You can now book or list cars.', '/account');

  res.json({ success: true, message: 'KYC verified', data: user });
});

/**
 * Alternative KYC path: Setu's DigiLocker consent flow. Returns a URL to
 * redirect the user to DigiLocker's own sign-in/consent screen; they land
 * back on /account/kyc afterwards and the frontend polls /status below.
 */
router.post('/kyc/digilocker/start', requireAuth, async (req: Request, res: Response) => {
  if (!isSetuConfigured()) return res.status(503).json({ error: 'DigiLocker verification is not configured yet' });

  try {
    const redirectUrl = `${config.clientUrl}/account/kyc?digilocker=1`;
    const request = await digilockerApi.createRequest(redirectUrl);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { digilockerRequestId: request.id, digilockerStatus: 'unauthenticated' },
    });
    res.json({ success: true, data: { url: request.url } });
  } catch (err: any) {
    console.error('[KYC] DigiLocker request creation failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not start DigiLocker verification right now. Please try again shortly.' });
  }
});

/** Polled by the frontend after the user returns from DigiLocker's consent screen. */
router.get('/kyc/digilocker/status', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { digilockerRequestId: true, isKycVerified: true } });
  if (!user?.digilockerRequestId) return res.status(400).json({ error: 'No DigiLocker verification in progress' });
  if (user.isKycVerified) return res.json({ success: true, data: { status: 'authenticated', isKycVerified: true } });

  try {
    const status = await digilockerApi.getStatus(user.digilockerRequestId);
    if (status.status === 'authenticated') {
      const aadhaar = await digilockerApi.fetchAadhaar(user.digilockerRequestId).catch(() => null);
      const updated = await prisma.user.update({
        where: { id: req.user!.userId },
        data: {
          digilockerStatus: 'authenticated',
          isKycVerified: true,
          ...(aadhaar?.name && { aadhaarVerifiedName: aadhaar.name }),
        },
        select: { id: true, isKycVerified: true, aadhaarVerifiedName: true },
      });
      await prisma.kycVerificationLog.create({
        data: { userId: updated.id, method: 'DIGILOCKER', outcome: 'SUCCESS', detail: updated.aadhaarVerifiedName },
      });
      await notify(updated.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed via DigiLocker. You can now book or list cars.', '/account');
      return res.json({ success: true, data: { status: 'authenticated', isKycVerified: true } });
    }
    res.json({ success: true, data: { status: status.status, isKycVerified: false } });
  } catch (err: any) {
    console.error('[KYC] DigiLocker status check failed:', err.response?.data ?? err.message);
    await prisma.kycVerificationLog.create({
      data: { userId: req.user!.userId, method: 'DIGILOCKER', outcome: 'FAILED', detail: err.response?.data?.message ?? err.message },
    });
    res.status(502).json({ error: 'Could not check DigiLocker status right now.' });
  }
});

/**
 * Driving License verification via Arya.ai's KYC document extraction API —
 * distinct from isKycVerified (Aadhaar-based identity), since holding a
 * valid license is its own requirement on a self-drive platform. Accepts a
 * base64-encoded photo/scan directly (not run through the file-upload
 * pipeline — nothing else needs to reference this image afterward, only
 * Arya's own extraction result, which we store).
 *
 * An optional selfieBase64 hardens this into a real "is this actually you"
 * check — the classic "hold your ID next to your face" KYC pattern: the
 * selfie is checked for liveness (not a photo-of-a-photo) and deepfake
 * manipulation, then face-matched against the license photo, all within
 * this one request. Neither image is ever persisted — only the pass/fail
 * results — and it's optional: selfieBase64 omitted just skips straight to
 * document-only verification, same as before this was added.
 *
 * docBase64 itself is only required the first time — since the license
 * photo is never persisted, a user who's already isDrivingLicenseVerified
 * can submit selfieBase64 alone later to add/retry the selfie check (runs
 * liveness + deepfake only in that case; face-match needs both images in
 * the same request, so it's skipped when there's no fresh license photo).
 */
router.post('/kyc/driving-license', requireAuth, async (req: Request, res: Response) => {
  const { docBase64, selfieBase64 } = req.body;
  const hasDoc = typeof docBase64 === 'string' && docBase64.length > 0;
  const hasSelfie = typeof selfieBase64 === 'string' && selfieBase64.length > 0;
  if (!hasDoc && !hasSelfie) {
    return res.status(400).json({ error: 'docBase64 (or selfieBase64, if your license is already verified) is required' });
  }

  const existing = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { isDrivingLicenseVerified: true } });
  if (!hasDoc && !existing?.isDrivingLicenseVerified) {
    return res.status(400).json({ error: 'docBase64 is required — a base64-encoded photo/scan of the driving license' });
  }
  if (hasDoc && !isKycExtractionConfigured()) {
    return res.status(503).json({ error: 'Driving license verification is not configured yet (ARYA_KYC_TOKEN)' });
  }

  try {
    const updateData: Record<string, unknown> = {};

    if (hasDoc) {
      await assertReadableDocument(docBase64);
      const result = await extractKycDocument(docBase64, 'image');
      if (!result.success) {
        await prisma.kycVerificationLog.create({
          data: { userId: req.user!.userId, method: 'DRIVING_LICENSE', outcome: 'FAILED', detail: result.error_message ?? 'Extraction failed' },
        });
        return res.status(422).json({ error: result.error_message || 'Could not verify the driving license — try a clearer photo.' });
      }
      updateData.isDrivingLicenseVerified = true;
      updateData.drivingLicenseExtractedData = result as unknown as Prisma.InputJsonValue;
    }

    let selfieOutcome: { attempted: boolean; passed?: boolean; detail?: Record<string, unknown> } = { attempted: false };

    if (hasSelfie) {
      selfieOutcome = await runSelfieChecks(selfieBase64, hasDoc ? docBase64 : undefined);
      updateData.isSelfieVerified = selfieOutcome.passed;
      updateData.selfieVerificationData = selfieOutcome.detail as Prisma.InputJsonValue;
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: { id: true, isDrivingLicenseVerified: true, isSelfieVerified: true },
    });
    await prisma.kycVerificationLog.create({
      data: { userId: user.id, method: 'DRIVING_LICENSE', outcome: 'SUCCESS', detail: selfieOutcome.attempted ? `selfie check: ${selfieOutcome.passed ? 'passed' : 'failed'}` : undefined },
    });
    if (hasDoc) {
      await notify(user.id, 'KYC_VERIFIED', 'Driving license verified', 'Your driving license has been confirmed.', '/account');
    } else if (selfieOutcome.passed) {
      await notify(user.id, 'KYC_VERIFIED', 'Identity verified', 'Your selfie has been matched and confirmed.', '/account');
    }

    res.json({ success: true, data: user, selfieCheck: selfieOutcome });
  } catch (err: any) {
    if (err.status === 422 || err.status === 400) return res.status(err.status).json({ error: err.message });
    console.error('[KYC] Driving license verification failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not verify the driving license right now. Please try again shortly.' });
  }
});

/** Legacy URL submit — runs the file through Arya.ai instead of an instant pass. */
router.post('/kyc/submit', requireAuth, async (req: Request, res: Response) => {
  const { docUrl } = req.body;
  if (!docUrl) return res.status(400).json({ error: 'docUrl is required (Aadhaar / PAN / voter ID / passport image URL)' });
  if (!isKycExtractionConfigured()) {
    return res.status(503).json({ error: 'Identity verification is not configured yet (ARYA_KYC_TOKEN)' });
  }

  try {
    const docBase64 = await fetchDocAsBase64(docUrl);
    await assertReadableDocument(docBase64);
    const result = await extractKycDocument(docBase64, 'image');
    if (!result.success) {
      await prisma.kycVerificationLog.create({
        data: { userId: req.user!.userId, method: 'DOC_UPLOAD', outcome: 'FAILED', detail: result.error_message ?? 'Arya extraction failed' },
      });
      return res.status(422).json({ error: result.error_message || 'Could not verify that document — try a clearer photo.' });
    }
    const verifiedName = pickExtractedName(result);
    const maskedUrl = await maybePersistMaskedAadhaar(docBase64, result);
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        isKycVerified: true,
        ...(verifiedName && { aadhaarVerifiedName: verifiedName }),
        ...(maskedUrl && { kycDocUrl: maskedUrl }),
      },
      select: { id: true, isKycVerified: true, aadhaarVerifiedName: true },
    });
    await prisma.kycVerificationLog.create({
      data: { userId: user.id, method: 'DOC_UPLOAD', outcome: 'SUCCESS', detail: `arya.ai via url${verifiedName ? `: ${verifiedName}` : ''}` },
    });
    await notify(user.id, 'KYC_VERIFIED', "You're verified!", 'Your identity has been confirmed via Arya.ai. You can now book or list cars.', '/account');
    res.json({ success: true, message: 'KYC verified', data: user });
  } catch (err: any) {
    if (err.status === 422 || err.status === 400) return res.status(err.status).json({ error: err.message });
    console.error('[KYC] Arya submit failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not verify that document right now. Please try again shortly.' });
  }
});

export default router;
