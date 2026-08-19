# Feature Specification: Ziyam SelfDrive Mobile App (Renter/Customer)

**Feature Branch**: `001-flutter-renter-app`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Build a full mobile app for renters/customers, the mobile counterpart to the existing web app, talking to the same backend. Scope: auth, fleet browsing, booking flow, payment, AI-generated trip itineraries (unlock, pay, generate, view), and profile/KYC status. Host, Agent, and Admin surfaces stay web-only. Bold, high-contrast, automotive-grade design matching the existing brand — no generic app-template styling."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover the fleet on mobile (Priority: P1)

A prospective renter installs the app, creates an account (or logs in with an account they already
use on the website), and browses available cars by category and by search — the same fleet they'd
see on the website, now on their phone.

**Why this priority**: Nothing else in this app is reachable without an account, and browsing is the
first value a renter gets — it's useful on its own even before a booking is made (comparing cars,
checking prices) and is the minimum slice that makes the app worth having installed.

**Independent Test**: Fresh install → sign up → search a category → open a car's detail page and see
its price, specs, and availability. Delivers value (fleet discovery) with no other story implemented.

**Acceptance Scenarios**:

1. **Given** a new user with no account, **When** they complete sign-up, **Then** they land on the
   fleet browse screen already authenticated.
2. **Given** a returning user who already has a web account, **When** they log in with the same
   credentials on mobile, **Then** they reach the same account (bookings, profile) as on the website.
3. **Given** the browse screen, **When** the user searches or filters by category, **Then** only
   matching, currently-listed cars appear, each showing price and instant-book vs request-to-book
   status.

---

### User Story 2 - Book and pay for a car (Priority: P2)

A logged-in renter picks a car, chooses pickup/drop-off dates, reviews the price and security-deposit
terms, and completes payment to reserve it.

**Why this priority**: This is the core transaction the whole app exists to enable; it depends on
Story 1 (must be able to find a car first) but delivers the platform's primary value once it works.

**Independent Test**: With an account and a car already found, select dates, confirm price/deposit,
pay, and land on a confirmed (or pending-approval) booking — independently demonstrable once Story 1
exists.

**Acceptance Scenarios**:

1. **Given** a car with available dates, **When** the renter selects a valid pickup/drop-off range,
   **Then** the app shows the computed price and the security-deposit amount before asking for
   payment.
2. **Given** an instant-book car, **When** payment succeeds, **Then** the booking is immediately
   confirmed and visible in the renter's bookings list.
3. **Given** a request-to-book car, **When** payment/hold succeeds, **Then** the booking shows as
   pending host approval rather than confirmed.
4. **Given** two renters attempting to book the same car for overlapping dates at nearly the same
   time, **When** both submit, **Then** only one booking succeeds and the other is told the dates are
   no longer available — never both.
5. **Given** a payment that fails or times out, **When** this happens, **Then** no booking is created
   and the renter is told payment did not go through, with dates released back to availability.

---

### User Story 3 - Get an AI-generated trip itinerary (Priority: P3)

A renter planning a trip pays a small fee to unlock a personalized, AI-generated itinerary for their
route/destination, and can revisit it afterward without paying again.

**Why this priority**: A valuable, revenue-generating feature already proven on the website; porting
it to mobile extends its reach but the app is still useful (Stories 1–2) without it.

**Independent Test**: From a booking or a standalone trip-planning entry point, pay to unlock, wait
for generation, and view the resulting itinerary; reopening it later shows the same content without
a repeat charge.

**Acceptance Scenarios**:

1. **Given** an unpaid itinerary offer, **When** the renter pays, **Then** generation starts and the
   renter sees a clear "generating" state rather than a blank or frozen screen.
2. **Given** a successfully generated itinerary, **When** the renter reopens the app later, **Then**
   the same itinerary content is shown immediately, with no new charge and no regeneration.
3. **Given** payment succeeds but generation fails (e.g. a transient error), **When** this happens,
   **Then** the renter's paid unlock is preserved and they can retry generation without paying again.

---

### User Story 4 - Manage profile and see KYC status (Priority: P4)

A logged-in renter views and edits their profile details and can see whether their KYC (identity)
verification is pending, verified, or rejected — without ever seeing anyone's raw government ID
numbers, including their own, in plain form.

**Why this priority**: Necessary for account upkeep and trust/compliance, but not something a renter
touches every session — lowest priority without reducing its correctness requirements.

**Independent Test**: Open profile, edit a field (e.g. phone number) and see it persist; open KYC
status and see a verification state without any unmasked ID number on screen.

**Acceptance Scenarios**:

1. **Given** an existing profile, **When** the renter edits an editable field and saves, **Then** the
   change persists and is reflected next time the profile is opened.
2. **Given** a renter with an uploaded ID document, **When** they view their KYC status, **Then**
   they see a verification state (pending/verified/rejected) and never the raw document number.

---

### Edge Cases

- What happens when the app is opened with no network connectivity? Browsing, booking, and itinerary
  screens must show a clear offline/error state rather than an infinite spinner or a crash, and any
  in-progress form input must not be silently lost.
- What happens if a renter's KYC is not yet verified when they try to book? They may still browse and
  submit a booking, but a booking may be held pending verification rather than silently confirmed
  (see Assumptions).
- What happens if a renter tries to reach another renter's booking, itinerary, or profile data (e.g.
  by guessing an ID)? Access must be denied — a renter only ever sees their own data.
- What happens if payment succeeds but the confirmation callback is delayed or dropped? The renter
  must eventually see the correct final state (confirmed/pending/failed) rather than being stuck on a
  "processing" screen indefinitely, and must not be double-charged if they retry.
- What happens if a renter starts a booking or itinerary purchase and backgrounds/kills the app mid-
  payment? On return, they must see the true current state of that booking/itinerary, not a stale or
  duplicated one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a new user create a Customer account and remain authenticated across
  app restarts until they explicitly log out or their session expires.
- **FR-002**: System MUST let a Customer who already has a website account log in with the same
  credentials and reach the same underlying account (not a separate mobile identity).
- **FR-003**: System MUST let a Customer browse the fleet by category and by free-text search,
  showing only currently listed, real availability and pricing — the same fleet data the website
  shows, not a separate mobile catalog.
- **FR-004**: System MUST show, for each car, whether it is instant-book or request-to-book, and its
  price for the dates the customer is considering.
- **FR-005**: System MUST let a Customer select pickup/drop-off dates and see the total price and
  security-deposit amount before being asked to pay.
- **FR-006**: System MUST process booking payment (and deposit hold) through the platform's existing
  payment gateway relationship, and MUST NOT create a confirmed booking until payment succeeds.
- **FR-007**: System MUST prevent any two overlapping bookings from being confirmed for the same car
  and date range, even when submitted concurrently.
- **FR-008**: System MUST release a payment/deposit hold and the held dates if payment fails, times
  out, or the customer cancels before confirmation.
- **FR-009**: System MUST let a Customer pay to unlock a personalized AI-generated trip itinerary and
  MUST persist the generated result so it can be revisited later without a repeat charge.
- **FR-010**: System MUST preserve a paid itinerary unlock even if generation itself fails, and MUST
  let the customer retry generation without being charged again.
- **FR-011**: System MUST let a Customer view and edit their own profile information.
- **FR-012**: System MUST show KYC verification status (pending/verified/rejected) without ever
  displaying unmasked government ID numbers or full payment card details anywhere in the app.
- **FR-013**: System MUST restrict every screen and action in this app to the authenticated
  Customer's own data — no customer can view or act on another customer's bookings, itinerary,
  profile, or KYC status.
- **FR-014**: System MUST present a clear, non-crashing state when the device is offline or a request
  fails, and MUST NOT silently discard data the customer has already entered into a form.

### Key Entities

- **Customer Account**: A renter's identity — profile details, credentials, KYC verification state.
  Shared with the existing website account system, not a mobile-only identity.
- **Vehicle Listing**: A bookable car — make/model, pricing (including any weekday/weekend/hourly
  tiers), instant-book vs request-to-book flag, current availability.
- **Booking**: A reservation of a Vehicle Listing for a date range by a Customer — price, deposit
  amount, payment/hold state, and confirmation status (confirmed / pending approval / cancelled).
- **Itinerary**: A paid, AI-generated trip plan tied to a Customer (and typically a Booking/trip) —
  unlock/payment state and the generated content itself, persisted once generated.
- **KYC Record**: A Customer's identity-verification state and uploaded document status — surfaced
  only as a verification state, never as raw document numbers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new customer can go from first app open to a confirmed instant-book reservation in
  under 5 minutes.
- **SC-002**: Fleet search/category results appear in under 2 seconds on a typical mobile connection.
- **SC-003**: Zero double-bookings occur for the same car/date range under concurrent booking load —
  verified by deliberately submitting overlapping requests in testing.
- **SC-004**: At least 90% of customers who pay for an itinerary see the generated content within 30
  seconds of payment confirmation.
- **SC-005**: A review of every screen that touches customer or KYC data finds zero instances of an
  unmasked government ID number or full payment card number.
- **SC-006**: Customers can complete a profile edit and see it persisted in under 10 seconds.

## Assumptions

- Customer authentication and account data are shared with the existing website — this app does not
  introduce a second, separate customer identity system.
- Fleet, pricing, and availability shown on mobile reflect the same underlying listings the website
  shows; this feature does not redefine what a listing or a price is.
- The Host, Agent, and Admin sides of the platform remain website-only; this app is Customer-facing
  only, with no role-switching inside it.
- Payment processing reuses the platform's existing gateway relationship rather than introducing a
  new payment provider for mobile specifically.
- The AI itinerary experience mirrors the unlock → pay → generate → view pattern already live on the
  website, extended to mobile rather than redesigned.
- **Corrected during implementation** (was originally assumed as "held pending" — actual backend
  behavior found in `booking.routes.ts:122-132` is stricter): a Customer must have both
  `isKycVerified` and `isDrivingLicenseVerified` true *before* `POST /booking` succeeds at all — an
  unverified customer gets a 403 with `code: 'KYC_REQUIRED'` or `code: 'DRIVING_LICENSE_REQUIRED'`
  and cannot create the booking in the first place, rather than creating it in a pending state.
  Story 2's checkout screen must handle these two error codes distinctly (route the customer to
  finish that verification step) rather than showing a generic payment error.
- "Live Trip Handover & Tracking" (in-trip live location, handover checklist) is a separate, parallel
  feature and is explicitly out of scope here even though it will eventually touch the renter mobile
  experience too.
