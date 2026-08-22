import { PrismaClient } from '@prisma/client';
import { esignApi, isSetuConfigured } from './setuService';
import { renderLeaseAgreementPdf } from './leaseAgreementPdf';
import { config } from '../config';

const prisma = new PrismaClient();

/**
 * Renders the lease agreement, uploads it to Setu, and opens a two-signer
 * (host + guest) signature request. Shared by the manual "Start eSign"
 * button on /bookings/:id/agreement and the automatic trigger fired right
 * after Razorpay confirms payment (see razorpayWebhook.routes.ts) — both need the
 * exact same orchestration, just from different call sites with different
 * error-handling needs (one surfaces an HTTP error to the user, the other
 * is best-effort and falls back to the manual button on failure).
 */
export async function startLeaseAgreementEsign(bookingId: string): Promise<{ esignRequestId: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { car: { include: { owner: true } }, customer: true },
  });
  if (!booking) throw new Error('Booking not found');
  if (!isSetuConfigured()) throw new Error('eSign is not configured yet');
  if (booking.esignRequestId) throw new Error('An eSign request already exists for this booking');

  const pdf = await renderLeaseAgreementPdf({
    bookingId: booking.id,
    createdAt: booking.createdAt,
    hostName: booking.car.owner.fullName,
    guestName: booking.customer!.fullName,
    guestPhone: booking.customer!.phoneNumber,
    registrationNo: booking.car.registrationNo,
    chassisNo: booking.car.chassis,
    make: booking.car.make,
    model: booking.car.model,
    year: booking.car.year,
    startTime: booking.startTime,
    endTime: booking.endTime,
    protectionPlan: booking.protectionPlan,
    totalAmount: booking.totalAmount,
    // The actual amount held, not car.securityDeposit's raw figure — reduced
    // per protectionPlan (see DEPOSIT_HOLD_FRACTION in booking.routes.ts) and
    // genuinely charged via Razorpay, unlike the un-adjusted car-level number.
    securityDeposit: booking.depositAmount,
  });
  const { documentId } = await esignApi.uploadDocument(pdf, `lease-agreement-${booking.id.slice(0, 8)}`);
  const signature = await esignApi.createSignatureRequest(
    documentId,
    [
      { identifier: booking.car.owner.email, displayName: booking.car.owner.fullName },
      { identifier: booking.customer!.email, displayName: booking.customer!.fullName },
    ],
    `${config.clientUrl}/bookings/${booking.id}/agreement?esigned=1`
  );
  await prisma.booking.update({ where: { id: bookingId }, data: { esignRequestId: signature.id, esignStatus: 'sign_initiated' } });
  return { esignRequestId: signature.id };
}
