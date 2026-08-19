# Data Model: Ziyam SelfDrive Mobile App (Renter/Customer)

All entities below already exist in `prisma/schema.prisma`; this app introduces **no new tables**.
It consumes the existing `User`, `Car`, `Booking`, and `ItineraryUnlock` models exactly as they
stand today (field names confirmed against the live schema during Phase 0 research).

## User (Customer role)

Source: `prisma/schema.prisma:162` (`model User`). A single table shared with hosts and admins;
this app only ever acts as `role: CUSTOMER`.

| Field | Type | Notes for this app |
|---|---|---|
| `id` | String (uuid) | Used as the implicit "current user" scope for bookings/profile |
| `fullName`, `email`, `phoneNumber` | String | Editable profile fields (Story 4) |
| `avatarUrl`, `bio` | String? | Editable profile fields |
| `isKycVerified` | Boolean | Drives the KYC status badge (Story 4) — never expose `kycDocUrl` itself |
| `kycDocUrl` | String? | **Never rendered in the app** — existence alone is not the raw ID number, but per constitution Principle II this field is not surfaced client-side at all; only the derived verification state is |
| `aadhaarVerifiedName` | String? | **Never rendered** — display name only, not the Aadhaar number itself, and still excluded per the same masking principle |
| `passwordHash`, `failedLoginAttempts`, `lockedUntil` | — | Server-internal; never returned to any client |

No client-visible state transitions beyond `isKycVerified` flipping false→true, driven by the
existing KYC verification flow (out of scope to change here).

## Car (Vehicle Listing)

Source: `prisma/schema.prisma:313` (`model Car`). Read-only from this app's perspective.

| Field | Type | Notes |
|---|---|---|
| `id`, `make`, `model`, `year`, `category`, `fuelType`, `transmission`, `seats` | — | Listing/detail display |
| `dailyRate`, `securityDeposit`, `kmIncludedPerDay`, `extraKmCharge` | Float/Int | Pricing display before booking |
| `images` | String[] | Public/blurred images only — `originalImages` is admin-only and MUST NOT be requested or rendered by this app |
| `city`, `address` | String | Location/browse filtering |

## Booking

Source: `prisma/schema.prisma:507` (`model Booking`). Owned by `customerId` → `User.id`.

| Field | Type | Notes |
|---|---|---|
| `id`, `carId`, `customerId` | — | Ownership scope — this app only ever queries/creates bookings where `customerId == current user` |
| `startTime`, `endTime` | DateTime | Selected date range (Story 2) |
| `totalAmount`, `platformFee`, `hostPayoutAmount` | Float | Price breakdown shown before payment |
| `protectionPlan` | String (`BASIC`/`STANDARD`/`PREMIUM`) | Selectable at booking time |
| `deliveryRequested`, `deliveryFeeAmount` | Boolean/Float | Optional add-on |
| `coDriverRequested`, `coDriverName`, `coDriverLicenseNumber` | — | Optional add-on; license number is sensitive — mask in any list/summary view per Principle II, show unmasked only in the single-field edit control that captured it |

**State transitions** (existing, not introduced here): created → (payment pending) → confirmed
(instant-book) or pending-host-approval (request-to-book) → completed/cancelled. This app must
reflect whichever state the backend reports rather than inferring it client-side.

**Required backend fix** (see research.md): booking creation's overlap check must move into a
`prisma.$transaction` before this app's FR-007/SC-003 (no double bookings) can be honestly true.

## ItineraryUnlock

Source: `prisma/schema.prisma:1274` (`model ItineraryUnlock`). **Not** linked to `User` or
`Booking` — an anonymous, id-scoped guest purchase (see research.md correction).

| Field | Type | Notes |
|---|---|---|
| `id` | String (uuid) | The access token for this resource — the app must store it locally to allow the user to reopen their itinerary later |
| `destination` | String enum (`Ooty`\|`Coorg`\|`Chikmagalur`\|`Gokarna`) | Selection at unlock time |
| `customerName`, `customerEmail`, `customerPhone` | String | Pre-filled from the logged-in User's profile as a convenience; still required fields on unlock |
| `amount` | Float (default 49) | Displayed price |
| `paymentIntentId` | String? | PayU `txnid` — internal, not rendered |
| `status` | enum `ItineraryUnlockStatus` (`PENDING_PAYMENT`\|`PAID`\|...) | Drives UI state (generating/ready) |
| `generatedContent` | String? | The itinerary text, rendered once present |

**State transitions**: `PENDING_PAYMENT` → (PayU callback) → `PAID` → (client generates via
Firebase AI Logic) → `generatedContent` populated via `POST /itineraries/:id/content`. Reopening
later re-fetches `GET /itineraries/:id` and renders `generatedContent` directly — no regeneration,
no repeat charge (FR-009/FR-010).
