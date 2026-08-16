/**
 * Persists the pickup/drop-off dates chosen on the homepage/search bar so
 * they stay pre-filled on whichever car detail page the renter lands on next,
 * instead of resetting per-car.
 */
const KEY = 'ziyam_search_dates';

export interface StickyDates {
  pickup: string;
  dropoff: string;
}

export function getStickyDates(): StickyDates | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.pickup || !parsed?.dropoff) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStickyDates(pickup: string, dropoff: string): void {
  if (typeof window === 'undefined' || !pickup || !dropoff) return;
  localStorage.setItem(KEY, JSON.stringify({ pickup, dropoff }));
}
