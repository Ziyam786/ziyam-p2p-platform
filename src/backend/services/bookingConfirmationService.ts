import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { sendTemplateSms } from './smsService';
import { sendTemplateWhatsapp } from './whatsappService';
import { sendEmail } from './emailService';

const prisma = new PrismaClient();

function emailShell(heading: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #d97706;">${heading}</h2>
      ${bodyHtml}
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Ziyam — ${config.clientUrl}</p>
    </div>
  `;
}

/**
 * Fires once a booking is actually CONFIRMED (host accepted) — see the
 * ACCEPT branch in hostReview.routes.ts. Sends SMS + WhatsApp + email to
 * both guest and host, each channel independently best-effort (none of
 * smsService/whatsappService/emailService ever throw, so nothing here can
 * fail loudly — a provider being unconfigured or down never blocks a
 * booking from being confirmed).
 */
export async function sendBookingConfirmedNotifications(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { car: { include: { owner: true } }, customer: true },
  });
  if (!booking) return;

  const carName = `${booking.car.make} ${booking.car.model}`;
  const dates = `${booking.startTime.toLocaleDateString('en-IN')} - ${booking.endTime.toLocaleDateString('en-IN')}`;
  const tripLink = `${config.clientUrl}/account/trips/${booking.id}`;
  const hostDashboardLink = `${config.clientUrl}/host/dashboard`;
  const agreementLink = `${config.clientUrl}/bookings/${booking.id}/agreement`;

  const guestVars = { carName, dates, link: tripLink };
  const hostVars = { carName, dates, link: tripLink };

  await Promise.all([
    sendTemplateSms(booking.customer.phoneNumber, config.sms.bookingConfirmedTemplateId, guestVars),
    sendTemplateSms(booking.car.owner.phoneNumber, config.sms.bookingConfirmedTemplateId, hostVars),
    sendTemplateWhatsapp(booking.customer.phoneNumber, 'booking_confirmed_guest', guestVars),
    sendTemplateWhatsapp(booking.car.owner.phoneNumber, 'booking_confirmed_host', hostVars),
    sendEmail(
      booking.customer.email,
      `Booking confirmed — ${carName}`,
      emailShell(
        'Your trip is booked!',
        `<p><strong>${carName}</strong><br>${dates}</p>
         <p>Your host has confirmed this booking. Pickup details, host contact, and everything else are on your trip page.</p>
         <p><a href="${tripLink}" style="color:#d97706;">View your trip</a></p>
         <p><a href="${agreementLink}" style="color:#d97706;">View your lease agreement</a> — it's signed electronically by both of you; check back here once that's complete if it isn't yet.</p>`
      )
    ),
    sendEmail(
      booking.car.owner.email,
      `Booking confirmed — ${carName}`,
      emailShell(
        'You confirmed a booking',
        `<p><strong>${carName}</strong><br>${dates}<br>Guest: ${booking.customer.fullName}</p>
         <p><a href="${hostDashboardLink}" style="color:#d97706;">View on your dashboard</a></p>
         <p><a href="${agreementLink}" style="color:#d97706;">View the lease agreement</a></p>`
      )
    ),
  ]);
}
