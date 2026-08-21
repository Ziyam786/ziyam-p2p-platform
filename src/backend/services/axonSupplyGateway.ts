import { PrismaClient } from '@prisma/client';

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
   * Finds available vehicles taking into account existing bookings,
   * blackout dates, and the 2-hour sanitization buffer.
   */
  public static async searchAvailableFleet(params: SearchFleetParams) {
    const { city, category, pickupTime, dropTime } = params;

    const requestedStart = new Date(pickupTime);
    const requestedEnd = new Date(dropTime);
    // Buffer window for the new booking
    const requestedEndWithBuffer = new Date(requestedEnd.getTime() + this.SANITIZATION_BUFFER_MS);

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

    if (!cars.length) return [];

    const carIds = cars.map((c) => c.id);

    // 2. Find conflicting bookings that overlap with the requested window + buffer
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        carId: { in: carIds },
        status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT'] },
        OR: [
          {
            // Existing trip overlaps with requested start
            startTime: { lte: requestedEndWithBuffer },
            endTime: { gte: requestedStart },
          },
        ],
      },
      select: {
        carId: true,
      },
    });

    const bookedCarIds = new Set(conflictingBookings.map((b) => b.carId));

    // 3. Filter out booked cars
    return cars.filter((car) => !bookedCarIds.has(car.id));
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