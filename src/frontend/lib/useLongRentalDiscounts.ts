'use client';

import { useEffect, useState } from 'react';
import { settingsApi } from './api';
import type { LongRentalDiscount } from './types';

const FALLBACK: LongRentalDiscount[] = [
  { minDays: 3, percent: 0.05 },
  { minDays: 5, percent: 0.10 },
  { minDays: 10, percent: 0.15 },
];

let cached: LongRentalDiscount[] | null = null;
let inflight: Promise<LongRentalDiscount[]> | null = null;

function fetchDiscounts(): Promise<LongRentalDiscount[]> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = settingsApi
      .public()
      .then((res) => (cached = res.data.long_rental_discounts?.length ? res.data.long_rental_discounts : FALLBACK))
      .catch(() => FALLBACK);
  }
  return inflight;
}

/**
 * Shares one settings fetch across every mounted CarCard instead of one
 * request per card — a listing grid can render dozens at once.
 */
export function useLongRentalDiscounts(): LongRentalDiscount[] {
  const [discounts, setDiscounts] = useState<LongRentalDiscount[]>(cached ?? FALLBACK);

  useEffect(() => {
    if (cached) return;
    let active = true;
    fetchDiscounts().then((d) => active && setDiscounts(d));
    return () => {
      active = false;
    };
  }, []);

  return discounts;
}

/** Highest discount tier available at all, for a "save up to X% on N+ day trips" badge. */
export function bestDiscountTier(discounts: LongRentalDiscount[]): LongRentalDiscount | null {
  if (!discounts.length) return null;
  return discounts.reduce((best, d) => (d.percent > best.percent ? d : best), discounts[0]);
}
