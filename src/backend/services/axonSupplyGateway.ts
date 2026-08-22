import { PrismaClient } from '@prisma/client';
import { isBookable } from '../utils/carPhotoAngles';
import { config } from '../config';

const prisma = new PrismaClient();

export interface SearchFleetParams {
  city: string;
  category?: string;
  pickupTime: Date;
  dropTime: Date;
}

export class AxonSupplyGateway {
  // Mandatory 2-Hour post-trip block for Mechanix Pro sanitization
  private static readonly SANITIZATION_BUFFER_MS = 2 * 60 * 60 * 1000;

  /**
   * True if no CONFIRMED/ACTIVE/PENDING_PAYMENT booking (plus the 2-hour
   * sanitization buffer) overlaps the requested window for this one car.
   * Extracted from searchAvailableFleet's inline query so the booking-write
   * endpoint can re-check the exact same rule atomically, immediately before
   * insert — a partner's search and book calls aren't the same request, so
   * availability can have changed in between.
   */
  public static async isCarAvailableForWindow(carId: string, pickupTime: Date, dropTime: Date): Promise<boolean> {
    const requestedEndWithBuffer = new Date(dropTime.getTime() + this.SANITIZATION_BUFFER_MS);
    const conflict = await prisma.booking.findFirst({
      where: {
        carId,
        status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT'] },
        startTime: { lte: requestedEndWithBuffer },
        endTime: { gte: pickupTime },
      },
      select: { id: true },
    });
    return !conflict;
  }

  /**
   * Finds available vehicles taking into account existing bookings,
   * blackout dates, and the 2-hour sanitization buffer.
   */
  public static async searchAvailableFleet(params: SearchFleetParams) {
    const { city, category, pickupTime, dropTime } = params;

    const requestedStart = new Date(pickupTime);
    const requestedEnd = new Date(dropTime);

    // 1. Fetch active vehicles in the target city
    // Explicit select, not the whole Car row: this response goes to an
    // external aggregator (Zoomcar/Revv), so it must exclude anything not
    // needed for their listing/pricing display — host identity, document
    // URLs (RC/insurance/PUC), registration number, fleet-agreement/e-sign
    // state, telematics IMEI, and internal ops fields (pause/service/
    // onboarding) never leave this system.
    const cars = await prisma.car.findMany({
      where: {
        city: { equals: city, mode: 'insensitive' },
        ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
        isAvailable: true,
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        category: true,
        fuelType: true,
        transmission: true,
        seats: true,
        dailyRate: true,
        securityDeposit: true,
        kmIncludedPerDay: true,
        extraKmCharge: true,
        images: true,
        imageAngles: true,
        features: true,
        city: true,
        address: true,
        latitude: true,
        longitude: true,
        isAvailable: true,
        instantBook: true,
        offersDelivery: true,
        deliveryFee: true,
        offersPickup: true,
        pickupFee: true,
      },
    });

    // Aggregator partners must not keep listing cars that would 409 at
    // actual booking creation because they're missing required angle photos.
    const bookableCars = cars.filter((car) => isBookable(car, config.photoAngleEnforcementDate));

    if (!bookableCars.length) return [];

    // 2. Filter out cars with a conflicting booking in the requested window + buffer.
    // 3. imageAngles was only selected above to drive the isBookable() gate —
    // strip it back out here so it doesn't leak to the aggregator alongside
    // the fields already excluded in the select above.
    const availability = await Promise.all(
      bookableCars.map(async (car) => ({ car, available: await this.isCarAvailableForWindow(car.id, requestedStart, requestedEnd) }))
    );
    return availability.filter((a) => a.available).map(({ car: { imageAngles, ...rest } }) => rest);
  }

  /**
   * Generates standard iCal payload for third-party aggregator syncing (Zoomcar / Revv)
   */
  public static async generateICalendarFeed(carId: string): Promise<string> {
    const bookings = await prisma.booking.findMany({
      where: {
        carId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Eightlines Fleet Private Limited//ZIYAM Axon Gateway//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const b of bookings) {
      const bufferEnd = new Date(b.endTime.getTime() + this.SANITIZATION_BUFFER_MS);
      const dtStart = b.startTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtEnd = bufferEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      ical.push(
        'BEGIN:VEVENT',
        `UID:${b.id}@ziyam.in`,
        `DTSTAMP:${dtStart}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:ZIYAM Reserved (Mechanix Pro Buffer Included)`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }

    ical.push('END:VCALENDAR');
    return ical.join('\r\n');
  }
}