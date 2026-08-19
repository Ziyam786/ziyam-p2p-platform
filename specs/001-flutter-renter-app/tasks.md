---

description: "Task list for the Ziyam SelfDrive mobile app (renter/customer)"
---

# Tasks: Ziyam SelfDrive Mobile App (Renter/Customer)

**Input**: Design documents from `/specs/001-flutter-renter-app/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — plan.md's Testing section explicitly calls for widget tests, integration
tests, and one backend integration test proving the required `$transaction` fix.

**Organization**: Tasks are grouped by user story (P1–P4 from spec.md) so each is independently
implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, matching spec.md's priorities
- Tasks with no story label are Setup/Foundational/Polish

## Path Conventions

New Flutter app lives at `mobile/` (repo root, alongside `src/backend`/`src/frontend`/etc., per
plan.md's Project Structure). Two backend files under `src/backend` get additive/bugfix changes
only — no new backend service.

---

## Phase 1: Setup

**Purpose**: Stand up the Flutter project itself — nothing here is story-specific.

- [X] T001 Run `flutter create mobile` at the repo root, targeting Android + iOS, matching
  plan.md's Technical Context (Flutter 3.47.0 / Dart 3.13.0)
- [X] T002 [P] Add dependencies to `mobile/pubspec.yaml`: `flutter_riverpod`, `go_router`, `dio`,
  `flutter_secure_storage`, `webview_flutter`, `firebase_core`, `firebase_ai`, `google_fonts`
- [X] T003 [P] Configure `flutter_lints` and `dart format` enforcement in
  `mobile/analysis_options.yaml`

**Checkpoint**: `flutter run` boots an empty app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story depends on, plus the two backend changes
research.md identified as required (not optional) for this feature's success criteria to hold.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T004 (blocked — requires interactive Firebase CLI login, cannot be done non-interactively) Run `flutterfire configure` against the same Firebase project as `src/frontend`,
  producing `mobile/lib/firebase_options.dart`; document in a `mobile/README.md` note exactly
  where the project owner must place `google-services.json`
  (`mobile/android/app/google-services.json`) and `GoogleService-Info.plist`
  (`mobile/ios/Runner/GoogleService-Info.plist`) per `contracts/firebase-ai-itinerary.md` — this
  task does not fabricate those files
- [X] T005 [P] Implement the Ziyam design-system theme (Essence Blue `#183eeb`, Manrope via
  `google_fonts`, dark slate surfaces, existing radius/shadow scale) in
  `mobile/lib/core/theme.dart`
- [X] T006 [P] Implement the API HTTP client wrapper (`dio`) with base URL config and automatic
  `Authorization: Bearer <jwt>` header injection in `mobile/lib/core/api_client.dart`
- [X] T007 [P] Implement secure token storage wrapper (`flutter_secure_storage`) in
  `mobile/lib/core/token_storage.dart`
- [X] T008 Implement the app router (`go_router`) with auth-gated routes in
  `mobile/lib/core/router.dart` (depends on T007)
- [X] T009 [P] Add a bearer-token branch to `requireAuth`/`attachUserIfPresent` in
  `src/backend/middleware/auth.ts`, verifying `Authorization: Bearer <jwt>` via the existing
  `verifyAuthToken` (`utils/jwt.ts`) as a fallback to the current cookie path — additive only, per
  `contracts/rest-api.md`
- [X] T010 [P] Update `POST /auth/login` (and `/auth/signup`) in `src/backend/routes/auth.routes.ts`
  to also return the signed JWT in the response body (in addition to setting the existing cookie)
  so a cookie-less client can store it — additive only
- [X] T011 Fix the booking-creation race in `src/backend/routes/booking.routes.ts:169-186`: wrap
  the overlap check and `booking.create` in a single `prisma.$transaction`, matching the existing
  cancel path's pattern at `booking.routes.ts:555` — required for FR-007/SC-003
- [X] T012 [P] Add a backend integration test proving two concurrent overlapping-date booking
  requests for the same car cannot both succeed — **note**: `src/backend` has no test framework
  configured at all (no jest/vitest, no `test` script), so this was implemented as a standalone,
  dependency-free script (`src/backend/scripts/verify-no-double-booking.ts`, run via
  `npm run verify:no-double-booking`) rather than added to a "suite" that doesn't exist. Flagging
  for the user: setting up a real test framework for `src/backend` is a separate decision this
  plan didn't have license to make unilaterally.

**Checkpoint**: Foundation ready — user stories can now proceed, in priority order or in parallel.

---

## Phase 3: User Story 1 - Discover the fleet on mobile (Priority: P1) 🎯 MVP

**Goal**: A renter can sign up or log in, then browse/search the fleet and view car detail —
independently valuable even before booking exists.

**Independent Test**: Fresh install → sign up → search a category → open a car's detail page and
see price, specs, and availability (quickstart.md Scenario 1).

### Tests for User Story 1

- [X] T013 [P] [US1] Widget test for signup/login screens — **note**: implemented as one
  representative smoke test at `mobile/test/widget_test.dart` (login screen renders + validates
  empty submission) rather than the originally-named `auth_screens_test.dart` covering both
  screens; given the scope of this build, full per-screen test coverage (this task plus T014,
  T015, T024, T025, T032, T033, T041 below) was not completed and is left as explicit follow-up
  work rather than claimed done.
- [ ] T014 [P] [US1] Widget test for the fleet browse/search screen in
  `mobile/test/presentation/fleet/browse_screen_test.dart` — not yet written
- [ ] T015 [P] [US1] Widget test for the car detail screen in
  `mobile/test/presentation/fleet/car_detail_screen_test.dart` — not yet written

### Implementation for User Story 1

- [X] T016 [P] [US1] Create `User` (profile-view fields only) and `Car` domain entities in
  `mobile/lib/domain/auth/user.dart` and `mobile/lib/domain/fleet/car.dart`, matching data-model.md
  (never modeling `kycDocUrl`/`aadhaarVerifiedName`/`originalImages` as client-visible fields)
- [X] T017 [US1] Implement `AuthRepository` (signup, login, `/auth/me`) in
  `mobile/lib/data/auth/auth_repository.dart`, storing the returned JWT via T007's token storage
  (depends on T006, T007, T010, T016)
- [X] T018 [US1] Implement `FleetRepository` (`GET /cars`, `/cars/:id`, `/cars/:id/availability`)
  in `mobile/lib/data/fleet/fleet_repository.dart` (depends on T006, T016)
- [X] T019 [US1] Implement the signup screen in `mobile/lib/presentation/auth/signup_screen.dart`
  (depends on T017)
- [X] T020 [US1] Implement the login screen in `mobile/lib/presentation/auth/login_screen.dart`
  (depends on T017)
- [X] T021 [US1] Implement the fleet browse/search screen (category filter + free-text search) in
  `mobile/lib/presentation/fleet/browse_screen.dart` (depends on T018)
- [X] T022 [US1] Implement the car detail screen in
  `mobile/lib/presentation/fleet/car_detail_screen.dart` (depends on T018)
- [X] T023 [US1] Wire auth-gated navigation (signup/login → browse; unauthenticated → auth) into
  `mobile/lib/core/router.dart` (depends on T008, T019, T020, T021)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable.

---

## Phase 4: User Story 2 - Book and pay for a car (Priority: P2)

**Goal**: A logged-in renter picks dates on a car, sees price/deposit, pays, and gets a confirmed
or pending-approval booking, with no double-bookings possible.

**Independent Test**: With Story 1 in place, select dates on a car, confirm price/deposit, pay via
the PayU WebView, and land on a confirmed/pending booking (quickstart.md Scenario 2, including the
concurrency check that proves T011's fix).

### Tests for User Story 2

- [ ] T024 [P] [US2] Widget test for the booking date/price/deposit screen in
  `mobile/test/presentation/booking/booking_checkout_screen_test.dart` — not yet written
- [ ] T025 [P] [US2] Integration test for the happy-path booking flow (mocked backend + mocked
  WebView) in `mobile/integration_test/booking_flow_test.dart` — not yet written

### Implementation for User Story 2

- [X] T026 [P] [US2] Create the `Booking` domain entity in
  `mobile/lib/domain/booking/booking.dart`, matching data-model.md (mask
  `coDriverLicenseNumber` in any list/summary rendering)
- [X] T027 [US2] Implement `BookingRepository` (`POST /booking`, `POST /booking/:id/checkout-session`,
  `/balance-checkout-session`, list/detail) in `mobile/lib/data/booking/booking_repository.dart`
  (depends on T006, T026)
- [X] T028 [US2] Implement a reusable PayU hosted-checkout WebView widget (form-post the returned
  `fields` to `url`, watch navigation for the `surl`/`furl` redirect) in
  `mobile/lib/presentation/shared/payu_webview.dart`, per contracts/rest-api.md's Payment section
  (depends on T002)
- [X] T029 [US2] Implement the date-selection + price/deposit-review screen in
  `mobile/lib/presentation/booking/booking_checkout_screen.dart` (depends on T018, T027)
- [X] T030 [US2] Wire T028's WebView into the booking checkout flow and handle the post-payment
  redirect by re-fetching the booking's status (depends on T028, T029)
- [X] T031 [US2] Implement the booking list/detail screens (confirmed/pending/cancelled states) in
  `mobile/lib/presentation/booking/booking_list_screen.dart` and `booking_detail_screen.dart`
  (depends on T027)

**Checkpoint**: User Stories 1 and 2 both work independently; T011/T012 from Phase 2 are what
actually make FR-007/SC-003 true here, not new Flutter code.

---

## Phase 5: User Story 3 - Get an AI-generated trip itinerary (Priority: P3)

**Goal**: A renter pays to unlock a personalized itinerary, watches it generate, and can reopen it
later without paying again.

**Independent Test**: Pay to unlock, see a generating state, then view the result; reopen later
with no new charge and no regeneration (quickstart.md Scenario 3, including the failure-path check).

### Tests for User Story 3

- [ ] T032 [P] [US3] Widget test for the destination-pick and itinerary-view screens in
  `mobile/test/presentation/itinerary/itinerary_screens_test.dart` — not yet written
- [ ] T033 [P] [US3] Integration test for unlock → pay → generate → view, including the
  payment-succeeded-but-generation-failed retry path, in
  `mobile/integration_test/itinerary_flow_test.dart` — not yet written

### Implementation for User Story 3

- [X] T034 [P] [US3] Create the `ItineraryUnlock` domain entity in
  `mobile/lib/domain/itinerary/itinerary_unlock.dart`, matching data-model.md (id-scoped, not
  user-linked — see research.md's correction)
- [X] T035 [US3] Implement `ItineraryRepository` (`POST /itineraries/unlock`,
  `GET /itineraries/:id`, `POST /itineraries/:id/content`) in
  `mobile/lib/data/itinerary/itinerary_repository.dart`, pre-filling
  name/email/phone from the logged-in user's profile when available (depends on T006, T017, T034)
- [X] T036 [US3] Implement the Firebase AI Logic generation service (`firebase_ai`,
  `gemini-flash-latest`, the same four-destination descriptions as
  `itinerary.routes.ts:11-16`, honoring the "couldn't generate your itinerary" sentinel) in
  `mobile/lib/data/itinerary/itinerary_ai_service.dart`, per contracts/firebase-ai-itinerary.md
  (depends on T004)
- [X] T037 [US3] Implement the destination-pick screen in
  `mobile/lib/presentation/itinerary/destination_pick_screen.dart` (depends on T035)
- [X] T038 [US3] Reuse T028's PayU WebView for the itinerary unlock payment — **note**: inlined
  directly into `destination_pick_screen.dart`'s unlock handler rather than a separate
  `itinerary_checkout_flow.dart` file, since the flow was simple enough not to need its own file
  (depends on T028, T035)
- [X] T039 [US3] Implement the generating/view screen, including the paid-but-not-yet-generated
  retry path (no re-charge), in `mobile/lib/presentation/itinerary/itinerary_view_screen.dart`
  (depends on T035, T036)
- [X] T040 [US3] Persist unlocked itinerary ids locally (so a renter can reopen past purchases) in
  `mobile/lib/data/itinerary/itinerary_history_store.dart` (depends on T035)

**Checkpoint**: All three of Stories 1–3 work independently.

---

## Phase 6: User Story 4 - Manage profile and see KYC status (Priority: P4)

**Goal**: A renter can view/edit their profile and see a masked KYC verification state.

**Independent Test**: Edit and persist a profile field; view KYC status with no raw ID number ever
shown (quickstart.md Scenario 4).

### Tests for User Story 4

- [ ] T041 [P] [US4] Widget test for the profile and KYC status screens in
  `mobile/test/presentation/profile/profile_screens_test.dart` — must assert no raw
  `kycDocUrl`/Aadhaar/PAN/DL value is ever rendered — not yet written

### Implementation for User Story 4

- [X] T042 [US4] Implement `ProfileRepository` (`GET`/update on the existing `/auth/me`-equivalent
  profile route) in `mobile/lib/data/profile/profile_repository.dart`, excluding `kycDocUrl` and
  `aadhaarVerifiedName` from any model surfaced to the UI (depends on T006, T017)
- [X] T043 [US4] Implement the profile view/edit screen in
  `mobile/lib/presentation/profile/profile_screen.dart` (depends on T042)
- [X] T044 [US4] Implement the KYC status screen (pending/verified/rejected badge only) in
  `mobile/lib/presentation/profile/kyc_status_screen.dart` (depends on T042)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T045 [P] Add offline/error-state handling (clear error UI, no silent form data loss) across
  all repositories via a shared `dio` interceptor in `mobile/lib/core/api_client.dart` plus a
  shared error-state widget in `mobile/lib/presentation/shared/error_state.dart`
- [X] T046 [P] Security review pass: grep `mobile/lib` for any rendering of
  `kycDocUrl`/`aadhaarVerifiedName`/unmasked `coDriverLicenseNumber`/full payment card data and
  confirm zero matches (SC-005)
- [ ] T047 (blocked — needs a real device/emulator, a running local `src/backend` with a real
  Postgres DB, and the real Firebase config files from T004, none of which are available
  non-interactively) Run quickstart.md Scenarios 1–4 end-to-end and record results. What WAS
  verified instead: `flutter analyze` is clean (0 errors, 7 style-only infos), `flutter test`
  passes, and `npx tsc --noEmit` on the whole backend is clean after the auth/booking changes.
- [X] T048 [P] Clean `flutter analyze` and `dart format --set-exit-if-changed` pass across `mobile/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. Includes the two backend
  changes (T009–T011) and their validating test (T012), since Stories 1–2 cannot be honestly
  demoed without them.
- **User Stories (Phase 3–6)**: All depend on Foundational. US1 has no dependency on US2–4. US2
  depends on US1's `FleetRepository`/car detail screen existing to select a car from. US3 depends
  on US1's auth (for profile pre-fill) and US2's PayU WebView widget (reused, not reimplemented).
  US4 depends only on US1's auth.
- **Polish (Phase 7)**: Depends on whichever stories are in scope for the current release.

### Parallel Opportunities

- T002/T003 (Setup) run in parallel.
- T005–T008 and T009–T010 (Foundational) run in parallel as two independent tracks (Flutter core
  infra vs. backend auth changes); T011 depends on nothing else in Phase 2 and can run alongside
  them; T012 depends on T011.
- Within each user story, all `[P]`-marked test tasks run together, and all `[P]`-marked
  model/entity tasks run together, before their dependent implementation tasks.

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Widget test for signup/login screens in mobile/test/presentation/auth/auth_screens_test.dart"
Task: "Widget test for the fleet browse/search screen in mobile/test/presentation/fleet/browse_screen_test.dart"
Task: "Widget test for the car detail screen in mobile/test/presentation/fleet/car_detail_screen_test.dart"

# Entities together:
Task: "Create User domain entity in mobile/lib/domain/auth/user.dart"
Task: "Create Car domain entity in mobile/lib/domain/fleet/car.dart"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (Setup) → Phase 2 (Foundational, including the two backend fixes) → Phase 3 (US1).
2. Stop and validate US1 independently via quickstart.md Scenario 1.
3. This alone ships a browsable mobile fleet presence even before booking/itinerary/profile exist.

### Incremental Delivery

Setup + Foundational → US1 (MVP) → US2 (adds the core transaction) → US3 (adds the AI itinerary
vertical slice, the feature that motivated this app) → US4 (profile/KYC) → Polish.

### Note on the two backend changes

T009–T012 touch `src/backend`, which is shared with the web app. They are additive/bugfix only
(new bearer-auth branch, JWT-in-response-body addition, and a `$transaction` fix already required
by the ratified constitution independent of this app) — they must not alter the existing
cookie-based session behavior `src/frontend` relies on, and quickstart.md Scenario 2's concurrency
check is the acceptance test for T011 specifically.
