import { Router, Request, Response } from 'express';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { sandboxService } from '../services/sandboxService';
import { esignApi, isSetuConfigured } from '../services/setuService';
import { renderLeaseAgreementPdf } from '../services/leaseAgreementPdf';
import { renderHostOnboardingAgreementPdf } from '../services/hostOnboardingAgreementPdf';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  role: true,
  isKycVerified: true,
  avatarUrl: true,
  bio: true,
  payoutAccountId: true,
  bankAccountNumber: true,
  bankIfsc: true,
  bankNameAtBank: true,
  bankAccountVerified: true,
  signatureUrl: true,
  selfieUrl: true,
  alternatePhoneNumber: true,
  referralCode: true,
  creditsBalance: true,
  payoutFrequency: true,
  partnerAgreementWetSignedUrl: true,
  partnerAgreementWetSignedAt: true,
  partnerAgreementEsignStatus: true,
  partnerAgreementEsignDownloadUrl: true,
  createdAt: true,
};

router.get('/users/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: PUBLIC_USER_SELECT });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, data: user });
});

router.patch('/users/me', requireAuth, async (req: Request, res: Response) => {
  const { fullName, bio, avatarUrl, payoutAccountId, signatureUrl, selfieUrl, alternatePhoneNumber, payoutFrequency } = req.body;
  if (payoutFrequency !== undefined && !['STANDARD', 'WEEKLY'].includes(payoutFrequency)) {
    return res.status(400).json({ error: 'payoutFrequency must be STANDARD or WEEKLY' });
  }
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(payoutAccountId !== undefined && { payoutAccountId }),
      ...(signatureUrl !== undefined && { signatureUrl }),
      ...(selfieUrl !== undefined && { selfieUrl }),
      ...(alternatePhoneNumber !== undefined && { alternatePhoneNumber }),
      ...(payoutFrequency !== undefined && { payoutFrequency }),
    },
    select: PUBLIC_USER_SELECT,
  });
  res.json({ success: true, data: user });
});

// Verify a host's payout bank account via Sandbox's penny-drop API before they
// can be onboarded as a PayU child merchant (see PayoutEngine / README §2).
router.post('/users/me/bank/verify', requireAuth, async (req: Request, res: Response) => {
  const { ifsc, accountNumber } = req.body;
  if (!/^[A-Za-z]{4}0[A-Z0-9]{6}$/.test(ifsc ?? '')) return res.status(400).json({ error: 'Invalid IFSC code' });
  if (!accountNumber || String(accountNumber).length < 6) return res.status(400).json({ error: 'Invalid account number' });

  if (!sandboxService.isConfigured()) {
    return res.status(503).json({ error: 'Bank verification is not configured yet (SANDBOX_API_KEY / SANDBOX_API_SECRET)' });
  }

  try {
    const result = await sandboxService.verifyBankAccount(ifsc, accountNumber);
    if (!result.accountExists) {
      return res.status(422).json({ error: result.message || 'Bank account could not be verified' });
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        bankAccountNumber: accountNumber,
        bankIfsc: ifsc,
        bankNameAtBank: result.nameAtBank,
        bankAccountVerified: true,
      },
      select: PUBLIC_USER_SELECT,
    });
    res.json({ success: true, data: user });
  } catch (err: any) {
    console.error('[BANK VERIFY] failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not verify bank account right now. Please try again shortly.' });
  }
});

// Host Onboarding Agreement — the one-time, per-host agreement gating N+1
// payout eligibility (Aug-2024 policy, see PayoutEngine.assertPayoutEligible).
// Wet-signature upload (the host photographs/scans a physically-signed copy)
// and Aadhaar e-sign via Setu (same integration used for trip lease
// agreements) are both real — both are required before payouts unblock.
router.patch('/users/me/partner-agreement/wet-signature', requireAuth, async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { partnerAgreementWetSignedUrl: url, partnerAgreementWetSignedAt: new Date() },
    select: PUBLIC_USER_SELECT,
  });
  res.json({ success: true, data: user });
});

router.post('/users/me/partner-agreement/esign/start', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!isSetuConfigured()) return res.status(503).json({ error: 'eSign is not configured yet' });
  if (user.partnerAgreementEsignRequestId) return res.status(409).json({ error: 'An eSign request already exists for this agreement' });

  try {
    const pdf = await renderHostOnboardingAgreementPdf({
      hostId: user.id,
      hostName: user.fullName,
      hostEmail: user.email,
      hostPhone: user.phoneNumber,
      createdAt: new Date(),
    });
    const { documentId } = await esignApi.uploadDocument(pdf, `host-onboarding-agreement-${user.id.slice(0, 8)}`);
    const signature = await esignApi.createSignatureRequest(
      documentId,
      [{ identifier: user.email, displayName: user.fullName }],
      `${config.clientUrl}/host/agreement?esigned=1`
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { partnerAgreementEsignRequestId: signature.id, partnerAgreementEsignStatus: 'sign_initiated' },
    });
    res.json({ success: true, data: { esignRequestId: signature.id } });
  } catch (err: any) {
    console.error('[ESIGN] host onboarding agreement start failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not start eSign right now. Please try again shortly.' });
  }
});

router.get('/users/me/partner-agreement/esign/status', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.partnerAgreementEsignRequestId) return res.json({ success: true, data: { status: null } });

  if (user.partnerAgreementEsignStatus === 'sign_complete' && user.partnerAgreementEsignDownloadUrl) {
    return res.json({ success: true, data: { status: user.partnerAgreementEsignStatus, downloadUrl: user.partnerAgreementEsignDownloadUrl } });
  }

  try {
    const { status } = await esignApi.getStatus(user.partnerAgreementEsignRequestId);
    let downloadUrl: string | undefined;
    if (status === 'sign_complete') {
      const download = await esignApi.getDownloadUrl(user.partnerAgreementEsignRequestId);
      downloadUrl = download.downloadUrl;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { partnerAgreementEsignStatus: status, ...(downloadUrl && { partnerAgreementEsignDownloadUrl: downloadUrl }) },
    });
    res.json({ success: true, data: { status, downloadUrl } });
  } catch (err: any) {
    console.error('[ESIGN] host onboarding agreement status check failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not check eSign status right now.' });
  }
});

// Trip history for the logged-in renter
router.get('/users/me/bookings', requireAuth, async (req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    where: { customerId: req.user!.userId },
    include: { car: true, review: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: bookings.length, data: bookings });
});

router.get('/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      car: { include: { owner: { select: { id: true, fullName: true, email: true, avatarUrl: true, signatureUrl: true } } } },
      customer: { select: { id: true, fullName: true, email: true, signatureUrl: true } },
      review: true,
    },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not part of this booking' });
  }
  res.json({ success: true, data: booking });
});

// Real Aadhaar e-signing of the generated lease agreement, via Setu eSign —
// renders the same content as /bookings/:id/agreement into a PDF, uploads it,
// and creates a two-signer (host + guest) signature request.
router.post('/bookings/:id/esign/start', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { car: { include: { owner: true } }, customer: true },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });

  if (!isSetuConfigured()) return res.status(503).json({ error: 'eSign is not configured yet' });
  if (booking.esignRequestId) return res.status(409).json({ error: 'An eSign request already exists for this booking' });

  try {
    const pdf = await renderLeaseAgreementPdf({
      bookingId: booking.id,
      createdAt: booking.createdAt,
      hostName: booking.car.owner.fullName,
      guestName: booking.customer.fullName,
      guestPhone: booking.customer.phoneNumber,
      registrationNo: booking.car.registrationNo,
      chassisNo: booking.car.chassis,
      make: booking.car.make,
      model: booking.car.model,
      year: booking.car.year,
      startTime: booking.startTime,
      endTime: booking.endTime,
      protectionPlan: booking.protectionPlan,
      totalAmount: booking.totalAmount,
      securityDeposit: booking.car.securityDeposit,
    });
    const { documentId } = await esignApi.uploadDocument(pdf, `lease-agreement-${booking.id.slice(0, 8)}`);
    const signature = await esignApi.createSignatureRequest(
      documentId,
      [
        { identifier: booking.car.owner.email, displayName: booking.car.owner.fullName },
        { identifier: booking.customer.email, displayName: booking.customer.fullName },
      ],
      `${config.clientUrl}/bookings/${booking.id}/agreement?esigned=1`
    );
    await prisma.booking.update({ where: { id }, data: { esignRequestId: signature.id, esignStatus: 'sign_initiated' } });
    res.json({ success: true, data: { esignRequestId: signature.id } });
  } catch (err: any) {
    console.error('[ESIGN] start failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not start eSign right now. Please try again shortly.' });
  }
});

router.get('/bookings/:id/esign/status', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isCustomer = booking.customerId === req.user!.userId;
  const isHost = booking.car.ownerId === req.user!.userId;
  if (!isCustomer && !isHost) return res.status(403).json({ error: 'Not part of this booking' });
  if (!booking.esignRequestId) return res.json({ success: true, data: { status: null } });

  if (booking.esignStatus === 'sign_complete' && booking.esignDownloadUrl) {
    return res.json({ success: true, data: { status: booking.esignStatus, downloadUrl: booking.esignDownloadUrl } });
  }

  try {
    const { status } = await esignApi.getStatus(booking.esignRequestId);
    let downloadUrl: string | undefined;
    if (status === 'sign_complete') {
      const download = await esignApi.getDownloadUrl(booking.esignRequestId);
      downloadUrl = download.downloadUrl;
    }
    await prisma.booking.update({
      where: { id },
      data: { esignStatus: status, ...(downloadUrl && { esignDownloadUrl: downloadUrl }) },
    });
    res.json({ success: true, data: { status, downloadUrl } });
  } catch (err: any) {
    console.error('[ESIGN] status check failed:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Could not check eSign status right now.' });
  }
});

router.post('/bookings/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.customerId !== req.user!.userId) return res.status(403).json({ error: 'Not your booking' });
  const cancellableStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED];
  if (!cancellableStatuses.includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking in status ${booking.status}` });
  }

  const updated = await prisma.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED } });
  res.json({ success: true, data: updated });
});

export default router;
