# Interactive Road-Trip Planner — Design

## Context

The current "Smart road-trip itineraries" feature (`/itineraries/*`) is a blind
lead-gen paywall: the guest picks one of 4 fixed destinations (Ooty, Coorg,
Chikmagalur, Gokarna), fills a name/email/phone modal, pays ₹49 via Razorpay,
then waits for a server-side Claude-generated plain-text itinerary. Payment
happens before the guest sees anything personalized.

The owner wants this turned into a free, interactive "sales pitch" planner
that suggests a real car, a real trip-cost estimate, and real hotel options —
converting into an actual car booking, not just selling ₹49 of text. A guest
who doesn't want the guided experience must be able to skip straight to
booking a self-drive car with zero friction.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Where does the ₹49 charge go? | Moves later: the pitch (car/price/hotels) is free; ₹49 optionally unlocks a downloadable day-by-day PDF itinerary afterward. |
| Destination input | Fully open text entry — not limited to a fixed list. |
| Car suggestion | Deterministic rules against real live inventory (reuses the existing `search_available_cars` logic) — never AI-invented. |
| Hotel suggestions | Google Places API (Nearby Search), reusing the Google Maps key already configured for car-location maps. |
| Price estimate scope | Full trip budget: car rental + fuel/toll estimate + estimated stay cost. |
| Entry point | Homepage's 4 fixed destination cards become one "Plan my road trip" CTA, with a clearly separate "Just browse cars" escape hatch next to it. |
| Post-pitch outcome | Primary "Book this car" → real checkout, car preselected. Secondary, optional "₹49 detailed PDF" → existing Razorpay + Claude pipeline, repointed at free-text destinations. |
| Wizard shape | Single dynamic screen — sections reveal progressively, no page reloads/multi-step routing. |

## Architecture

```
Homepage: "Plan my road trip" (→ /plan) | "Just browse cars" (→ /cars, unchanged)

/plan (one page, sections reveal as data resolves):
  1. Destination text input (free text)
       ↓ debounced ~500ms after typing stops
  2. GET /plan/destination-check?q=... — geocode + distance/drive-time via
     Google Maps; rejects/warns on infeasible input (not found, too far,
     outside India)
       ↓ on success
  3. GET /plan/suggest-car — deterministic category rules + real inventory
     search → one real, bookable car
  4. Price estimate (client-computed): car.dailyRate × days + fuel estimate
     (distance ÷ mileage × fuel price) + flat toll placeholder + estimated
     stay cost (from hotel price level × nights). `days`/`nights` default
     from a distance-based guess (e.g. 2 days under ~300km, 3-4 beyond that)
     and are editable by the guest, recalculating the estimate live.
  5. GET /plan/hotels — Google Places Nearby Search near the destination,
     fetched in parallel with step 3 (both only need lat/lng)
       ↓
  6. CTA row: "Book this car" (→ real checkout, car + dates prefilled) |
     "Get the ₹49 day-by-day PDF" (existing modal → Razorpay → Claude
     pipeline, unchanged except destination is now free text)
```

Booking itself is unchanged — the planner is a new front door that ends in
either the existing checkout flow or the existing (repurposed) ₹49 pipeline.

## Components

**Backend — new:**
- `GET /plan/destination-check?q=<text>` — geocodes via Google Maps
  Geocoding API. Returns `{ valid, lat, lng, distanceKm, driveTimeMin,
  placeName }` or a rejection reason. The feasibility guardrail for free-text
  input lives here, server-side.
- `GET /plan/suggest-car?distanceKm=&lat=&lng=` — wraps the existing
  `searchAvailableCars` service function (already used by the AI's
  `search_available_cars` tool) with deterministic category rules (e.g.
  longer/hillier routes prefer SUV; shorter/flatter prefer sedan/hatchback
  for mileage). Always returns a real, currently-bookable car or an honest
  "no exact match, here's what's available" fallback — never invents one.
- `GET /plan/hotels?lat=&lng=` — Google Places API Nearby Search for
  lodging near the destination. Cached ~24h (Places is a metered/billed API
  and results don't change fast).

**Backend — changed:**
- `itinerary.routes.ts`: `POST /itineraries/unlock`'s `destination` field
  becomes free text instead of one of the 4 `ITINERARY_DESTINATIONS` keys;
  validation reuses the `/plan/destination-check` geocode logic instead of
  the fixed dictionary lookup.

**Frontend — new:**
- `app/plan/page.tsx` — the single dynamic screen.
- `PlanDestinationInput.tsx`, `PlanCarSuggestion.tsx`,
  `PlanPriceEstimate.tsx`, `PlanHotelSuggestions.tsx` — one focused
  component per section, composed by the page.

**Frontend — changed:**
- `app/page.tsx`: the `ROAD_TRIPS` fixed-card section is replaced by one
  "Plan my road trip" CTA, placed next to the existing car-browsing path.

**Frontend — unchanged:**
- `app/itineraries/[id]/page.tsx` (the ₹49 PDF result page) — same page,
  just fed a free-text destination now.

## Error handling

- Geocoding failure/timeout → inline error under the input; no silent
  fallback to a wrong location.
- No car matches the suggestion rules in that city → falls back to "best
  available car in your city" with honest copy, never an empty state.
- Places API failure/empty result → hotel section shows "Hotel suggestions
  unavailable right now"; price estimate drops the stay-cost line and is
  labeled as partial (car + fuel/toll only) rather than blocking.
- Every section's data fetch is independent — one section failing never
  blocks another from rendering, matching the parallel/progressive-reveal
  shape in Architecture.

## Testing

- Backend: unit tests (Vitest, same pattern as the existing money-path
  suite) for the car-suggestion rule function (pure, deterministic) and the
  price-estimate calculator (pure math).
- Geocoding/Places calls are mocked in tests — no real external API calls in
  CI, same stub pattern already used for Razorpay/telematics elsewhere in
  this repo.
- Manual pre-ship check: enter a real destination, confirm a real fleet car
  appears, confirm the price math is sane, confirm "Book this car" lands on
  that car's real checkout page with dates prefilled.

## Explicitly out of scope for this version

- Live/bookable hotel reservations (Places gives suggestions/info only, not
  booking).
- Multi-city or multi-stop itineraries — single destination only.
- Editing the suggested car (guest can go "Book this car" or fall through to
  normal car search/browse; no in-planner car swap UI in v1).
