# API Contracts: Ziyam SelfDrive Mobile App

Base URL: same `src/backend` Express API already used by `src/frontend` (existing `config.clientUrl`
/ API host config — no new service, no new base path).

## Auth (one additive change required — see research.md)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/signup` | none | Existing route, unchanged |
| POST | `/auth/login` | none | Existing route, unchanged; response sets `ziyam_session` cookie **and** (new) must also return the signed JWT in the response body so a cookie-less client can store it |
| GET | `/auth/me` | session cookie **or** `Authorization: Bearer <jwt>` (new branch in `requireAuth`) | Returns current `User` (masked per data-model.md) |

**Required backend change**: `requireAuth` / `attachUserIfPresent` (`src/backend/middleware/auth.ts`)
gains a second branch — if `Authorization: Bearer <jwt>` is present, verify it with the existing
`verifyAuthToken` (`utils/jwt.ts`) instead of reading `req.cookies[config.auth.cookieName]`. Cookie
path stays the default for browser clients; bearer path is additive only. `requireCsrfToken` is
unaffected — it already only fires when the session cookie is present (`csrf.ts:46`), so a
bearer-only mobile request never triggers it.

Flutter stores the returned JWT in `flutter_secure_storage` and sends
`Authorization: Bearer <jwt>` on every authenticated request. No refresh endpoint exists today
(flat 30-day token, matching the web app) — out of scope to add one here.

## Fleet (no backend changes — consume as-is)

| Method | Path | Auth | Response shape |
|---|---|---|---|
| GET | `/cars?city&category&transmission&fuelType&maxPrice&availableOnly&featured&q&sort` | none | `{success, count, data: Car[]}` |
| GET | `/cars/:id` | none | Car + reviews |
| GET | `/cars/:id/availability` | none | `{startDate, endDate, type: 'BOOKED'|'PAUSED', reason?}[]` |

`images[]` only — never request/render `originalImages`.

## Booking (one backend fix required — see research.md)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/booking` | bearer/cookie | `{carId, startTime, endTime, totalAmount, protectionPlan?, deliveryRequested?, promoCode?, coDriverRequested?, coDriverName?, coDriverLicenseNumber?}` | `{success, bookingId}` |
| POST | `/booking/:id/checkout-session` | bearer/cookie | — | `{success, data: {url, fields}}` (PayU hosted-checkout) |
| POST | `/booking/:id/balance-checkout-session` | bearer/cookie | — | Same shape, for balance/remaining-amount payment |
| (existing, unchanged) cancel | bearer/cookie | — | Already uses `$transaction` — the pattern the create-path fix should match |

**Required backend fix**: wrap the overlap check + `booking.create` in `booking.routes.ts:169-186`
inside a single `prisma.$transaction`, matching the existing cancel path's pattern
(`booking.routes.ts:555`). Response shape is unchanged by this fix — only its correctness under
concurrency changes.

## Itinerary (no backend changes — consume as-is, unauthenticated by design)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/itineraries/unlock` | none | `{destination, customerName, customerEmail, customerPhone}` | `{success, data: {id, url, fields}}` |
| GET | `/itineraries/:id` | none | — | `{success, data: ItineraryUnlock}` |
| POST | `/itineraries/:id/content` | none | `{generatedContent}` (80–50,000 chars) | `{success, data: ItineraryUnlock}` (409 if not yet `PAID`) |

Flutter pre-fills `customerName`/`customerEmail`/`customerPhone` from the logged-in user's profile
when available, but the endpoints themselves remain callable without auth, matching the web app.

## Payment (PayU hosted checkout — WebView, not a native SDK)

Both `/booking/:id/checkout-session` and `/itineraries/unlock` return `{url, fields}`. The Flutter
client:
1. Opens an in-app WebView.
2. Performs an HTML form POST to `url` with `fields` as form parameters (mirrors
   `src/frontend`'s hidden auto-submit form — `paymentGateway.ts:56-71`).
3. Watches WebView navigation for the `surl`/`furl` redirect target that
   `src/backend/routes/payuCallback.routes.ts` issues, closes the WebView, and re-fetches the
   booking/itinerary resource to read its now-updated `status`.

No backend change needed for payment itself — the contract is already transport-agnostic.
