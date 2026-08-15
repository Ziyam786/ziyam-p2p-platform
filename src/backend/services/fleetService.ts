import { PrismaClient, BookingStatus, PayoutStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class FleetService {
  /**
   * Aggregates a host's/fleet operator's revenue, platform cut,
   * net earnings, and pending-escrow balance across their cars.
   */
  static async getEarningsOverview(hostId: string) {
    const ledgers = await prisma.payoutLedger.findMany({ where: { hostId } });

    const totalGross = ledgers.reduce((sum, l) => sum + l.grossAmount, 0);
    const ziyamCut = ledgers.reduce((sum, l) => sum + l.ziyamCut, 0);
    const netEarnings = ledgers.reduce((sum, l) => sum + l.netPayout, 0);
    const pendingEscrow = ledgers
      .filter((l) => l.status === PayoutStatus.HELD_IN_ESCROW)
      .reduce((sum, l) => sum + l.netPayout, 0);
    const settledPayouts = ledgers
      .filter((l) => l.status === PayoutStatus.SETTLED)
      .reduce((sum, l) => sum + l.netPayout, 0);

    return { totalGross, ziyamCut, netEarnings, pendingEscrow, settledPayouts };
  }

  /** Utilization: % of days each car in the fleet was booked, last 30 days. */
  static async getFleetUtilization(ownerId: string, windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const cars = await prisma.car.findMany({
      where: { ownerId },
      include: {
        bookings: {
          where: { status: BookingStatus.COMPLETED, startTime: { gte: since } },
        },
      },
    });

    return cars.map((car) => {
      const bookedDays = car.bookings.reduce((sum, b) => {
        const days = Math.max(
          1,
          Math.round((b.endTime.getTime() - b.startTime.getTime()) / (24 * 60 * 60 * 1000))
        );
        return sum + days;
      }, 0);
      return {
        carId: car.id,
        label: `${car.make} ${car.model} (${car.registrationNo})`,
        utilizationPercent: Math.min(100, Math.round((bookedDays / windowDays) * 100)),
      };
    });
  }

  /**
   * Host incentive-plan progress for the current calendar month — mirrors the
   * "targets to stay eligible" tracker hosts see on Zoomcar. Bonus % is a fixed
   * platform rule (informational only here; PayoutEngine doesn't apply it yet).
   */
  static async getIncentiveProgress(carId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysElapsedThisMonth = Math.ceil((now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));

    const car = await prisma.car.findUnique({
      where: { id: carId },
      include: {
        reviews: { select: { rating: true } },
        bookings: { where: { startTime: { gte: monthStart, lt: monthEnd } } },
      },
    });
    if (!car) return null;

    const totalThisMonth = car.bookings.length;
    const cancelledThisMonth = car.bookings.filter((b) => b.status === BookingStatus.CANCELLED).length;
    const fulfillmentRate = totalThisMonth === 0 ? 1 : 1 - cancelledThisMonth / totalThisMonth;

    const completed = car.bookings.filter((b) => b.status === BookingStatus.COMPLETED);
    const bookingsServed = completed.length;
    const bookingDays = completed.reduce((sum, b) => {
      const days = Math.max(1, Math.round((b.endTime.getTime() - b.startTime.getTime()) / (24 * 60 * 60 * 1000)));
      return sum + days;
    }, 0);

    const listedSince = car.createdAt > monthStart ? car.createdAt : monthStart;
    const listingDays = car.isAvailable ? Math.max(0, Math.ceil((now.getTime() - listedSince.getTime()) / (24 * 60 * 60 * 1000))) : 0;

    const rating = car.reviews.length === 0 ? 5 : car.reviews.reduce((s, r) => s + r.rating, 0) / car.reviews.length;

    const targets = {
      fulfillment: { met: fulfillmentRate >= 1, current: Math.round(fulfillmentRate * 100), target: 100, unit: '%' },
      listingDays: { met: listingDays >= 25, current: listingDays, target: 25, unit: 'days' },
      rating: { met: rating >= 4.5, current: Number(rating.toFixed(2)), target: 4.5, unit: '★' },
      bookings: { met: bookingsServed >= 10 || bookingDays >= 22, current: bookingsServed, currentDays: bookingDays, target: 10, targetDays: 22, unit: 'bookings' },
    };

    const allMet = Object.values(targets).every((t) => t.met);
    const daysRemaining = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      month: monthStart.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      daysRemaining,
      daysElapsedThisMonth,
      allMet,
      bonusPercent: allMet ? 5 : 0,
      targets,
    };
  }
}
