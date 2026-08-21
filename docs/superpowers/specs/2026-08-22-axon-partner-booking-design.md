# Axon Partner-Booking Path — Design

## Context

Axon Network is Ziyam's B2B supply-feed API for external fleet aggregators
(Zoomcar/Revv-style partners): `GET /axon/search` (live inventory),
`POST /axon/pricing/quote` (fare breakdown via `AxonPricingEngine`, a pure
calculator with no DB access), and `GET /axon/calendar/:carId/feed.ics` (iCal
sync). All three are read-only. Auth is a static `X-Axon-Api-Key` header
checked with `crypto.timingSafeEqual` against a flat, comma-separated
`AXON_PARTNER_API_KEYS` env var — there is no partner identity anywhere in
the database, no name/company tracked per key, no usage logging.

The gap: a partner can search and get a quote, but cannot actually create a
booking through Axon — a real reservation still has to happen through
Ziyam's normal guest-facing flow. This design adds the missing write path,
plus the partner-identity model that write path depends on.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Who is the customer of record? | **The partner** (wholesale/reseller model) — Ziyam never sees or KYCs the individual end-renter. The partner is responsible for its own customer's identity/compliance on its own side. |
| Settlement | **Invoiced / net-terms.** Bookings accrue against the partner's account; no server-to-server payment-capture mechanism is built for v1. |
| Partner onboarding tooling | **Admin UI** to view partners (with booking/usage activity) and create new ones, generating an API key shown once. |
| Host payout timing | **Normal N+1 schedule**, identical to guest bookings — Ziyam fronts the host's share and collects from the partner later via invoice. A host should not have to care who booked their car; the credit-risk exposure is bounded because partners are relationship-managed, not anonymous signups. |
| Booking-write data model | **Reuse the existing `Booking` table** (new `axonPartnerId`/`source` fields) rather than a separate table — a separate table would either hide these bookings from the host dashboard (risking accidental double-listing) or require duplicating car-conflict-checking, host-dashboard, admin, and payout logic that already exists for `Booking`. |
| Quote-to-book consistency | **No stored quote.** Booking recomputes price fresh via the same `AxonPricingEngine.calculateFare()` at write time, using the car's *current* `dailyRate` from the DB (never a client-supplied rate) — avoids a new `AxonQuote` table and matches how the pricing engine is already documented as a pure, stateless calculator. |
| Host review step | **Auto-confirmed** (`BookingStatus.CONFIRMED`) immediately on creation — no manual host accept/reject. A real aggregator integration can't tolerate a host possibly rejecting a booking the partner's own end-customer already believes is confirmed; `/axon/search` already only returns available cars, so this matches the existing instant-book expectation of that surface. |

## Data model

New model:

```prisma
model AxonPartner {
  id            String   @id @default(uuid())
  name          String
  companyName   String
  contactEmail  String
  apiKeyHash    String   // bcrypt, same pattern as User.passwordHash — never store the raw key
  status        AxonPartnerStatus @default(ACTIVE)
  createdAt     DateTime @default(now())
  bookings      Booking[]
}

enum AxonPartnerStatus {
  ACTIVE
  SUSPENDED
}
```

`Booking` changes:

```prisma
model Booking {
  // ...existing fields...
  customerId    String?          // now nullable — was required
  customer      User?            @relation("CustomerBookings", fields: [customerId], references: [id])
  axonPartnerId String?
  axonPartner   AxonPartner?     @relation(fields: [axonPartnerId], references: [id])
  source        BookingSource    @default(GUEST)
}

enum BookingSource {
  GUEST
  AXON_PARTNER
}
```

Invariant enforced in application code (not a DB constraint Prisma can
express directly): exactly one of `customerId` / `axonPartnerId` is set,
matching `source`. Every existing query that currently assumes
`booking.customerId` is non-null (host dashboard trip lists, admin bookings
view, "my trips" for guests, notification/email sends keyed off the
customer) needs a pass to handle the `AXON_PARTNER` case — most of these
already branch on `booking.car.owner`/host fields and simply don't need to
touch `customerId` for a partner booking, but each call site needs a
one-line check, not a rewrite.

## Auth: moving off the plaintext env var

`axon.routes.ts`'s `requireAxonApiKey` currently does a `timingSafeEqual`
compare against `config.axon.partnerApiKeys` (a plain string array). New
version resolves an `AxonPartner` from the DB and compares the supplied key
against `apiKeyHash` using the same `hashPassword`/`comparePassword`
utilities already used for user passwords (`utils/password.ts` — audited
and confirmed sound in an earlier session). `requireAxonApiKey` becomes
async, and attaches the resolved partner as `req.axonPartner` for downstream
handlers (mirroring how `requireAuth` attaches `req.user`). A `SUSPENDED`
partner is rejected with 401, same as an invalid key — no signal to the
caller about *why*, consistent with not leaking auth information.

`AXON_PARTNER_API_KEYS` and `config.axon.partnerApiKeys` are removed once
this ships; no dual-read fallback period, since there are effectively zero
production partners on the current env-var scheme to migrate.

## Booking creation (`POST /axon/bookings`)

Request: `{ carId, pickupTime, dropTime }` (ISO datetimes) — no price field;
the caller doesn't get to assert its own price.

Flow:
1. `requireAxonApiKey` resolves `req.axonPartner` (must be `ACTIVE`).
2. Load the car; 404 if missing, 422 if `!isAvailable`, `!isBookable(car, ...)`
   (same photo-angle gate `AxonSupplyGateway.searchAvailableFleet` already
   applies), or `verificationStatus !== 'VERIFIED'`.
3. Re-check availability for the exact window, including the 2-hour
   sanitization buffer — extract the conflict query already inlined in
   `AxonSupplyGateway.searchAvailableFleet` into a reusable
   `AxonSupplyGateway.isCarAvailableForWindow(carId, pickupTime, dropTime)`,
   called from both `searchAvailableFleet` and this new endpoint, so a
   partner can't win a race between their search call and their book call
   without at least a fresh atomic check immediately before insert. 409 on
   conflict.
4. Compute price via `AxonPricingEngine.calculateFare({ dailyRate: car.dailyRate, pickupTime, dropTime })`.
5. Create the `Booking` row directly with `status: CONFIRMED`, `source: AXON_PARTNER`,
   `axonPartnerId`, `customerId: null`, `totalAmount` from the fare breakdown,
   `razorpayPaymentId: null` (no payment capture in this flow — see below).
6. `notify()` the host exactly as today, so their dashboard shows the trip
   and they know to hand over the car.
7. Response: booking id, confirmed status, and the fare breakdown.

## Payout — the one existing-code touchpoint that must change

Every payout checkpoint in `payoutEngine.ts` currently requires
`booking.razorpayPaymentId` to exist (there's no captured payment for an
invoiced partner booking). Each of those checks becomes: require
`razorpayPaymentId` **unless** `booking.source === 'AXON_PARTNER'`, in which
case the payout amount is computed directly from the booking's own recorded
`totalAmount`/split rather than "whatever Razorpay actually captured." This
is the only place existing payout logic needs a real branch — `assertPayoutEligible`
itself (bank + PAN + agreement) is unaffected and applies identically
regardless of booking source.

## Admin UI

New admin-app page listing `AxonPartner` rows (name, company, status,
booking count/volume) and a "New partner" form that POSTs to a new admin
route, generates a random API key server-side, stores only its hash, and
returns the raw key **once** in the response for the admin to copy —
consistent with how no other secret in this app is ever redisplayed.

## Out of scope (this design)

- Per-booking instant payment capture for partners (deferred; invoiced
  settlement covers v1).
- Partner-side webhooks/notifications on booking status changes.
- Per-partner rate limiting or usage-based billing.
- Any change to the individual-guest booking flow — this is additive only.
- Cancellation/modification of an Axon-sourced booking by the partner (not
  requested; a partner needing to cancel would go through support for now).
