// The 6 photos a car listing needs before it counts as "angle-complete" —
// see docs/superpowers/specs/2026-08-21-fleet-photo-angle-spin-viewer-design.md.
// Order matters: this is also the canonical order car.routes.ts/host.routes.ts
// write `images`/`originalImages`/`imageAngles` in, so images[0] is always
// FRONT once a listing is tagged.
export const REQUIRED_CAR_ANGLES = ['FRONT', 'RIGHT', 'REAR', 'LEFT', 'INTERIOR_FRONT', 'INTERIOR_REAR'] as const;

export function isAngleComplete(imageAngles: string[] | null | undefined): boolean {
  if (!imageAngles || imageAngles.length === 0) return false;
  const present = new Set(imageAngles);
  return REQUIRED_CAR_ANGLES.every((angle) => present.has(angle));
}

export function isBookable(car: { imageAngles: string[] }, enforcementDate: string): boolean {
  if (isAngleComplete(car.imageAngles)) return true;
  if (!enforcementDate) return true;
  return new Date() < new Date(enforcementDate);
}
