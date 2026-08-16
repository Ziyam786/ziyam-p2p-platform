import type { DemandPricing } from './types';

export const DEMAND_PRICING_FALLBACK: DemandPricing = {
  weekendBump: 0.15,
  peakHourBump: 0.10,
  peakHours: [[7, 10], [17, 21]],
  holidayBump: 0.25,
  maxMultiplier: 1.5,
  publicHolidays: [],
};

interface DemandBreakdown {
  multiplier: number;
  isWeekend: boolean;
  isPeakHour: boolean;
  isHoliday: boolean;
}

/** Keyed off the trip's pickup time — Fri 6pm through Sun 11:59pm counts as weekend. */
export function computeDemandMultiplier(pickup: Date, pricing: DemandPricing): DemandBreakdown {
  const day = pickup.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const hour = pickup.getHours();
  const isWeekend = day === 0 || day === 6 || (day === 5 && hour >= 18);
  const isPeakHour = pricing.peakHours.some(([start, end]) => hour >= start && hour < end);
  const isoDate = pickup.toISOString().slice(0, 10);
  const isHoliday = pricing.publicHolidays.includes(isoDate);

  let multiplier = 1;
  if (isWeekend) multiplier += pricing.weekendBump;
  if (isPeakHour) multiplier += pricing.peakHourBump;
  if (isHoliday) multiplier += pricing.holidayBump;
  multiplier = Math.min(multiplier, pricing.maxMultiplier);

  return { multiplier, isWeekend, isPeakHour, isHoliday };
}
