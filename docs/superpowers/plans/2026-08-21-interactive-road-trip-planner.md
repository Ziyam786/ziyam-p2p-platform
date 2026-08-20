# Interactive Road-Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-4-destination, pay-first `/itineraries` paywall with a free, interactive single-page trip planner (`/plan`) that suggests a real car, a full trip-cost estimate, and real hotel options from free-text destination input, converting into either a real car booking or an optional ₹49 detailed-PDF unlock.

**Architecture:** Three new read-only backend endpoints (`GET /plan/destination-check`, `GET /plan/suggest-car`, `GET /plan/hotels`) built on two new pure/service modules (a Google Maps geocode+places wrapper, a deterministic car-category rule). One new frontend page (`app/plan/page.tsx`) composed of four small section components, fed by a new `planApi` client. The existing `/itineraries/:id` ₹49 pipeline is reused unchanged except its destination input becomes free text instead of one of 4 fixed keys.

**Tech Stack:** Express + Prisma + Vitest (backend), Next.js App Router + React + Tailwind (frontend), Google Maps Geocoding API + Places API (Nearby Search) called server-side via axios.

**Spec:** `docs/superpowers/specs/2026-08-20-interactive-road-trip-planner-design.md`

## Global Constraints

- Destination input is fully open free text — no fixed destination list (spec: "Destination scope").
- Car suggestion must come from real, currently-bookable inventory — never AI-invented (spec: "Car suggestion").
- Hotel suggestions come from Google Places API, not AI-written text (spec: "Hotel suggestions").
- Trip price estimate = car rental + fuel/toll estimate + estimated stay cost (spec: "Price estimate scope").
- The ₹49 charge happens only for the optional PDF unlock, never before the free pitch (spec: "Monetization").
- `/plan` is one single dynamic screen — sections reveal progressively, no multi-step page routing (spec: "Wizard shape").
- One section failing (geocode, car match, hotels) must never block another section from rendering (spec: "Error handling").
- A "Just browse cars" path must remain zero-friction and unaffected — it already exists as the "Browse Cars" nav link; do not touch `Navbar.tsx`.

---

## Setup note (not a code task — do this before/alongside Task 3)

A new Google Cloud API key is needed for **server-side** Geocoding API + Places API calls (the existing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is a browser key restricted to your website domains — it will reject server-to-server requests with no matching `Referer`). Create a second key in the same `ziyam-11a69` GCP project, enable **Geocoding API** and **Places API** on it, restrict it to **IP addresses** (your backend server's IP; use "None" only for local dev if the server's IP isn't known yet), and set it as `GOOGLE_MAPS_SERVER_API_KEY` in the backend's `.env`. Task 1 wires the env var; this note is the reminder to actually create the key in Cloud Console.

---

### Task 1: Backend config for the server-side Google Maps key

**Files:**
- Modify: `src/backend/config/index.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `config.googleMaps.serverApiKey: string` — consumed by Task 3.

- [ ] **Step 1: Add the config section**

In `src/backend/config/index.ts`, add after the `telematics` block:

```ts
  // Server-side Geocoding API + Places API calls for the road-trip planner
  // (src/backend/services/googleMapsService.ts). Separate from the
  // frontend's NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a browser key restricted to
  // website domains) — a server-to-server call has no Referer header, so it
  // needs its own key, restricted to this server's IP in Cloud Console.
  googleMaps: {
    serverApiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '',
  },
```

- [ ] **Step 2: Document the env var**

In `.env.example`, add near the existing `TELEMATICS_GATEWAY_URL` line:

```
GOOGLE_MAPS_SERVER_API_KEY=""
```

- [ ] **Step 3: Commit**

```bash
git add src/backend/config/index.ts .env.example
git commit -m "chore: add GOOGLE_MAPS_SERVER_API_KEY config for the road-trip planner"
```

---

### Task 2: `fuel_price_per_litre` public setting

**Files:**
- Modify: `src/backend/services/settingsService.ts`
- Modify: `src/frontend/lib/types.ts`

**Interfaces:**
- Produces: `getSetting('fuel_price_per_litre', 105)` returns a number; `PublicSettings.fuel_price_per_litre: number` on the frontend. Consumed by Task 15.

- [ ] **Step 1: Add to `PUBLIC_KEYS` and `DEFAULT_SETTINGS`**

In `src/backend/services/settingsService.ts`, add `'fuel_price_per_litre',` to the `PUBLIC_KEYS` array (after `'demand_pricing',`), and add to `DEFAULT_SETTINGS` (near `default_gst_rate`):

```ts
  // Road-trip planner's fuel-cost estimate (src/backend/routes/plan.routes.ts
  // consumers on the frontend). A rough, admin-tunable average pump price —
  // not tied to any real-time fuel-price feed.
  fuel_price_per_litre: 105,
```

- [ ] **Step 2: Add the field to the frontend type**

In `src/frontend/lib/types.ts`, add to `PublicSettings`:

```ts
  fuel_price_per_litre: number;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd src/backend && npx tsc -p ../../tsconfig.json --noEmit` is not a separate project — instead run from repo root: `npm run typecheck` and, separately, `cd src/frontend && npx tsc --noEmit -p tsconfig.json`.
Expected: both clean, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/backend/services/settingsService.ts src/frontend/lib/types.ts
git commit -m "feat: add fuel_price_per_litre public setting for the trip price estimate"
```

---

### Task 3: `googleMapsService.ts` — geocoding + hotel lookup

**Files:**
- Create: `src/backend/services/googleMapsService.ts`
- Test: `tests/googleMapsService.test.ts`

**Interfaces:**
- Produces:
  - `geocodeDestination(query: string): Promise<{ placeName: string; lat: number; lng: number } | null>`
  - `haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number`
  - `findNearbyHotels(lat: number, lng: number): Promise<HotelSuggestion[]>` where `HotelSuggestion = { name: string; rating: number | null; priceLevel: number | null; address: string }`
  - `BENGALURU: { lat: number; lng: number }` (exported constant, `{ lat: 12.9716, lng: 77.5946 }`)
- Consumed by Tasks 5, 6, 7, 8.

- [ ] **Step 1: Write the failing tests**

Create `tests/googleMapsService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
import axios from 'axios';
import { geocodeDestination, haversineKm, findNearbyHotels, BENGALURU } from '../src/backend/services/googleMapsService';

beforeEach(() => {
  vi.mocked(axios.get).mockReset();
});

describe('haversineKm', () => {
  it('computes the straight-line distance between Bengaluru and Ooty within 5km of the known ~250km figure', () => {
    const ooty = { lat: 11.4064, lng: 76.6932 };
    const km = haversineKm(BENGALURU, ooty);
    expect(km).toBeGreaterThan(230);
    expect(km).toBeLessThan(270);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(BENGALURU, BENGALURU)).toBe(0);
  });
});

describe('geocodeDestination', () => {
  it('returns placeName/lat/lng on a successful geocode', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [{ formatted_address: 'Ooty, Tamil Nadu, India', geometry: { location: { lat: 11.4064, lng: 76.6932 } } }],
      },
    });
    const result = await geocodeDestination('Ooty');
    expect(result).toEqual({ placeName: 'Ooty, Tamil Nadu, India', lat: 11.4064, lng: 76.6932 });
  });

  it('returns null when Google reports ZERO_RESULTS', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { status: 'ZERO_RESULTS', results: [] } });
    expect(await geocodeDestination('asdkfjhaslkdfj')).toBeNull();
  });

  it('returns null (not a throw) when the request itself fails', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network error'));
    expect(await geocodeDestination('Ooty')).toBeNull();
  });
});

describe('findNearbyHotels', () => {
  it('maps Places results into HotelSuggestion shape', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          { name: 'Hotel A', rating: 4.2, price_level: 2, vicinity: 'Main Road, Ooty' },
          { name: 'Hotel B', rating: undefined, price_level: undefined, vicinity: 'Lake Road, Ooty' },
        ],
      },
    });
    const hotels = await findNearbyHotels(11.4064, 76.6932);
    expect(hotels).toEqual([
      { name: 'Hotel A', rating: 4.2, priceLevel: 2, address: 'Main Road, Ooty' },
      { name: 'Hotel B', rating: null, priceLevel: null, address: 'Lake Road, Ooty' },
    ]);
  });

  it('returns an empty array (not a throw) when the request fails', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('network error'));
    expect(await findNearbyHotels(11.4064, 76.6932)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- googleMapsService`
Expected: FAIL — `Cannot find module '../src/backend/services/googleMapsService'`

- [ ] **Step 3: Write the implementation**

Create `src/backend/services/googleMapsService.ts`:

```ts
import axios from 'axios';
import { config } from '../config';

export const BENGALURU = { lat: 12.9716, lng: 77.5946 };

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

export interface HotelSuggestion {
  name: string;
  rating: number | null;
  priceLevel: number | null;
  address: string;
}

/** Great-circle distance in km — an approximation of road distance, matching this site's existing "distances are approximate" framing. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Resolves free-text destination input to a real place. Never throws —
 * returns null on ZERO_RESULTS, any other non-OK status, or a request
 * failure, so the caller can render a friendly "couldn't find that place"
 * message instead of a 500.
 */
export async function geocodeDestination(query: string): Promise<{ placeName: string; lat: number; lng: number } | null> {
  if (!config.googleMaps.serverApiKey) return null;
  try {
    const res = await axios.get(GEOCODE_URL, { params: { address: query, key: config.googleMaps.serverApiKey } });
    if (res.data.status !== 'OK' || !res.data.results?.[0]) return null;
    const top = res.data.results[0];
    return { placeName: top.formatted_address, lat: top.geometry.location.lat, lng: top.geometry.location.lng };
  } catch (error) {
    console.error('[googleMapsService] geocodeDestination failed:', error);
    return null;
  }
}

/**
 * Real, currently-listed lodging near a destination via Places Nearby
 * Search. Never throws — returns an empty array on any failure so the
 * planner's hotel section can render its own "unavailable" state rather
 * than blocking the rest of the page (see spec's Error handling section).
 */
export async function findNearbyHotels(lat: number, lng: number): Promise<HotelSuggestion[]> {
  if (!config.googleMaps.serverApiKey) return [];
  try {
    const res = await axios.get(PLACES_NEARBY_URL, {
      params: { location: `${lat},${lng}`, radius: 15000, type: 'lodging', key: config.googleMaps.serverApiKey },
    });
    if (res.data.status !== 'OK') return [];
    return (res.data.results ?? []).slice(0, 6).map((r: any) => ({
      name: r.name,
      rating: r.rating ?? null,
      priceLevel: r.price_level ?? null,
      address: r.vicinity ?? '',
    }));
  } catch (error) {
    console.error('[googleMapsService] findNearbyHotels failed:', error);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- googleMapsService`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/googleMapsService.ts tests/googleMapsService.test.ts
git commit -m "feat: add googleMapsService for geocoding and hotel lookup"
```

---

### Task 4: `carSuggestion.ts` — deterministic category rule

**Files:**
- Create: `src/backend/utils/carSuggestion.ts`
- Test: `tests/carSuggestion.test.ts`

**Interfaces:**
- Produces: `suggestCategoryForTrip(distanceKm: number): 'SUV' | 'Sedan'` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `tests/carSuggestion.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { suggestCategoryForTrip } from '../src/backend/utils/carSuggestion';

describe('suggestCategoryForTrip', () => {
  it('suggests Sedan for a short trip', () => {
    expect(suggestCategoryForTrip(100)).toBe('Sedan');
  });

  it('suggests Sedan right at the boundary', () => {
    expect(suggestCategoryForTrip(350)).toBe('Sedan');
  });

  it('suggests SUV just past the boundary', () => {
    expect(suggestCategoryForTrip(351)).toBe('SUV');
  });

  it('suggests SUV for a long trip', () => {
    expect(suggestCategoryForTrip(480)).toBe('SUV');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- carSuggestion`
Expected: FAIL — `Cannot find module '../src/backend/utils/carSuggestion'`

- [ ] **Step 3: Write the implementation**

Create `src/backend/utils/carSuggestion.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- carSuggestion`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/backend/utils/carSuggestion.ts tests/carSuggestion.test.ts
git commit -m "feat: add deterministic car-category suggestion rule"
```

---

### Task 5: `GET /plan/destination-check`

**Files:**
- Create: `src/backend/routes/plan.routes.ts`
- Modify: `src/backend/server.ts`
- Test: `tests/planRoutes.test.ts`

**Interfaces:**
- Consumes: `geocodeDestination`, `haversineKm`, `BENGALURU` from Task 3.
- Produces: `GET /plan/destination-check?q=<text>` → `{ success: true, data: { valid: true, placeName, lat, lng, distanceKm } }` or `{ success: true, data: { valid: false, reason } }`. Route file default-exports an Express `Router`, consumed by Tasks 6 and 7 (same file) and mounted in `server.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/planRoutes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/backend/services/googleMapsService', () => ({
  BENGALURU: { lat: 12.9716, lng: 77.5946 },
  geocodeDestination: vi.fn(),
  findNearbyHotels: vi.fn(),
  haversineKm: (a: any, b: any) => {
    // Real haversine so distance-based assertions below are meaningful.
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  },
}));

import { geocodeDestination } from '../src/backend/services/googleMapsService';
import planRoutes from '../src/backend/routes/plan.routes';

const app = express();
app.use(express.json());
app.use('/api', planRoutes);

beforeEach(() => {
  vi.mocked(geocodeDestination).mockReset();
});

describe('GET /plan/destination-check', () => {
  it('rejects a missing query param', async () => {
    const res = await request(app).get('/api/plan/destination-check');
    expect(res.status).toBe(400);
  });

  it('returns valid:false when geocoding finds nothing', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce(null);
    const res = await request(app).get('/api/plan/destination-check?q=asdkfjh');
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toMatch(/couldn't find/i);
  });

  it('returns valid:false when the destination is too far', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Delhi, India', lat: 28.7041, lng: 77.1025 });
    const res = await request(app).get('/api/plan/destination-check?q=Delhi');
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toMatch(/far/i);
  });

  it('returns valid:true with distanceKm for a reasonable destination', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Ooty, Tamil Nadu, India', lat: 11.4064, lng: 76.6932 });
    const res = await request(app).get('/api/plan/destination-check?q=Ooty');
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.placeName).toBe('Ooty, Tamil Nadu, India');
    expect(res.body.data.distanceKm).toBeGreaterThan(230);
    expect(res.body.data.distanceKm).toBeLessThan(270);
  });
});
```

- [ ] **Step 2: Install the test HTTP client**

Run: `npm install -D supertest @types/supertest`
Expected: adds both as devDependencies with 0 vulnerabilities (check `npm audit` after — if it reports anything, stop and fix before continuing, same as the vitest upgrade earlier in this branch's history).

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- planRoutes`
Expected: FAIL — `Cannot find module '../src/backend/routes/plan.routes'`

- [ ] **Step 4: Write the route**

Create `src/backend/routes/plan.routes.ts`:

```ts
import { Router, Request, Response } from 'express';
import { geocodeDestination, findNearbyHotels, haversineKm, BENGALURU } from '../services/googleMapsService';

const router = Router();

const MAX_DISTANCE_KM = 700;

router.get('/plan/destination-check', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q is required' });

  const place = await geocodeDestination(q);
  if (!place) {
    return res.json({ success: true, data: { valid: false, reason: "Couldn't find that place — check the spelling and try again." } });
  }

  const distanceKm = Math.round(haversineKm(BENGALURU, place));
  if (distanceKm > MAX_DISTANCE_KM) {
    return res.json({
      success: true,
      data: { valid: false, reason: `That's a bit far for a self-drive round trip — try somewhere within ${MAX_DISTANCE_KM}km of Bengaluru.` },
    });
  }

  res.json({ success: true, data: { valid: true, placeName: place.placeName, lat: place.lat, lng: place.lng, distanceKm } });
});

export default router;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- planRoutes`
Expected: PASS (4 tests)

- [ ] **Step 6: Mount the router**

In `src/backend/server.ts`, add the import near the other route imports (after `import itineraryRoutes from './routes/itinerary.routes';`):

```ts
import planRoutes from './routes/plan.routes';
```

And add `api.use(planRoutes);` on its own line immediately after the existing `api.use(itineraryRoutes);` line.

- [ ] **Step 7: Commit**

```bash
git add src/backend/routes/plan.routes.ts src/backend/server.ts tests/planRoutes.test.ts package.json package-lock.json
git commit -m "feat: add GET /plan/destination-check"
```

---

### Task 6: `GET /plan/suggest-car`

**Files:**
- Modify: `src/backend/routes/plan.routes.ts`
- Modify: `tests/planRoutes.test.ts`

**Interfaces:**
- Consumes: `suggestCategoryForTrip` from Task 4; Prisma `Car` model (`isAvailable`, `verificationStatus`, `city`, `category`, `dailyRate`, fields already used by `searchAvailableCars` in `aiService.ts`).
- Produces: `GET /plan/suggest-car?distanceKm=&city=` → `{ success: true, data: { car: {...} | null, exactMatch: boolean } }` where `car` (when non-null) has `{ id, make, model, city, category, dailyRate, seats, transmission, fuelType }`.

- [ ] **Step 1: Add the failing tests**

In `tests/planRoutes.test.ts`, add this block right after the existing `vi.mock('../src/backend/services/googleMapsService', ...)` call near the top of the file (`vi.mock` calls are hoisted by Vitest regardless of position, but keeping mocks grouped together keeps the file readable):

```ts
const prismaMock = vi.hoisted(() => ({ car: { findFirst: vi.fn() } }));
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => prismaMock) }));
```

Then append this new `describe` block at the end of the file:

```ts
describe('GET /plan/suggest-car', () => {
  it('returns the best-rated matching car with exactMatch:true', async () => {
    prismaMock.car.findFirst.mockResolvedValueOnce({
      id: 'car1', make: 'Mahindra', model: 'Thar', city: 'Bengaluru', category: 'SUV',
      dailyRate: 2499, seats: 4, transmission: 'MANUAL', fuelType: 'PETROL',
    });
    const res = await request(app).get('/api/plan/suggest-car?distanceKm=480&city=Bengaluru');
    expect(res.body.data.exactMatch).toBe(true);
    expect(res.body.data.car.make).toBe('Mahindra');
  });

  it('falls back to any available car with exactMatch:false when no category match exists', async () => {
    prismaMock.car.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'car2', make: 'Maruti', model: 'Swift', city: 'Bengaluru', category: 'Hatchback',
      dailyRate: 1499, seats: 5, transmission: 'MANUAL', fuelType: 'PETROL',
    });
    const res = await request(app).get('/api/plan/suggest-car?distanceKm=480&city=Bengaluru');
    expect(res.body.data.exactMatch).toBe(false);
    expect(res.body.data.car.make).toBe('Maruti');
  });

  it('returns car:null when nothing is available at all', async () => {
    prismaMock.car.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await request(app).get('/api/plan/suggest-car?distanceKm=100&city=Bengaluru');
    expect(res.body.data.car).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- planRoutes`
Expected: FAIL — new tests fail (route not implemented), earlier `destination-check` tests still pass.

- [ ] **Step 3: Implement the route**

In `src/backend/routes/plan.routes.ts`, add imports at the top:

```ts
import { PrismaClient } from '@prisma/client';
import { suggestCategoryForTrip } from '../utils/carSuggestion';
```

Add `const prisma = new PrismaClient();` after `const router = Router();`, and add this route before `export default router;`:

```ts
router.get('/plan/suggest-car', async (req: Request, res: Response) => {
  const distanceKm = Number(req.query.distanceKm ?? 0);
  const city = typeof req.query.city === 'string' && req.query.city.trim() ? req.query.city.trim() : 'Bengaluru';
  const category = suggestCategoryForTrip(distanceKm);

  const selectFields = {
    id: true, make: true, model: true, city: true, category: true,
    dailyRate: true, seats: true, transmission: true, fuelType: true,
  };

  let car = await prisma.car.findFirst({
    where: { isAvailable: true, verificationStatus: 'VERIFIED', city: { equals: city, mode: 'insensitive' as const }, category },
    select: selectFields,
    orderBy: { dailyRate: 'asc' },
  });
  let exactMatch = Boolean(car);

  if (!car) {
    car = await prisma.car.findFirst({
      where: { isAvailable: true, verificationStatus: 'VERIFIED', city: { equals: city, mode: 'insensitive' as const } },
      select: selectFields,
      orderBy: { dailyRate: 'asc' },
    });
    exactMatch = false;
  }

  res.json({ success: true, data: { car, exactMatch } });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- planRoutes`
Expected: PASS (7 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/backend/routes/plan.routes.ts tests/planRoutes.test.ts
git commit -m "feat: add GET /plan/suggest-car"
```

---

### Task 7: `GET /plan/hotels`

**Files:**
- Modify: `src/backend/routes/plan.routes.ts`
- Modify: `tests/planRoutes.test.ts`

**Interfaces:**
- Consumes: `findNearbyHotels` from Task 3.
- Produces: `GET /plan/hotels?lat=&lng=` → `{ success: true, data: HotelSuggestion[] }` (always 200, empty array on any failure — see Task 3's `findNearbyHotels` contract).

- [ ] **Step 1: Add the failing tests**

Append to `tests/planRoutes.test.ts`:

```ts
import { findNearbyHotels } from '../src/backend/services/googleMapsService';

describe('GET /plan/hotels', () => {
  it('rejects missing lat/lng', async () => {
    const res = await request(app).get('/api/plan/hotels');
    expect(res.status).toBe(400);
  });

  it('returns hotels for valid coordinates', async () => {
    vi.mocked(findNearbyHotels).mockResolvedValueOnce([
      { name: 'Hotel A', rating: 4.2, priceLevel: 2, address: 'Main Road' },
    ]);
    const res = await request(app).get('/api/plan/hotels?lat=11.4&lng=76.7');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Hotel A');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- planRoutes`
Expected: FAIL — route not implemented yet.

- [ ] **Step 3: Implement the route**

Add to `src/backend/routes/plan.routes.ts`, before `export default router;`:

```ts
router.get('/plan/hotels', async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required numbers' });
  }
  const hotels = await findNearbyHotels(lat, lng);
  res.json({ success: true, data: hotels });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- planRoutes`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/backend/routes/plan.routes.ts tests/planRoutes.test.ts
git commit -m "feat: add GET /plan/hotels"
```

---

### Task 8: Free-text destination validation on `/itineraries/unlock`

**Files:**
- Modify: `src/backend/routes/itinerary.routes.ts`
- Test: `tests/itineraryRoutes.test.ts`

**Interfaces:**
- Consumes: `geocodeDestination` from Task 3.
- No new exports — `ITINERARY_DESTINATIONS` stays exported as-is (still used by `razorpayPaymentHandler.ts` for extra hint text on the 4 originally-known destinations; its `?? unlock.destination` fallback already handles free text, so it needs no change).

- [ ] **Step 1: Write the failing test**

Create `tests/itineraryRoutes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/backend/services/googleMapsService', () => ({ geocodeDestination: vi.fn() }));
vi.mock('../src/backend/services/paymentGateway', () => ({
  default: { initiateCheckout: vi.fn().mockResolvedValue({ orderId: 'order_test', amount: 4900, currency: 'INR', keyId: 'rzp_test' }) },
}));
const prismaMock = vi.hoisted(() => ({ itineraryUnlock: { create: vi.fn(), update: vi.fn() } }));
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => prismaMock) }));

import { geocodeDestination } from '../src/backend/services/googleMapsService';
import itineraryRoutes from '../src/backend/routes/itinerary.routes';

const app = express();
app.use(express.json());
app.use('/api', itineraryRoutes);

beforeEach(() => {
  vi.mocked(geocodeDestination).mockReset();
  prismaMock.itineraryUnlock.create.mockReset();
  prismaMock.itineraryUnlock.update.mockReset();
});

describe('POST /itineraries/unlock', () => {
  it('rejects a destination that fails to geocode', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'asdkfjh', customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(400);
    expect(prismaMock.itineraryUnlock.create).not.toHaveBeenCalled();
  });

  it('accepts a free-text destination that geocodes successfully', async () => {
    vi.mocked(geocodeDestination).mockResolvedValueOnce({ placeName: 'Hampi, Karnataka, India', lat: 15.335, lng: 76.46 });
    prismaMock.itineraryUnlock.create.mockResolvedValueOnce({ id: 'unlock1' });
    prismaMock.itineraryUnlock.update.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/api/itineraries/unlock')
      .send({ destination: 'Hampi', customerName: 'A', customerEmail: 'a@b.com', customerPhone: '9999999999' });
    expect(res.status).toBe(201);
    expect(prismaMock.itineraryUnlock.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- itineraryRoutes`
Expected: FAIL — current code still validates against the fixed `ITINERARY_DESTINATIONS` dictionary, so `'Hampi'` and `'asdkfjh'` both currently get rejected with the same 400, making the "accepts" test fail.

- [ ] **Step 3: Change the validation**

In `src/backend/routes/itinerary.routes.ts`, add the import:

```ts
import { geocodeDestination } from '../services/googleMapsService';
```

Replace:

```ts
router.post('/itineraries/unlock', async (req: Request, res: Response) => {
  const { destination, customerName, customerEmail, customerPhone } = req.body;
  if (!destination || !ITINERARY_DESTINATIONS[destination]) {
    return res.status(400).json({ error: `destination must be one of ${Object.keys(ITINERARY_DESTINATIONS).join(', ')}` });
  }
```

with:

```ts
router.post('/itineraries/unlock', async (req: Request, res: Response) => {
  const { destination, customerName, customerEmail, customerPhone } = req.body;
  if (!destination?.trim()) {
    return res.status(400).json({ error: 'destination is required' });
  }
  const place = await geocodeDestination(destination.trim());
  if (!place) {
    return res.status(400).json({ error: "Couldn't find that destination — check the spelling and try again." });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- itineraryRoutes`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `npm test`
Expected: all test files pass (this repo's existing 51 money-path tests plus every test added in this plan).

- [ ] **Step 6: Commit**

```bash
git add src/backend/routes/itinerary.routes.ts tests/itineraryRoutes.test.ts
git commit -m "feat: accept free-text destinations on /itineraries/unlock via geocoding"
```

---

### Task 9: Frontend `tripPriceEstimate.ts` pure function

**Files:**
- Create: `src/frontend/lib/tripPriceEstimate.ts`

**Interfaces:**
- Produces: `estimateTripPrice(input: TripPriceEstimateInput, fuelPricePerLitre?: number): TripPriceEstimate` — consumed by Task 15.

**Note:** the frontend apps in this repo have no automated test runner configured (`package.json` only has `dev/build/start/lint`) — introducing one is out of scope for this feature. This function is verified manually during the browser check in Task 16/17, same as every other frontend calculation in this codebase (e.g. `computeDemandMultiplier` on the car detail page has no dedicated test file either).

- [ ] **Step 1: Write the implementation**

Create `src/frontend/lib/tripPriceEstimate.ts`:

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/lib/tripPriceEstimate.ts
git commit -m "feat: add trip price estimate calculation"
```

---

### Task 10: Frontend `planApi` + free-text `ItineraryDestination` type

**Files:**
- Modify: `src/frontend/lib/api.ts`

**Interfaces:**
- Produces:
  - `export type ItineraryDestination = string;` (was a 4-value union)
  - `planApi.destinationCheck(q: string): Promise<{ success: true; data: DestinationCheckResult }>`
  - `planApi.suggestCar(distanceKm: number, city?: string): Promise<{ success: true; data: { car: PlanCar | null; exactMatch: boolean } }>`
  - `planApi.hotels(lat: number, lng: number): Promise<{ success: true; data: HotelSuggestion[] }>`
  - Types `DestinationCheckResult`, `PlanCar`, `HotelSuggestion` exported from this file.
- Consumed by Tasks 12, 13, 14, 16.

- [ ] **Step 1: Change the destination type**

In `src/frontend/lib/api.ts`, replace:

```ts
export type ItineraryDestination = 'Ooty' | 'Coorg' | 'Chikmagalur' | 'Gokarna';
```

with:

```ts
// Was a fixed 4-value union; the road-trip planner takes free-text
// destination input now (see docs/superpowers/specs/2026-08-20-interactive-road-trip-planner-design.md).
export type ItineraryDestination = string;
```

- [ ] **Step 2: Add the `planApi` client**

Add after the existing `itinerariesApi` block:

```ts
export interface DestinationCheckResult {
  valid: boolean;
  reason?: string;
  placeName?: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
}

export interface PlanCar {
  id: string;
  make: string;
  model: string;
  city: string;
  category: string;
  dailyRate: number;
  seats: number;
  transmission: string;
  fuelType: string;
}

export interface HotelSuggestion {
  name: string;
  rating: number | null;
  priceLevel: number | null;
  address: string;
}

export const planApi = {
  destinationCheck: (q: string) => get<{ success: true; data: DestinationCheckResult }>(`/plan/destination-check?q=${encodeURIComponent(q)}`),
  suggestCar: (distanceKm: number, city = 'Bengaluru') =>
    get<{ success: true; data: { car: PlanCar | null; exactMatch: boolean } }>(`/plan/suggest-car?distanceKm=${distanceKm}&city=${encodeURIComponent(city)}`),
  hotels: (lat: number, lng: number) => get<{ success: true; data: HotelSuggestion[] }>(`/plan/hotels?lat=${lat}&lng=${lng}`),
};
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean. (If `app/page.tsx` errors on the now-`string` `ItineraryDestination` type, that's expected and gets resolved in Task 17 — note it and continue if this is the only error.)

- [ ] **Step 4: Commit**

```bash
git add src/frontend/lib/api.ts
git commit -m "feat: add planApi client and widen ItineraryDestination to free text"
```

---

### Task 11: Extract `ItineraryUnlockModal.tsx`

**Files:**
- Create: `src/frontend/components/ItineraryUnlockModal.tsx`

**Interfaces:**
- Consumes: `itinerariesApi`, `paymentsApi`, `openRazorpayCheckout`, `Modal`, `useToast` (all existing).
- Produces: `<ItineraryUnlockModal destination={string | null} onClose={() => void} />` — a self-contained modal that runs the full unlock → Razorpay → verify → redirect flow. Consumed by Task 16 (and by Task 17's homepage cleanup, which removes the old inline copy).

- [ ] **Step 1: Create the component**

Create `src/frontend/components/ItineraryUnlockModal.tsx` — this is the exact modal/handler currently inlined in `src/frontend/app/page.tsx` (state at lines 200-235, JSX at lines 1024-1051), extracted so both the homepage and the new `/plan` page can trigger the same ₹49 unlock flow without duplicating it:

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { useToast } from './Toast';
import { itinerariesApi, paymentsApi, ApiError } from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';

export default function ItineraryUnlockModal({ destination, onClose }: { destination: string | null; onClose: () => void }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destination) return;
    setSubmitting(true);
    try {
      const res = await itinerariesApi.unlock({
        destination,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
      });
      const result = await openRazorpayCheckout(res.data, {
        name: 'Ziyam SelfDrive',
        description: `${destination} road-trip itinerary`,
        prefillEmail: email.trim(),
        prefillContact: phone.trim(),
      });
      const verified = await paymentsApi.verifyRazorpay({
        razorpay_order_id: result.orderId,
        razorpay_payment_id: result.paymentId,
        razorpay_signature: result.signature,
      });
      onClose();
      router.push(`/itineraries/${verified.entityId}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not start payment', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={Boolean(destination)} onClose={() => { if (!submitting) onClose(); }} title={`Unlock: Bengaluru → ${destination}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          ₹49 unlocks an AI-generated day-by-day itinerary for this route — stops, timing, attractions, and self-drive tips, ready right after payment.
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mobile Number</label>
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button type="submit" disabled={submitting} className="w-full btn-gradient text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
          {submitting ? 'Processing…' : 'Pay ₹49 & Unlock'}
        </button>
        <p className="text-[11px] text-gray-400 text-center">🔒 Secure checkout via Razorpay. No account needed.</p>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean (the file is new and self-contained; nothing references it yet).

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/ItineraryUnlockModal.tsx
git commit -m "feat: extract ItineraryUnlockModal as a reusable component"
```

---

### Task 12: `PlanDestinationInput.tsx`

**Files:**
- Create: `src/frontend/components/PlanDestinationInput.tsx`

**Interfaces:**
- Consumes: `planApi.destinationCheck` from Task 10.
- Produces: `<PlanDestinationInput onResolved={(result: { placeName: string; lat: number; lng: number; distanceKm: number } | null) => void} />` — calls `onResolved(null)` while typing/invalid, calls it with the resolved place once a valid destination is confirmed. Consumed by Task 16.

- [ ] **Step 1: Create the component**

Create `src/frontend/components/PlanDestinationInput.tsx`:

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { planApi } from '../lib/api';

const DEBOUNCE_MS = 500;

export interface ResolvedDestination {
  placeName: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export default function PlanDestinationInput({ onResolved }: { onResolved: (result: ResolvedDestination | null) => void }) {
  const [query, setQuery] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
    onResolved(null);
    if (!query.trim()) return;

    timerRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await planApi.destinationCheck(query.trim());
        if (res.data.valid) {
          onResolved({
            placeName: res.data.placeName!,
            lat: res.data.lat!,
            lng: res.data.lng!,
            distanceKm: res.data.distanceKm!,
          });
        } else {
          setError(res.data.reason ?? 'Could not check that destination.');
        }
      } catch {
        setError('Could not check that destination right now — try again.');
      } finally {
        setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Where do you want to drive to?</label>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Hampi, Wayanad, Pondicherry…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {checking && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">Checking…</span>}
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/PlanDestinationInput.tsx
git commit -m "feat: add PlanDestinationInput component"
```

---

### Task 13: `PlanCarSuggestion.tsx`

**Files:**
- Create: `src/frontend/components/PlanCarSuggestion.tsx`

**Interfaces:**
- Consumes: `planApi.suggestCar`, `PlanCar` type from Task 10.
- Produces: `<PlanCarSuggestion distanceKm={number} onResolved={(car: PlanCar | null) => void} />` — fetches on mount/when `distanceKm` changes, renders the result, calls `onResolved` with the car (or null) once the fetch settles. Consumed by Task 16.

- [ ] **Step 1: Create the component**

Create `src/frontend/components/PlanCarSuggestion.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { planApi, type PlanCar } from '../lib/api';

export default function PlanCarSuggestion({ distanceKm, onResolved }: { distanceKm: number; onResolved: (car: PlanCar | null) => void }) {
  const [car, setCar] = useState<PlanCar | null>(null);
  const [exactMatch, setExactMatch] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    planApi
      .suggestCar(distanceKm)
      .then((res) => {
        if (!active) return;
        setCar(res.data.car);
        setExactMatch(res.data.exactMatch);
        onResolved(res.data.car);
      })
      .catch(() => {
        if (active) onResolved(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distanceKm]);

  if (loading) return <p className="text-sm text-gray-400">Finding a car for this trip…</p>;
  if (!car) return <p className="text-sm text-gray-500">No cars available right now — check back shortly.</p>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">
        {exactMatch ? 'Suggested for this trip' : 'Best available (no exact match for this trip)'}
      </p>
      <h3 className="font-bold text-gray-900 text-lg">{car.make} {car.model}</h3>
      <p className="text-sm text-gray-500 mt-1">{car.category} · {car.seats} seats · {car.transmission} · {car.fuelType}</p>
      <p className="text-amber-500 font-extrabold text-xl mt-2">₹{car.dailyRate.toLocaleString('en-IN')}<span className="text-sm text-gray-400 font-normal">/day</span></p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/PlanCarSuggestion.tsx
git commit -m "feat: add PlanCarSuggestion component"
```

---

### Task 14: `PlanHotelSuggestions.tsx`

**Files:**
- Create: `src/frontend/components/PlanHotelSuggestions.tsx`

**Interfaces:**
- Consumes: `planApi.hotels`, `HotelSuggestion` type from Task 10.
- Produces: `<PlanHotelSuggestions lat={number} lng={number} onResolved={(topPriceLevel: number | null) => void} />` — calls `onResolved` with the first hotel's `priceLevel` (or `null` if none) once the fetch settles. Consumed by Task 16.

- [ ] **Step 1: Create the component**

Create `src/frontend/components/PlanHotelSuggestions.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { planApi, type HotelSuggestion } from '../lib/api';

const PRICE_LEVEL_LABEL: Record<number, string> = { 0: 'Free', 1: '₹', 2: '₹₹', 3: '₹₹₹', 4: '₹₹₹₹' };

export default function PlanHotelSuggestions({ lat, lng, onResolved }: { lat: number; lng: number; onResolved: (topPriceLevel: number | null) => void }) {
  const [hotels, setHotels] = useState<HotelSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    planApi
      .hotels(lat, lng)
      .then((res) => {
        if (!active) return;
        setHotels(res.data);
        onResolved(res.data[0]?.priceLevel ?? null);
      })
      .catch(() => {
        if (active) onResolved(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (loading) return <p className="text-sm text-gray-400">Finding places to stay…</p>;
  if (hotels.length === 0) return <p className="text-sm text-gray-500">Hotel suggestions unavailable right now.</p>;

  return (
    <div className="space-y-2">
      {hotels.map((h) => (
        <div key={h.name} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{h.name}</p>
            <p className="text-xs text-gray-400 truncate">{h.address}</p>
          </div>
          <div className="text-right shrink-0">
            {h.rating != null && <p className="text-sm text-amber-500 font-bold">★ {h.rating.toFixed(1)}</p>}
            {h.priceLevel != null && <p className="text-xs text-gray-400">{PRICE_LEVEL_LABEL[h.priceLevel] ?? ''}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/PlanHotelSuggestions.tsx
git commit -m "feat: add PlanHotelSuggestions component"
```

---

### Task 15: `PlanPriceEstimate.tsx`

**Files:**
- Create: `src/frontend/components/PlanPriceEstimate.tsx`

**Interfaces:**
- Consumes: `estimateTripPrice`, `defaultTripDays` from Task 9; `settingsApi.public()` (existing).
- Produces: `<PlanPriceEstimate dailyRate={number} distanceKm={number} hotelPriceLevel={number | null} onDaysChange={(days: number) => void} />` — renders the editable days/nights input and the computed breakdown. Consumed by Task 16.

- [ ] **Step 1: Create the component**

Create `src/frontend/components/PlanPriceEstimate.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { settingsApi } from '../lib/api';
import { estimateTripPrice, defaultTripDays } from '../lib/tripPriceEstimate';

export default function PlanPriceEstimate({
  dailyRate,
  distanceKm,
  hotelPriceLevel,
  onDaysChange,
}: {
  dailyRate: number;
  distanceKm: number;
  hotelPriceLevel: number | null;
  onDaysChange?: (days: number) => void;
}) {
  const [days, setDays] = useState(() => defaultTripDays(distanceKm));
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState(105);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => setFuelPricePerLitre(res.data.fuel_price_per_litre))
      .catch(() => {});
  }, []);

  useEffect(() => {
    onDaysChange?.(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const estimate = estimateTripPrice({ dailyRate, days, distanceKm, hotelPriceLevel, nights: Math.max(0, days - 1) }, fuelPricePerLitre);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Estimated trip cost</p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Days
          <input
            type="number"
            min={1}
            max={14}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
            className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
          />
        </label>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <div className="flex justify-between"><span>Car rental ({days} {days === 1 ? 'day' : 'days'})</span><span>₹{estimate.rentalCost.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between"><span>Fuel (round trip)</span><span>₹{estimate.fuelCost.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between"><span>Tolls (estimate)</span><span>₹{estimate.tollCost.toLocaleString('en-IN')}</span></div>
        {estimate.stayCost != null && (
          <div className="flex justify-between"><span>Stay ({Math.max(0, days - 1)} nights)</span><span>₹{estimate.stayCost.toLocaleString('en-IN')}</span></div>
        )}
      </div>
      <div className="flex justify-between font-bold text-gray-900 text-lg border-t border-gray-100 mt-3 pt-3">
        <span>Total estimate</span><span>₹{estimate.total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/PlanPriceEstimate.tsx
git commit -m "feat: add PlanPriceEstimate component"
```

---

### Task 16: `app/plan/page.tsx`

**Files:**
- Create: `src/frontend/app/plan/page.tsx`

**Interfaces:**
- Consumes: `PlanDestinationInput` (Task 12), `PlanCarSuggestion` (Task 13), `PlanHotelSuggestions` (Task 14), `PlanPriceEstimate` (Task 15), `ItineraryUnlockModal` (Task 11), `setStickyDates` (existing, `src/frontend/lib/searchDates.ts`), `PlanCar` type (Task 10).
- Produces: the `/plan` route.

- [ ] **Step 1: Create the page**

Create `src/frontend/app/plan/page.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PlanDestinationInput, { type ResolvedDestination } from '../../components/PlanDestinationInput';
import PlanCarSuggestion from '../../components/PlanCarSuggestion';
import PlanPriceEstimate from '../../components/PlanPriceEstimate';
import PlanHotelSuggestions from '../../components/PlanHotelSuggestions';
import ItineraryUnlockModal from '../../components/ItineraryUnlockModal';
import { setStickyDates } from '../../lib/searchDates';
import type { PlanCar } from '../../lib/api';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlanPage() {
  const router = useRouter();
  const [destination, setDestination] = useState<ResolvedDestination | null>(null);
  const [suggestedCar, setSuggestedCar] = useState<PlanCar | null>(null);
  const [hotelPriceLevel, setHotelPriceLevel] = useState<number | null>(null);
  const [days, setDays] = useState(2);
  const [unlockDestination, setUnlockDestination] = useState<string | null>(null);

  function handleBookNow() {
    if (!suggestedCar) return;
    const pickup = new Date();
    pickup.setDate(pickup.getDate() + 1);
    pickup.setHours(10, 0, 0, 0);
    const dropoff = new Date(pickup);
    dropoff.setDate(dropoff.getDate() + days);
    setStickyDates(toLocalInput(pickup), toLocalInput(dropoff));
    router.push(`/cars/${suggestedCar.id}`);
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Plan your road trip</h1>
        <p className="text-gray-500 text-sm mb-8">Tell us where you're headed — we'll suggest a car, a price estimate, and places to stay.</p>

        <PlanDestinationInput onResolved={setDestination} />

        {destination && (
          <div className="mt-8 space-y-6">
            <p className="text-sm text-gray-500">
              Bengaluru → {destination.placeName} · ~{destination.distanceKm}km
            </p>

            <PlanCarSuggestion distanceKm={destination.distanceKm} onResolved={setSuggestedCar} />

            {suggestedCar && (
              <PlanPriceEstimate
                dailyRate={suggestedCar.dailyRate}
                distanceKm={destination.distanceKm}
                hotelPriceLevel={hotelPriceLevel}
                onDaysChange={setDays}
              />
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Places to stay nearby</p>
              <PlanHotelSuggestions lat={destination.lat} lng={destination.lng} onResolved={setHotelPriceLevel} />
            </div>

            {suggestedCar && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleBookNow}
                  className="flex-1 btn-gradient text-white font-bold py-3 rounded-xl transition text-center"
                >
                  Book this car
                </button>
                <button
                  onClick={() => setUnlockDestination(destination.placeName)}
                  className="flex-1 border border-amber-500 text-amber-500 hover:bg-amber-50 font-bold py-3 rounded-xl transition text-center"
                >
                  Get the ₹49 day-by-day PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ItineraryUnlockModal destination={unlockDestination} onClose={() => setUnlockDestination(null)} />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Manual browser check**

Start the backend (`npm run dev` at repo root) and frontend (`cd src/frontend && npm run dev`), then in a browser visit `/plan`:
- Type a real destination (e.g. "Hampi"). Confirm the "Checking…" indicator appears, then a distance line and a real car from the live fleet render.
- Confirm the price breakdown shows sane numbers and updates when you change the "Days" field.
- Confirm the hotel section either shows real hotels or the "unavailable" message (depending on whether `GOOGLE_MAPS_SERVER_API_KEY` is set in this environment) — either way, the rest of the page must still render.
- Click "Book this car" — confirm it navigates to that car's real detail page with pickup/dropoff already filled in.
- Click "Get the ₹49 day-by-day PDF" — confirm the existing unlock modal opens with the destination name in its title.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/app/plan/page.tsx
git commit -m "feat: add /plan interactive road-trip planner page"
```

---

### Task 17: Homepage — replace fixed destination cards with the planner CTA

**Files:**
- Modify: `src/frontend/app/page.tsx`

**Interfaces:**
- Consumes: nothing new (removes code instead).

- [ ] **Step 1: Remove the now-dead itinerary state and handler**

In `src/frontend/app/page.tsx`, delete the block (originally lines 197-235):

```tsx
  // Itinerary unlock — real ₹49 Razorpay flow, AI-generated content lands
  // server-side on /itineraries/:id once /payments/razorpay/verify confirms.
  const { show: showToast } = useToast();
  const [unlockDestination, setUnlockDestination] = useState<ItineraryDestination | null>(null);
  const [unlockName, setUnlockName] = useState('');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockPhone, setUnlockPhone] = useState('');
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockDestination) return;
    setUnlockSubmitting(true);
    try {
      const res = await itinerariesApi.unlock({
        destination: unlockDestination,
        customerName: unlockName.trim(),
        customerEmail: unlockEmail.trim(),
        customerPhone: unlockPhone.trim(),
      });
      const result = await openRazorpayCheckout(res.data, {
        name: 'Ziyam SelfDrive',
        description: `${unlockDestination} road-trip itinerary`,
        prefillEmail: unlockEmail.trim(),
        prefillContact: unlockPhone.trim(),
      });
      const verified = await paymentsApi.verifyRazorpay({
        razorpay_order_id: result.orderId,
        razorpay_payment_id: result.paymentId,
        razorpay_signature: result.signature,
      });
      setUnlockDestination(null);
      router.push(`/itineraries/${verified.entityId}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not start payment', 'error');
    } finally {
      setUnlockSubmitting(false);
    }
  }
```

Keep a `const { show: showToast } = useToast();` line if `showToast` is used elsewhere in this file — check with a search first (`grep -n "showToast" src/frontend/app/page.tsx`); if it's only used inside the block just deleted, remove that line too, otherwise keep it.

- [ ] **Step 2: Remove the `ROAD_TRIPS` constant**

Delete the `ROAD_TRIPS` array definition (originally lines 144-149).

- [ ] **Step 3: Replace the section JSX**

Replace the entire section (originally lines 977-1022, from `{/* ── ROAD TRIP ITINERARIES TEASER ── */}` through its closing `</section>`) with:

```tsx
      {/* ── ROAD TRIP PLANNER CTA ────────────────────────────────────── */}
      <section id="itineraries" className="relative bg-slate-950 py-20 overflow-hidden">
        <Glow className="top-0 left-0 w-[30rem] h-[26rem] bg-amber-500/10" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Plan a trip</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-3">Plan your next road trip</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mb-8">
            Tell us where you're headed — we'll suggest a car from our live fleet, a full trip-cost estimate, and places to stay along the way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/plan"
              className="inline-flex items-center justify-center gap-2 btn-gradient text-white font-bold px-6 py-3 rounded-xl transition"
            >
              Plan my road trip <ArrowUpRight className="w-4 h-4" />
            </a>
            <a
              href="/cars"
              className="inline-flex items-center justify-center gap-2 border border-slate-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-slate-900 transition"
            >
              Just browse cars
            </a>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Remove the itinerary unlock modal JSX**

Delete the `<Modal open={Boolean(unlockDestination)} ...>...</Modal>` block (originally lines 1024-1051).

- [ ] **Step 5: Clean up now-unused imports**

Run: `grep -n "ItineraryDestination\|itinerariesApi\|paymentsApi\|openRazorpayCheckout\|Mountain\|Coffee\|Waves\|TreePine\|^import Modal" src/frontend/app/page.tsx`

For each import that no longer has any remaining usage in the file, remove it from the import statements at the top. (`Modal`, `ArrowUpRight`, `ApiError`, `useToast` are very likely still used elsewhere on this large homepage — check each individually with the same grep pattern before removing; only delete what the grep shows has zero remaining references outside the import line itself.)

- [ ] **Step 6: Verify it compiles**

Run: `cd src/frontend && npx tsc --noEmit -p tsconfig.json`
Expected: clean — this is the step that catches any import left dangling or removed-too-early.

- [ ] **Step 7: Manual browser check**

Start the frontend dev server, visit `/`, scroll to the "Plan your next road trip" section. Confirm both buttons render and navigate correctly: "Plan my road trip" → `/plan`, "Just browse cars" → `/cars`.

- [ ] **Step 8: Run the full backend test suite one more time**

Run: `npm test` (from repo root)
Expected: all tests still pass — this task only touches frontend files, but it's the last task in the plan, so this is the final regression check.

- [ ] **Step 9: Commit**

```bash
git add src/frontend/app/page.tsx
git commit -m "feat: replace fixed itinerary cards with the road-trip planner CTA"
```

---

## Post-plan note

`docs/superpowers/specs/2026-08-20-interactive-road-trip-planner-design.md` lists three items as explicitly out of scope: live/bookable hotel reservations, multi-city itineraries, and in-planner car swapping. None of the tasks above implement them — this is expected, not a gap.
