# Research: Ziyam SelfDrive Mobile App (Renter/Customer)

## Decision: Platform & Architecture

- **Decision**: Flutter (Dart), single codebase targeting Android + iOS. State management:
  Riverpod, with a data/domain/presentation layering (`lib/data` for API clients & DTOs,
  `lib/domain` for entities/use-cases, `lib/presentation` for screens/widgets, organized by
  feature: `auth/`, `fleet/`, `booking/`, `itinerary/`, `profile/`).
- **Rationale**: Riverpod is the current standard for testable, compile-safe DI in Flutter without
  BuildContext-coupled state, and scales cleanly to five feature areas without a rewrite.
- **Alternatives considered**: Provider (simpler but weaker testability at this scope); Bloc
  (more ceremony than this feature set needs); plain `setState` (rejected — not viable past one
  screen).

## Decision: Auth contract — requires one small backend addition

- **Finding**: The existing backend (`src/backend/middleware/auth.ts:18`, `requireAuth`) reads
  the session JWT **only** from the `ziyam_session` httpOnly cookie
  (`src/backend/config/index.ts:32`). There is no `Authorization: Bearer` path today. The web
  frontend never touches the JWT directly (`src/frontend/lib/api.ts:36`, `credentials: 'include'`).
  Login writes the cookie server-side only (`auth.routes.ts:81-97`); there is no refresh token —
  it's a flat 30-day cookie, re-checked via `/auth/me`.
- **CSRF**: `requireCsrfToken` (`csrf.ts:44`) only activates when the `ziyam_session` cookie is
  present (`csrf.ts:46`) — a cookie-less bearer-token client self-exempts by construction, exactly
  as the existing code comment anticipates (`csrf.ts:36-43`). No CSRF work needed for mobile.
- **Decision**: Add a second, additive auth path to `requireAuth`/`attachUserIfPresent`: accept
  `Authorization: Bearer <jwt>` using the *same* `signAuthToken`/`verifyAuthToken` helpers already
  in `utils/jwt.ts`, falling back to the existing cookie path when no bearer header is present. The
  Flutter app authenticates via the existing login endpoints, receives the same signed JWT, and
  stores it in secure device storage (`flutter_secure_storage`) instead of a cookie jar, sending it
  as a bearer header on every request. **This is a required, additive backend change** — not a new
  endpoint, not a new auth scheme, and it does not touch `src/admin`/`src/agent`/host code.
- **Rationale**: Matches the constitution's "one backend, no parallel auth system" principle while
  giving a non-browser client a way to hold the same session; rejecting this would mean either (a)
  a WebView-based cookie jar hack for all authenticated calls (fragile, breaks native UX) or (b) a
  second, divergent auth system (explicitly disallowed).
- **Alternatives considered**: Have Flutter carry a full cookie jar and mimic a browser — rejected,
  brittle and fights the platform's native HTTP stack for no benefit since the JWT itself is
  already the real credential; a cookie is just its current-only transport.

## Decision: Car/listing & booking API — reuse as-is, with one required transaction fix

- **Finding**: `GET /cars` (filterable list), `GET /cars/:id`, `GET /cars/:id/availability`,
  `POST /booking` (auth, `{carId, startTime, endTime, totalAmount, ...}` → `{success, bookingId}`),
  `POST /booking/:id/checkout-session` (→ PayU hosted-checkout `{url, fields}`) already exist and
  are sufficient for Stories 1–2 with no new endpoints needed.
- **Gap found**: `booking.routes.ts:169-186` checks for overlapping bookings with a plain
  `findFirst` **not** wrapped in `prisma.$transaction`, before `booking.create` — a genuine race
  condition under concurrent requests for the same car/dates. This directly conflicts with the
  ratified constitution's Principle III (Transactional Integrity for Shared State) and with this
  feature's own FR-007/SC-003 (no double bookings, verified under concurrent load).
- **Decision**: Fix this as a required backend task in this plan — wrap the overlap-check +
  create in a single `prisma.$transaction` (with a `SELECT ... FOR UPDATE`-equivalent row lock via
  Prisma's transaction isolation, or a unique constraint fallback) — same shape already used
  correctly for cancellation at `booking.routes.ts:555`. This is a pre-existing bug, not something
  introduced by the mobile app, but the mobile app's success criteria cannot be honestly claimed
  met without fixing it, so it's in scope here rather than silently assumed away.
- **Alternatives considered**: Leave as-is and document as a known limitation — rejected; the
  constitution treats this as non-negotiable, and SC-003 is directly falsifiable otherwise.

## Decision: Itinerary + payment flow — WebView hosted-checkout, not a native SDK

- **Finding**: `POST /itineraries/unlock` and `POST /booking/:id/checkout-session` both return the
  same PayU hosted-checkout shape: `{success, data: {url, fields}}`. The existing web frontend
  completes payment via a hidden auto-submitting HTML form POST to that URL with those fields
  (`paymentGateway.ts:56-71`), not a JS SDK or iframe. PayU's callback redirects back to
  `config.clientUrl/...` (`payuCallback.routes.ts`).
- **Decision**: Flutter renders an in-app `WebView` (via `webview_flutter` or `flutter_inappwebview`)
  that performs the same POST-with-fields navigation, and the app watches the WebView's navigation
  events for the `surl`/`furl` redirect path to detect success/failure and close the WebView,
  exactly mirroring the web contract rather than introducing a native PayU SDK integration.
- **Rationale**: Matches "reuse the existing API contracts" — no backend change needed here at
  all, since the contract is already transport-agnostic (URL + form fields); only the client-side
  presentation differs (WebView vs. browser form submit).
- **Alternatives considered**: PayU mobile SDK — rejected for v1; it would require a second,
  divergent payment integration path server-side for no functional gain over the WebView approach,
  which needs zero backend changes.

## Decision: Firebase / itinerary generation — client-side Firebase AI Logic, matching the web app exactly

- **Finding**: `src/frontend/lib/firebase.ts:4-11` uses only the standard public web config
  (`apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId`, `vapidKey` for push
  only), sourced from `NEXT_PUBLIC_FIREBASE_*`. No Firebase App Check is enforced anywhere today.
- **Decision**: Run `flutterfire configure` against the same Firebase project once the app skeleton
  exists, producing `firebase_options.dart` plus the platform config files
  (`android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`) — **these files are
  supplied by the project owner directly into the repo/build environment once the skeleton is
  scaffolded, never pasted as text into a prompt or ticket**, matching the constitution's Principle
  VI. Itinerary generation uses the `firebase_ai` Flutter package against Gemini
  (`gemini-flash-latest`) via Firebase AI Logic, mirroring `generateRoadTripItinerary()`
  (`src/frontend/lib/firebase.ts:216-242`) field-for-field, then `POST`s the result to
  `/itineraries/:id/content` exactly as the web client does.
- **Rationale**: Zero new secrets, zero new backend surface — this is a straight port of an
  already-proven pattern.
- **Alternatives considered**: A server-side generation endpoint (backend calls Gemini via a
  service-account-authenticated Admin path) — rejected for v1; it would duplicate a working
  client-side pattern and introduce a new secret (a service-account-scoped AI call) with no stated
  requirement driving that added complexity.

## Correction: ItineraryUnlock is an unauthenticated, id-scoped resource — not user-linked

- **Finding**: `itinerary.routes.ts` has no `requireAuth` on any of its three routes, and
  `ItineraryUnlock` (`prisma/schema.prisma:1274-1287`) has no `customerId`/`userId` foreign key —
  only free-text `customerName`/`customerEmail`/`customerPhone` captured at unlock time. It is a
  guest-checkout-style product (a ₹49 destination road-trip guide for Ooty/Coorg/Chikmagalur/
  Gokarna) accessed purely by knowing its opaque `id`, the same model as a payment receipt link.
  It is **not** tied to a specific vehicle Booking today.
- **Correction to spec's Key Entities framing**: "Itinerary...tied to a Customer (and typically a
  Booking/trip)" overstated the current model. Treat it as-is: an anonymous, id-scoped purchase.
  For a logged-in Flutter user this plan pre-fills name/email/phone from their profile as a
  convenience, but does not add a new `customerId` column or auth requirement — that would be
  scope creep beyond what this feature asked for, and the unguessable-UUID access model is the
  same one already accepted in production for the web app. FR-013 ("no cross-customer visibility")
  is satisfied for the account-scoped entities (Booking, Profile, KYC — all genuinely tied to
  `customerId`/`User.id`) and does not apply to this guest-style resource any differently on
  mobile than it already does on web.

## Decision: Testing approach

- **Decision**: Flutter widget tests for the five core screens (browse, car detail, booking
  checkout, itinerary view, profile). One backend integration test proving the fixed
  `$transaction` booking path actually rejects a concurrent overlapping booking (this is the test
  that matters most for FR-007/SC-003 — it exercises the backend fix, not Flutter code). A Flutter
  integration test for the happy-path booking flow and the happy-path itinerary unlock→pay→generate
  flow, using a mocked backend/PayU WebView rather than live payment in CI.
- **Rationale**: Matches the constitution's transactional-integrity principle by testing the actual
  mechanism (backend transaction) rather than only testing that the UI "looks right."
