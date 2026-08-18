import { PrismaClient } from '@prisma/client';
import { randomInt } from 'crypto';
import { sendTemplateSms } from './smsService';
import { config } from '../config';

const prisma = new PrismaClient();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_RESEND_INTERVAL_MS = 60 * 1000; // 1 request per phone number per minute
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Delivers an OTP to a phone number via MSG91 (see smsService.ts) — real
 * delivery needs MSG91_AUTH_KEY + a DLT-registered OTP template
 * (MSG91_OTP_TEMPLATE_ID); until both are set, sendTemplateSms logs instead
 * of sending. Must never throw: a delivery failure should not be
 * distinguishable from "no account with that number" to the caller (see the
 * generic response in auth.routes.ts).
 */
async function deliverOtp(phoneNumber: string, code: string): Promise<void> {
  await sendTemplateSms(phoneNumber, config.sms.otpTemplateId, { otp: code });
}

/**
 * Creates and "delivers" a login OTP for an already-known phone number.
 * Callers are responsible for confirming a User exists first — this
 * function doesn't touch the User table so it stays reusable for other
 * OTP purposes later (e.g. phone-number change confirmation).
 */
export async function requestOtp(phoneNumber: string): Promise<{ devCode?: string }> {
  const recent = await prisma.otpCode.findFirst({
    where: { phoneNumber, createdAt: { gt: new Date(Date.now() - MIN_RESEND_INTERVAL_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    throw new Error('Please wait a minute before requesting another code');
  }

  const code = generateCode();
  await prisma.otpCode.create({
    data: { phoneNumber, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  await deliverOtp(phoneNumber, code);

  return { devCode: process.env.NODE_ENV !== 'production' ? code : undefined };
}

/** Verifies a code against the most recent unconsumed, unexpired OTP for that phone number. One-time use — consumes it on success. */
export async function verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: { phoneNumber, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.attempts >= MAX_VERIFY_ATTEMPTS) return false;

  if (otp.code !== code) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return true;
}
