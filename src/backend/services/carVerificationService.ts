import { PrismaClient, CarVerificationStatus } from '@prisma/client';
import cron from 'node-cron';
import { notify } from './notificationService';

const prisma = new PrismaClient();

const REMINDER_WINDOW_DAYS = 14;

/**
 * Daily — two jobs on RC/insurance/PUC expiry:
 *  1. Warn hosts ~14 days ahead of an approaching expiry, so there's time to
 *     renew before it actually lapses (checked as a rolling 1-day window,
 *     run daily — no separate "already reminded" tracking column, same
 *     lightweight approach as this codebase's other cron jobs).
 *  2. Demote any car whose docs have already expired from VERIFIED back to
 *     PENDING_REVIEW, so a lapsed car visibly needs re-verification instead
 *     of silently keeping its "Verified" badge. Booking-time enforcement
 *     (see booking.routes.ts) is the real hard block — this just keeps the
 *     car's status honest for hosts/admins browsing the dashboard.
 */
export function initializeDocExpiryCron() {
  cron.schedule('0 4 * * *', async () => {
    const now = new Date();
    const reminderFrom = new Date(now.getTime() + (REMINDER_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
    const reminderTo = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const expiringSoon = await prisma.car.findMany({
      where: {
        OR: [
          { insuranceExpiry: { gte: reminderFrom, lt: reminderTo } },
          { rcExpiry: { gte: reminderFrom, lt: reminderTo } },
          { pucExpiry: { gte: reminderFrom, lt: reminderTo } },
        ],
      },
      select: { id: true, make: true, model: true, ownerId: true, insuranceExpiry: true, rcExpiry: true, pucExpiry: true },
    });
    for (const car of expiringSoon) {
      const docs: string[] = [];
      if (car.insuranceExpiry && car.insuranceExpiry >= reminderFrom && car.insuranceExpiry < reminderTo) docs.push('insurance');
      if (car.rcExpiry && car.rcExpiry >= reminderFrom && car.rcExpiry < reminderTo) docs.push('RC');
      if (car.pucExpiry && car.pucExpiry >= reminderFrom && car.pucExpiry < reminderTo) docs.push('PUC');
      if (docs.length === 0) continue;
      await notify(
        car.ownerId,
        'GENERIC',
        'Vehicle document expiring soon',
        `Your ${car.make} ${car.model}'s ${docs.join('/')} expires in about ${REMINDER_WINDOW_DAYS} days. Renew and re-upload it to avoid bookings being blocked.`,
        '/host/dashboard'
      );
    }

    const expired = await prisma.car.findMany({
      where: {
        verificationStatus: CarVerificationStatus.VERIFIED,
        OR: [{ insuranceExpiry: { lt: now } }, { rcExpiry: { lt: now } }, { pucExpiry: { lt: now } }],
      },
      select: { id: true, make: true, model: true, ownerId: true },
    });
    for (const car of expired) {
      await prisma.car.update({ where: { id: car.id }, data: { verificationStatus: CarVerificationStatus.PENDING_REVIEW } });
      await notify(
        car.ownerId,
        'GENERIC',
        'Vehicle document expired',
        `Your ${car.make} ${car.model} has an expired RC, insurance, or PUC document. It's no longer bookable until you renew it and an admin re-verifies it.`,
        '/host/dashboard'
      );
      console.log(`[DOC EXPIRY] Car ${car.id} demoted to PENDING_REVIEW — expired document.`);
    }
  });
}
