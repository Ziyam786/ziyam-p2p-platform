# Implementation Plan: Ziyam SelfDrive Mobile App (Renter/Customer)

**Branch**: `001-flutter-renter-app` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-flutter-renter-app/spec.md`

## Summary

A from-scratch Flutter mobile app giving renters/customers a native counterpart to the existing
`src/frontend` web app: sign up/log in, browse the fleet, book and pay for a car, buy and view an
AI-generated trip itinerary, and manage their profile/KYC status. It is a pure client of the
existing `src/backend` Express/Prisma API — no new backend service, no new database, and (per
Phase 0 research) only two small, additive backend changes: a bearer-token branch on `requireAuth`
so a cookie-less client can authenticate, and a `$transaction` fix on booking creation so this
feature's own no-double-booking success criterion is actually true.

## Technical Context

**Language/Version**: Dart 3.13.0 / Flutter 3.47.0 (stable channel — already installed on this
machine)

**Primary Dependencies**: `riverpod` (state management/DI), `go_router` (navigation),
`dio` (HTTP client), `flutter_secure_storage` (JWT storage), `webview_flutter` or
`flutter_inappwebview` (PayU hosted-checkout), `firebase_core` + `firebase_ai` (FlutterFire —
itinerary generation via Firebase AI Logic / Gemini `gemini-flash-latest`), `google_fonts`
(Manrope, matching the web design system)

**Storage**: N/A on-device beyond secure token storage and Riverpod-cached API responses — all
durable data (User, Car, Booking, ItineraryUnlock) lives in the existing PostgreSQL database via
`src/backend`; this app introduces no local database.

**Testing**: `flutter_test` (widget tests per screen), `integration_test` (happy-path booking and
itinerary flows against a mocked backend/WebView), plus one backend-side integration test (in the
existing `src/backend` test setup) proving the fixed booking `$transaction` rejects a concurrent
overlapping booking — see research.md Testing Approach.

**Target Platform**: Android + iOS (Flutter single codebase)

**Project Type**: Mobile app (Option 3 below) — new `mobile/` Flutter project alongside the
existing `api`-equivalent (`src/backend`)

**Performance Goals**: Fleet search/category results in <2s on a typical mobile connection
(SC-002); itinerary content visible within 30s of payment confirmation for ≥90% of purchases
(SC-004) — both are network/AI-latency bound, not Flutter-rendering bound.

**Constraints**: Must reuse the existing backend API contracts as-is wherever they're sufficient
(confirmed sufficient for fleet browse/detail/availability, booking creation, PayU checkout,
itinerary unlock/content); the two backend changes identified in research.md are additive only and
must not alter the web app's existing cookie-based auth or CSRF behavior. No secrets committed to
the repo — Firebase platform config files are supplied directly by the project owner, not
generated or inlined by this plan.

**Scale/Scope**: 4 user stories (P1–P4), roughly 12–15 screens (auth ×2, browse, search, car
detail, booking checkout ×2 incl. WebView, booking list/detail, itinerary destination-pick, paywall/
WebView, itinerary view, profile, KYC status), 2 required backend changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|---|---|---|
| I. Fixed Stack, One Backend | ✅ Pass | Flutter + the existing Express/Prisma API; no parallel backend, no new ORM |
| II. Zero Raw PII Exposure | ✅ Pass | data-model.md explicitly excludes `kycDocUrl`, `aadhaarVerifiedName`, and masks `coDriverLicenseNumber` in list views; validation stays server-side (existing Zod usage in `src/backend`, unchanged by this plan) |
| III. Transactional Integrity | ⚠️ Pre-existing violation found, remediation included | `booking.routes.ts:169-186` lacks a `$transaction` around the overlap check today. This plan's Phase 2 tasks fix it (matching the existing `cancel` path's pattern) rather than treating it as a pre-existing exception — required for FR-007/SC-003 to be true, not optional polish. |
| IV. Role-Based Access Control | ✅ Pass | Customer-only app; all endpoints already scope by `customerId`/session; new bearer-auth branch verifies the same JWT, doesn't weaken scoping |
| V. Design System Fidelity | ✅ Pass | Flutter theme ports the existing tokens (Essence Blue `#183eeb`, Manrope via `google_fonts`, dark slate ops-style surfaces where used) rather than inventing a palette |
| VI. Secrets Never Leave Secure Storage | ✅ Pass | Firebase config files added directly to the repo by the project owner once the skeleton exists; no service-account or API key handled by this plan |

**Re-check after Phase 1 design**: unchanged — Phase 1 artifacts (data-model.md, contracts/,
quickstart.md) introduced no new entities, endpoints, or secrets beyond what's captured above.
Gate: **PASS** (with the Principle III fix tracked as a required task, not an accepted violation).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Existing, unchanged except for the two additive fixes called out below
src/backend/
├── middleware/auth.ts        # + bearer-token branch (additive)
├── routes/booking.routes.ts  # + $transaction fix on create (bug fix)
└── ...                        # everything else consumed as-is (see contracts/)

# New — this feature
mobile/
├── lib/
│   ├── main.dart
│   ├── firebase_options.dart          # generated by `flutterfire configure`
│   ├── core/                          # theme (design tokens), router, http client, secure storage
│   ├── data/                          # API clients + DTOs, one per domain (auth, fleet, booking, itinerary, profile)
│   ├── domain/                        # entities + use-cases, mirrors data-model.md
│   └── presentation/
│       ├── auth/                      # signup, login
│       ├── fleet/                     # browse, search, car detail
│       ├── booking/                   # date/price/deposit, WebView checkout, booking list/detail
│       ├── itinerary/                 # destination pick, WebView checkout, generating/view states
│       └── profile/                   # profile edit, KYC status
├── test/                               # flutter_test widget tests, one dir per presentation/ area
├── integration_test/                   # booking happy-path, itinerary happy-path
├── android/app/                        # google-services.json goes here (supplied by owner)
└── ios/Runner/                         # GoogleService-Info.plist goes here (supplied by owner)
```

**Structure Decision**: Mobile + API (Option 3) — a new top-level `mobile/` Flutter project
alongside the existing `src/backend` API and the existing `src/frontend`/`src/admin`/`src/agent`
Next.js apps, which this feature does not touch. `src/backend` gets exactly two additive/bugfix
changes (see Constitution Check) rather than a new service.

## Complexity Tracking

> No new violations introduced by this plan's own additions — Principle III's pre-existing gap is
> a fix, not an added complexity, and is tracked as a task rather than justified here.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| n/a | n/a | n/a |
