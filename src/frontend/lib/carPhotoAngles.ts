// Mirrors src/backend/utils/carPhotoAngles.ts — see
// docs/superpowers/specs/2026-08-21-fleet-photo-angle-spin-viewer-design.md.
// Kept as a separate copy rather than a shared package because this repo's
// three Next.js apps (frontend/admin/agent) and the Express backend are
// four independent workspaces with no shared-code package today (see e.g.
// LogoBadge.tsx, independently duplicated per app) — this follows that same
// existing pattern rather than introducing a new one.

export type ExteriorAngle = 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT';

// Order matters — this is the drag-to-rotate sequence CarSpinViewer cycles
// through. Dragging right advances forward through this list, wrapping
// after LEFT back to FRONT.
export const EXTERIOR_SPIN_ORDER: readonly ExteriorAngle[] = ['FRONT', 'RIGHT', 'REAR', 'LEFT'];

export const REQUIRED_CAR_ANGLES = ['FRONT', 'RIGHT', 'REAR', 'LEFT', 'INTERIOR_FRONT', 'INTERIOR_REAR'] as const;

export function isAngleComplete(imageAngles: string[] | null | undefined): boolean {
  if (!imageAngles || imageAngles.length === 0) return false;
  const present = new Set(imageAngles);
  return REQUIRED_CAR_ANGLES.every((angle) => present.has(angle));
}
