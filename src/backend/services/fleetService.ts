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
}
