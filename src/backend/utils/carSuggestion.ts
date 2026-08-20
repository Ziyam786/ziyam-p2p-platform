/**
 * Deterministic, distance-only proxy for "what kind of car suits this
 * trip" — this app has no terrain/elevation data, so distance is the one
 * real signal available. Longer trips lean SUV for comfort/ground
 * clearance; shorter ones lean Sedan for mileage. A real terrain signal
 * (e.g. hill-station detection) would refine this further but isn't
 * available yet — documented limitation, not a bug.
 */
export function suggestCategoryForTrip(distanceKm: number): 'SUV' | 'Sedan' {
  return distanceKm > 350 ? 'SUV' : 'Sedan';
}
