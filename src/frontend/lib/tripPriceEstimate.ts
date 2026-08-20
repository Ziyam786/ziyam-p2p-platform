export interface TripPriceEstimateInput {
  dailyRate: number;
  days: number;
  distanceKm: number;
  hotelPriceLevel: number | null; // Google Places price_level, 0-4, or null if hotels are unavailable
  nights: number;
}

export interface TripPriceEstimate {
  rentalCost: number;
  fuelCost: number;
  tollCost: number;
  stayCost: number | null;
  total: number;
}

const AVG_MILEAGE_KMPL = 15; // reasonable average across the fleet's mixed categories — not per-car, this app has no per-car mileage field
const DEFAULT_FUEL_PRICE_PER_LITRE = 105;
const FLAT_TOLL_PER_100KM = 150; // fixed placeholder, refinable later per the design spec's "explicitly out of scope" note
const NIGHTLY_RATE_BY_PRICE_LEVEL: Record<number, number> = { 0: 1200, 1: 1800, 2: 2800, 3: 4500, 4: 7000 };

/** Full round-trip cost estimate: car rental + fuel + tolls + (optional) stay. Pure function, no I/O — fuelPricePerLitre comes from the admin-editable public setting, defaulted here for callers that haven't fetched it yet. */
export function estimateTripPrice(input: TripPriceEstimateInput, fuelPricePerLitre = DEFAULT_FUEL_PRICE_PER_LITRE): TripPriceEstimate {
  const rentalCost = Math.round(input.dailyRate * input.days);
  const roundTripKm = input.distanceKm * 2;
  const fuelCost = Math.round((roundTripKm / AVG_MILEAGE_KMPL) * fuelPricePerLitre);
  const tollCost = Math.round((roundTripKm / 100) * FLAT_TOLL_PER_100KM);
  const stayCost =
    input.hotelPriceLevel != null ? (NIGHTLY_RATE_BY_PRICE_LEVEL[input.hotelPriceLevel] ?? NIGHTLY_RATE_BY_PRICE_LEVEL[2]) * input.nights : null;
  const total = rentalCost + fuelCost + tollCost + (stayCost ?? 0);
  return { rentalCost, fuelCost, tollCost, stayCost, total };
}

/** Sensible default trip length from distance alone — editable by the guest afterward. */
export function defaultTripDays(distanceKm: number): number {
  if (distanceKm < 300) return 2;
  if (distanceKm < 500) return 3;
  return 4;
}
