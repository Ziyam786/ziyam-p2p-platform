# Analytics Tracking -- Mixpanel

This project uses **Mixpanel** for all product analytics. Mixpanel is the single source of truth for event tracking, user identification, and behavioral data. Do not introduce any other analytics tools, SDKs, or tracking libraries without explicit instruction from a user.

---

## Before You Add or Modify Any Tracking

 **Do not write Mixpanel tracking code without reading this file first.**

Wrong assumptions about platform, identity, or consent will produce broken Mixpanel data that requires manual cleanup or data deletion requests.

### Mandatory checklist before writing any Mixpanel code

- [ ] Confirm you are using the correct Mixpanel SDK for this project's platform (see Tech Stack below)
- [ ] Check if this project routes data through a CDP -- if yes, send Mixpanel events through the CDP, not the Mixpanel SDK directly
- [ ] Check if consent gating is required -- if this project serves EU or California users, no Mixpanel events may fire before user consent
- [ ] Review the existing Mixpanel tracking plan below before adding new events

---

## Tech Stack

| Detail | Value |
|---|---|
| **Platform** | Next.js 15 (App Router) renter/host web app in `src/frontend` |
| **Mixpanel SDK** | mixpanel-browser |
| **SDK version** | see `src/frontend/package.json` |
| **Tracking method** | client-side |
| **CDP (if any)** | none |
| **Consent required** | yes — Mixpanel must not initialize until the user accepts analytics on the renter/host web app (`ziyam_analytics_consent` in localStorage). Decline means no SDK init. |
| **Mixpanel project token location** | `src/frontend/.env.local` → `NEXT_PUBLIC_MIXPANEL_TOKEN` (also Docker build-arg / GitHub secret of the same name) |

Admin (`src/admin`) and agent (`src/agent`) apps are internal tools and are not Mixpanel-instrumented.

---

## Mixpanel Initialization

Mixpanel is initialized in:

**File:** `src/frontend/lib/mixpanel.ts` (called from `src/frontend/components/MixpanelProvider.tsx` in `src/frontend/app/layout.tsx`)

```
// Mixpanel is initialized only after the user accepts analytics
// (MixpanelConsentBanner). Autocapture is enabled (clicks, forms, page views).
// Do not also set track_pageview or fire a manual page_viewed event.
// Session Replay records 100% of consented sessions (record_sessions_percent: 100).
// Do not create additional Mixpanel instances
```

**Do not:**
- Initialize Mixpanel in multiple places
- Create separate Mixpanel instances per component or module
- Import Mixpanel directly in feature files -- use `trackEvent` / `identifyMixpanelUser` / `resetMixpanel` from `src/frontend/lib/mixpanel.ts`

---

## Mixpanel Identity

Mixpanel identity is managed through two calls:

| Action | When to call | Code location |
|---|---|---|
| `mixpanel.identify(user_id)` | On login, signup, or session restore | `src/frontend/components/MixpanelProvider.tsx` (and immediately in `signup()` before `sign_up_completed`) |
| `mixpanel.reset()` | On logout | `src/frontend/components/MixpanelProvider.tsx` when the authenticated user becomes null |

**Rules:**
- Call `mixpanel.identify()` with a stable, internal user ID (database ID or UUID) -- never use email addresses as the Mixpanel distinct_id
- Call `mixpanel.identify()` **after** the user record is confirmed (after DB write, not on form submit)
- Call `mixpanel.reset()` on every logout path -- this clears the Mixpanel distinct_id and generates a new anonymous ID
- Never call `mixpanel.identify()` with a different user ID without calling `mixpanel.reset()` first

---

## Mixpanel Tracking Plan

These are the Mixpanel events currently tracked in this project. **All new Mixpanel events must follow the same conventions.**

### Naming conventions

- Mixpanel event names: `snake_case`, past tense verb + noun (e.g. `report_generated`, `item_added_to_cart`)
- Mixpanel property names: `snake_case` (e.g. `sign_up_method`, `plan_type`)
- No abbreviations in Mixpanel event or property names -- use full words
- Boolean Mixpanel properties: use `is_` prefix (e.g. `is_first_time`)

### Current Mixpanel events

| Mixpanel Event | Trigger | Key Properties | File |
|---|---|---|---|
| `sign_up_completed` | User account is created in the API | `sign_up_method`, `platform`, `role`, optional `referral_source` | `src/frontend/lib/auth-context.tsx` |
| `booking_completed` | Guest lands on confirmation after a successful reservation/payment | `booking_id`, `booking_status`, `car_id`, `total_amount`, `protection_plan`, `is_delivery_requested`, optional `city` | `src/frontend/app/bookings/[id]/confirmation/page.tsx` |

Value Moment: `booking_completed` -- a paid reservation or confirmed trip.

Autocapture also records page views, clicks, and form submissions. Do not add a manual `page_viewed` event.

---

## How to Add a New Mixpanel Event

1. **Check the tracking plan above** -- if the Mixpanel event already exists, use it. Do not create duplicate Mixpanel events.
2. **Name the Mixpanel event** using the conventions above: `snake_case`, past tense, descriptive.
3. **Define Mixpanel properties** -- only include properties available at the moment the event fires. Do not fetch additional data just for Mixpanel tracking.
4. **Place the Mixpanel tracking call** at the right moment:
   - Track Mixpanel events **after** the action succeeds (after DB write, after API response), not on button click or form submit
   - Track Mixpanel events **after** `mixpanel.identify()` if the event is tied to a logged-in action
5. **Update this file** -- add the new Mixpanel event to the tracking plan table above.
6. **Verify in Mixpanel Live View** -- confirm the event appears in Mixpanel with correct properties before considering it done.

### Mixpanel event template

```
import { trackEvent } from '../lib/mixpanel';

trackEvent('event_name', {
  property_name: value,
});
```

---

## What Not to Do

- **Do not introduce other analytics tools.** This project uses Mixpanel. All tracking goes through Mixpanel.
- **Do not track Mixpanel events on page load** unless explicitly measuring page views. Mixpanel events represent user actions, not navigation. Autocapture already records page views.
- **Do not track PII as Mixpanel properties** -- no emails, full names, phone numbers, IP addresses, or payment details in Mixpanel event properties. `$name` / `$email` belong only on the Mixpanel user profile via `people.set` after `identify`.
- **Do not fire Mixpanel events inside loops** -- each Mixpanel event call is a network request.
- **Do not hardcode the Mixpanel project token** -- read it from `NEXT_PUBLIC_MIXPANEL_TOKEN`.
- **Do not initialize Mixpanel before analytics consent.** `initMixpanel` / `trackEvent` / `identifyMixpanelUser` no-op until `ziyam_analytics_consent` is `granted`.
- **Do not skip `mixpanel.reset()` on logout** -- failing to reset causes Mixpanel to merge the next user's events with the previous user's profile.
- **Do not call `mixpanel.identify()` before the user is authenticated** -- premature identification creates orphaned Mixpanel profiles.
