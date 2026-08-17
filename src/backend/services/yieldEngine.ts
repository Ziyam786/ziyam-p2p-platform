import { PrismaClient, BookingStatus } from '@prisma/client';
import cron from 'node-cron';

const prisma = new PrismaClient();

// Statuses that represent a real (or likely-real) hold on the car's
// calendar — mirrors the overlap check booking.routes.ts already uses to
// reject double-bookings, so "how booked is this car" here means the exact
// same thing it means everywhere else in the app.
const OCCUPYING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.RESERVED,
  BookingStatus.PENDING_HOST_REVIEW,
  BookingStatus.CONFIRMED,
  BookingStatus.ACTIVE,
  BookingStatus.COMPLETED,
];

const RECENT_WINDOW_DAYS = 30;
const UPCOMING_WINDOW_DAYS = 14;
const MIN_DAILY_RATE = 300;

export interface YieldSuggestion {
  carId: string;
  currentPrice: number;
  suggestedPrice: number;
  changePercent: number;
  utilizationRate: number; // 0-1, trailing 30 days
  upcomingFillRate: number; // 0-1, next 14 days
  demandScore: number; // 0-1, blended
  reason: string;
  tier: 'high_demand' | 'above_average' | 'optimal' | 'below_average' | 'low_demand';
}

/** Sum of days a car's calendar was/is occupied within [from, to), clamped to the window. */
async function occupiedDaysInWindow(carId: string, from: Date, to: Date): Promise<number> {
  const bookings = await prisma.booking.findMany({
    where: { carId, status: { in: OCCUPYING_STATUSES }, startTime: { lt: to }, endTime: { gt: from } },
    select: { startTime: true, endTime: true },
  });
  const msPerDay = 24 * 60 * 60 * 1000;
  let occupiedMs = 0;
  for (const b of bookings) {
    const start = Math.max(b.startTime.getTime(), from.getTime());
    const end = Math.min(b.endTime.getTime(), to.getTime());
    if (end > start) occupiedMs += end - start;
  }
  return occupiedMs / msPerDay;
}

/**
 * Computes a price suggestion from the car's OWN real booking history —
 * not a black box: utilization (how booked it's been) and near-term fill
 * rate (how booked it already is) blend into a demand score, which maps to
 * a bounded price adjustment tier. Never silent — every suggestion carries
 * a plain-language reason a host can actually evaluate.
 */
export async function computeYieldSuggestion(carId: string): Promise<YieldSuggestion> {
  const car = await prisma.car.findUnique({ where: { id: carId }, select: { dailyRate: true } });
  if (!car) throw new Error('Car not found');

  const now = new Date();
  const recentStart = new Date(now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [recentOccupied, upcomingOccupied] = await Promise.all([
    occupiedDaysInWindow(carId, recentStart, now),
    occupiedDaysInWindow(carId, now, upcomingEnd),
  ]);

  const utilizationRate = Math.min(1, recentOccupied / RECENT_WINDOW_DAYS);
  const upcomingFillRate = Math.min(1, upcomingOccupied / UPCOMING_WINDOW_DAYS);
  // Near-term fill weighted higher than trailing history — it's the more
  // actionable, current signal of real demand for this car right now.
  const demandScore = 0.4 * utilizationRate + 0.6 * upcomingFillRate;

  let changePercent: number;
  let tier: YieldSuggestion['tier'];
  let reason: string;

  if (demandScore >= 0.7) {
    changePercent = 0.12;
    tier = 'high_demand';
    reason = `${Math.round(upcomingFillRate * 100)}% of your next ${UPCOMING_WINDOW_DAYS} days are already booked — demand is outrunning your current price.`;
  } else if (demandScore >= 0.5) {
    changePercent = 0.05;
    tier = 'above_average';
    reason = `Booking activity is above average (${Math.round(demandScore * 100)}% demand score) — a small increase likely still converts.`;
  } else if (demandScore >= 0.25) {
    changePercent = 0;
    tier = 'optimal';
    reason = `Demand and price look balanced right now — no change suggested.`;
  } else if (demandScore >= 0.1) {
    changePercent = -0.08;
    tier = 'below_average';
    reason = `Only ${Math.round(utilizationRate * 100)}% booked over the last ${RECENT_WINDOW_DAYS} days — a small cut tends to convert more lookers into bookings.`;
  } else {
    changePercent = -0.15;
    tier = 'low_demand';
    reason = `Little to no bookings recently or upcoming — a meaningful price cut is the fastest way to get this car moving again.`;
  }

  const rawSuggested = car.dailyRate * (1 + changePercent);
  const suggestedPrice = Math.max(MIN_DAILY_RATE, Math.round(rawSuggested / 10) * 10);
  const actualChangePercent = car.dailyRate > 0 ? Number(((suggestedPrice - car.dailyRate) / car.dailyRate).toFixed(3)) : 0;

  return {
    carId,
    currentPrice: car.dailyRate,
    suggestedPrice,
    changePercent: actualChangePercent,
    utilizationRate: Number(utilizationRate.toFixed(3)),
    upcomingFillRate: Number(upcomingFillRate.toFixed(3)),
    demandScore: Number(demandScore.toFixed(3)),
    reason,
    tier,
  };
}

export async function applyYieldSuggestion(carId: string): Promise<YieldSuggestion> {
  const suggestion = await computeYieldSuggestion(carId);
  if (suggestion.suggestedPrice !== suggestion.currentPrice) {
    await prisma.car.update({ where: { id: carId }, data: { dailyRate: suggestion.suggestedPrice } });
  }
  return suggestion;
}

/** Weekly — applies suggestions automatically for cars whose host opted into yieldAutoApply. */
export function initializeYieldAutoApplyCron() {
  cron.schedule('0 3 * * 1', async () => {
    const cars = await prisma.car.findMany({ where: { yieldAutoApply: true, isAvailable: true }, select: { id: true } });
    for (const car of cars) {
      try {
        const result = await applyYieldSuggestion(car.id);
        console.log(`[YIELD AUTO-APPLY] Car ${car.id}: ₹${result.currentPrice} -> ₹${result.suggestedPrice} (${result.tier})`);
      } catch (error: any) {
        console.error(`[YIELD AUTO-APPLY ERROR] Car ${car.id}:`, error.message);
      }
    }
  });
}
