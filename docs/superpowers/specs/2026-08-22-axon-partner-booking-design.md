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

`User` gets one new field, for the RazorpayX payout mechanism described below:

```prisma
model User {
  // ...existing fields...
  razorpayxFundAccountId String? // cached RazorpayX fund_account_id, created once, reused for every subsequent payout
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

## Payout — a genuinely new mechanism, not a branch on an existing check

**Correction from the original draft of this section:** `executeBankTransfer`
calls Razorpay's `payments.transfer(razorpayPaymentId, ...)` — Razorpay
Route's mechanism for splitting a *specific, already-captured payment*
sitting in Ziyam's own Razorpay account out to a host's linked sub-account.
An invoiced Axon booking has no such payment to split from at all (the
partner pays via a periodic invoice, never through Razorpay), so this isn't
a one-line branch on `razorpayPaymentId` — it needs a real, separate payout
mechanism: **RazorpayX Payouts**, a standalone bank-transfer API (distinct
product from Razorpay Payments) that pays out of Ziyam's own RazorpayX
account balance directly, independent of any specific captured payment.

**External prerequisite (your action, not something I can do):** RazorpayX
requires its own account signup, KYC/activation, a funded balance to pay
out from, and (per Razorpay's docs) IP allowlisting for the API. This is
the same category of blocker as the Google Maps billing / Anthropic credits
situations — the code can be built and will be ready, but it cannot be
exercised end-to-end until the RazorpayX account exists and is funded.
Whether it uses the same `RAZORPAY_KEY_ID`/`SECRET` pair as existing
payment collection or a separate RazorpayX-specific key needs confirming
once the account exists.

**New service, `razorpayxPayoutService.ts`** (kept separate from
`razorpayPaymentHandler.ts` — collecting a guest's payment and disbursing a
host's payout are different products with different lifecycles, not one
responsibility):

- `getOrCreateFundAccount(host)`: creates a RazorpayX **Contact**
  (`POST /v1/contacts`, `type: 'vendor'`, `reference_id: host.id`) then a
  **Fund Account** (`POST /v1/fund_accounts`, `account_type: 'bank_account'`,
  using the host's *already Sandbox-verified* `bankAccountNumber`/`bankIfsc`/
  `bankNameAtBank`) — both calls are naturally idempotent per Razorpay's own
  docs (matching details return the existing record instead of erroring), so
  no local existence-check is needed before calling. The resulting
  `fund_account_id` is cached on a new `User.razorpayxFundAccountId String?`
  field so repeat payouts to the same host skip straight to the payout call.
- `createPayout(fundAccountId, amountRupees, ledgerId)`: `POST /v1/payouts`
  with `mode: 'IMPS'`, `purpose: 'payout'`, `queue_if_low_balance: true` (a
  temporarily low RazorpayX balance queues the payout instead of hard-failing
  it), `reference_id: ledgerId`, and an `X-Payout-Idempotency` header derived
  from `ledgerId` (safe against retries). Returns the Razorpay payout `id`
  and `status`.

Each of the payout checkpoints in `payoutEngine.ts` (the cron release loop,
`retryPayout`, the damage-claim path) branches on `booking.source`: guest
bookings keep calling `executeBankTransfer` exactly as today;
`AXON_PARTNER` bookings call `getOrCreateFundAccount` then `createPayout`
instead. `assertPayoutEligible` (bank + PAN + Host Onboarding Agreement) is
unaffected and applies identically regardless of source — a host still
needs a Sandbox-verified bank account and PAN on file; RazorpayX just pays
out to that same verified account through a different rail.

A RazorpayX payout can land in `queued`/`pending`/`processing` before
`processed` (or `failed`/`reversed`) — unlike the Route-transfer path, this
isn't synchronous-or-failed. The payout ledger entry's `status` should move
to `SETTLED` only once confirmed `processed`; a webhook (`payout.processed`/
`payout.failed`/`payout.reversed`) is the correct way to learn the outcome
rather than polling, matching how `razorpayWebhook.routes.ts` already
handles payment-side webhooks. This adds one more webhook route to build,
scoped inside this same task since the payout flow is incomplete without it.

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
