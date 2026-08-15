import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'TRIP_STARTED'
  | 'REVIEW_RECEIVED'
  | 'KYC_VERIFIED'
  | 'PAYOUT_SETTLED'
  | 'PROMO'
  | 'GENERIC';

export async function notify(userId: string, type: NotificationType, title: string, body: string, link?: string) {
  try {
    await prisma.notification.create({ data: { userId, type, title, body, link } });
  } catch (error) {
    // A failed notification must never block the action that triggered it.
    console.error('[NOTIFICATIONS] Failed to create notification:', error);
  }
}
