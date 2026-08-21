# Fleet Drag-to-Spin Photo Viewer — Design

## Context

The homepage's "Explore the fleet in 3D" section (see `app/page.tsx`) currently
delivers a cursor-tilt effect on the car card (`TiltCard`) — a nice
micro-interaction, but not an actual view of the car in 3D, which the section's
own copy promises. There is no 3D model source for arbitrary host-listed cars
(this is a peer-to-peer fleet — any make/model a host lists, not a fixed
catalog — so licensing/sourcing per-model 3D assets is not viable).

Hosts already upload real photos of their actual car via `CarForm.tsx`, but as
a free-form, unordered list — no fixed angle count or labels. The fix is to
make that upload flow structured (a required angle set, reusing the app's
existing condition-photo pattern) and give renters a drag-to-spin viewer built
from those real photos — an honest "walk around this car" experience using the
actual listing's own photos, not a decorative effect or synthetic 3D model.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| 3D model vs. real photos | No 3D models (no source for arbitrary host-listed makes/models). Real host-uploaded photos, angle-labeled. |
| Required angle set | 6 photos: Front, Rear, Left, Right (exterior) + Interior front (dashboard), Interior rear (back seats). |
| Angle vocabulary | Reuses the existing `PhotoAngle` enum (already used for trip condition photos: `FRONT`/`REAR`/`LEFT`/`RIGHT`/`MIRROR_LEFT`/`MIRROR_RIGHT`/`ODOMETER`/`OTHER`), extended with two new values: `INTERIOR_FRONT`, `INTERIOR_REAR`. |
| Upload UX | Reuses `ConditionPhotoCapture.tsx`'s exact labeled-tile-grid pattern, applied to `CarForm.tsx`'s "Photos" field, instead of inventing a new upload pattern. |
| Spin interaction | Only the 4 exterior angles form the drag-to-rotate sequence (Front → Right → Rear → Left → Front). The 2 interior photos are separate gallery images (tapped/thumbnailed), not part of the rotation — a spin metaphor doesn't fit "look inside the car." |
| Where it appears | Every place a car photo renders: homepage fleet cards, `/cars` listing grid, and the `/cars/[id]` detail page's gallery. Built into `CarCard` itself so it's automatically consistent across the first two; the detail page gets its own equivalent treatment on its existing hero image. |
| Legacy (already-listed) cars | Not blocked immediately. A single global cutover date + 14-day grace period: before the deadline, every listing keeps booking exactly as today, with a host-dashboard reminder banner. After the deadline, any listing (old or new) still missing one of the 6 angle photos drops out of search/booking availability. New listings created after this feature ships require all 6 angles from day one — no grace period for new submissions. |
| Effect on existing bookings | Never affected — the gate only blocks *new* bookings on an under-photographed car; a trip already confirmed/active/completed is untouched. |

## Data model

`Car` already stores photos as two parallel, index-aligned arrays:

```prisma
images           String[] @default([])
// Admin-only unblurred originals, same array index as `images`
originalImages   String[] @default([])
```

Add a third parallel array, same pattern:

```prisma
// Angle label for the photo at the same index in `images` — "" for any
// legacy/free-form photo uploaded before this feature shipped, or an
// index beyond how many angles have been tagged so far. A listing counts
// as "angle-complete" once imageAngles contains all 6 required PhotoAngle
// values (see isAngleComplete() in carPhotoAngles.ts).
imageAngles      String[] @default([])
```

Extend the existing enum:

```prisma
enum PhotoAngle {
  FRONT
  REAR
  LEFT
  RIGHT
  MIRROR_LEFT
  MIRROR_RIGHT
  ODOMETER
  INTERIOR_FRONT   // new — car-listing interior photo, not a trip condition photo
  INTERIOR_REAR    // new — car-listing interior photo, not a trip condition photo
  OTHER
}
```

Both are additive, non-breaking Postgres migrations (new nullable-default
column, new enum values). No backfill migration is needed — `imageAngles`
naturally starts empty (`[]`) for every existing row, which is exactly the
"not angle-tagged yet" state the gating logic below already expects.

`images[0]` must always be the `FRONT` angle's URL once a listing is
angle-tagged, so every existing consumer that already reads
`car.images[0]`/`carImageSrc(car.images)` as "the cover photo" (CarCard, host
dashboard, checkout, trips, bookings-confirmation, etc. — the same ~8 call
sites touched by the earlier `next/image` crash fix) keeps working completely
unchanged. `CarForm.tsx`'s save logic is responsible for ordering the array
so the `FRONT` photo is always index 0 among the tagged photos.

## Host upload flow

`CarForm.tsx`'s current "Photos" field (a free-form add/remove list, each
photo run through `PlateBlurEditor` before being added) is replaced with a
6-tile grid modeled directly on `ConditionPhotoCapture.tsx`:

- Tiles: Front, Rear, Left, Right, Interior front, Interior rear — all
  required (no optional tiles here, unlike the condition-photo version).
- Each tile still runs the uploaded photo through the existing
  `PlateBlurEditor` step before it's accepted, exactly like today's flow —
  this feature changes *labeling*, not the blur requirement.
- Internal state: `Partial<Record<PhotoAngle, { blurred: string; original: string }>>`,
  keyed by the 6 required angles only.
- On save, `CarForm` derives `images`/`originalImages`/`imageAngles` as three
  parallel arrays in a fixed order (`FRONT, RIGHT, REAR, LEFT, INTERIOR_FRONT,
  INTERIOR_REAR`) from that map — `images[0]` is always `FRONT`, and the 4
  exterior angles are always contiguous and in walk-around order (see below).
- A listing cannot be submitted/saved as a *new* listing without all 6 tiles
  filled. An *existing* listing (created before this feature shipped) can
  still be saved with tiles missing — saving doesn't force full backfill in
  one sitting, it just improves `imageAngles` incrementally as the host fills
  in tiles over multiple edits, matching the grace-period spirit.
- This is enforced server-side on `POST /cars` (new listing creation), not
  just as `CarForm` client-side validation — a direct API call still can't
  create an angle-incomplete listing. `PUT /cars/:id` (editing an existing
  listing) is not blocked either way; it only ever improves `imageAngles`,
  never has to reject a save for staying incomplete.

## The spin viewer

A new component, `CarSpinViewer`, wraps the exterior 4 photos (in
`FRONT, RIGHT, REAR, LEFT` order — the order they're stored in `images`/
`imageAngles`) and:

- Renders the current frame as a plain `<Image>` (reusing the existing
  `carImageSrc`/`onError` placeholder-fallback logic from `CarCard`).
- On horizontal drag (pointer events, not just mouse — must work on touch),
  accumulates delta; once it crosses a per-frame pixel threshold, advances
  one frame in the `FRONT → RIGHT → REAR → LEFT → FRONT` loop (dragging
  right rotates the "camera" the same direction a real walk-around would),
  and resets the accumulator — no momentum/inertia physics for the first
  version, just a clean snap per threshold crossing.
- Falls back to a plain static `CarCard` (today's behavior, first photo
  only, no drag) whenever a listing isn't angle-complete — the spin
  interaction only ever appears for a listing that actually has all 4
  exterior angles.
- A small "drag to spin ↔" hint (icon + label) shows briefly on first
  render, matching the existing `TiltCard`'s glare treatment for
  discoverability, then fades — same idea, new specific affordance.
- `CarCard` renders `CarSpinViewer` in place of its current static `<Image>`
  when the car is angle-complete; this makes the homepage fleet cards and
  the `/cars` listing grid spin-capable automatically, with no separate
  per-page wiring.
- The 2 interior photos are exposed as a small thumbnail strip beneath the
  spin area (tap to view full-size), both on `CarCard` and the detail page —
  not part of the drag gesture.
- `/cars/[id]`'s existing hero-image + thumbnail-strip gallery
  (`app/cars/[id]/page.tsx`) gets the same `CarSpinViewer` swapped in for its
  hero image when angle-complete, keeping its existing thumbnail row as an
  explicit "jump straight to this angle" alternative to dragging.

## Availability gating & rollout

A new config value, following the existing `config.ts` convention (e.g.
`config.axon.partnerApiKeys`):

```ts
// Global cutover date for the fleet photo-angle requirement (see
// carPhotoAngles.ts). Cars missing any of the 6 required angle photos stay
// bookable until this date, then drop out of search/booking until the host
// backfills them — a one-time grace period for the existing fleet, not a
// per-car deadline. Leave unset to never enforce (existing behavior). The
// "14-day grace period" from brainstorming is a deploy-time policy choice,
// not a code constant — set this env var to (deploy date + 14 days) when
// this feature ships.
photoAngleEnforcementDate: process.env.PHOTO_ANGLE_ENFORCEMENT_DATE ?? '',
```

A shared helper, `isAngleComplete(car)`, checks whether all 6 required
`PhotoAngle` values are present in `car.imageAngles`. A second helper,
`isBookable(car)`, combines it with the enforcement date: bookable if
angle-complete, OR if `photoAngleEnforcementDate` is unset, OR if today is
before that date. New listings (created after this feature ships) always
require angle-completeness immediately, regardless of the enforcement date —
enforced in `CarForm`'s submit validation for new listings, not by the date
check.

`GET /cars` (the main search endpoint, `car.routes.ts`) applies `isBookable`
as an additional filter whenever `availableOnly=true` is requested — the same
place `where.isAvailable = true` is already applied. Booking creation
(`booking.routes.ts`) re-checks `isBookable` server-side too, as defense in
depth against a stale/cached car ID reaching checkout after the deadline.

The host dashboard shows a reminder banner on any car that isn't
angle-complete, counting down to the enforcement date once
`PHOTO_ANGLE_ENFORCEMENT_DATE` is configured (mirrors how other
deadline-driven banners already read a config value rather than hardcoding a
date in the frontend).

## Out of scope

- Momentum/inertia drag physics (first version snaps one frame per threshold
  crossing; a follow-up can add velocity-based multi-frame flicks).
- Automated re-ordering of images already uploaded before this feature
  existed — those stay as untagged legacy photos until the host redoes them
  through the new 6-tile flow.
- Any change to `originalImages`' admin-only unblurred-copy behavior, or to
  the blur-detection/editor flow itself.
