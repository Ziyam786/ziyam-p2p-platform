# Axon Partner-Booking Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let B2B fleet-aggregator partners (Zoomcar/Revv-style) actually create a booking through Axon Network, not just search and quote — and get hosts paid for those bookings via a real RazorpayX Payouts integration.

**Architecture:** A new `AxonPartner` identity model replaces the current plaintext-env-var API key. Partner bookings reuse the existing `Booking` table (new `source`/`axonPartnerId` fields) so hosts, admin, and the payout engine keep working with minimal changes. Host payout for these invoiced (non-Razorpay) bookings goes through a new RazorpayX Payouts integration, built with raw `axios` calls (the installed `razorpay@2.9.8` SDK has no `contacts`/`payouts` resources) rather than an SDK upgrade, to avoid any risk to the existing, working Razorpay Payments integration.

**Tech Stack:** Express + Prisma (backend), Next.js (admin app), `axios` for the new RazorpayX HTTP calls, `bcrypt` (via existing `utils/password.ts`) for hashing the partner API key.

**Spec:** `docs/superpowers/specs/2026-08-22-axon-partner-booking-design.md`

## Global Constraints

- Wholesale model: the partner is the customer of record. Ziyam never collects or verifies individual end-renter identity for these bookings.
- Settlement is invoiced/net-terms — no payment capture from the partner in this codebase.
- Host payout timing is the normal N+1 schedule, identical to guest bookings — `assertPayoutEligible` (bank + PAN + Host Onboarding Agreement) applies unchanged regardless of booking source.
- Axon bookings are auto-confirmed (`BookingStatus.CONFIRMED`) on creation — no host manual accept/reject step.
- `AXON_PARTNER_API_KEYS` / `config.axon.partnerApiKeys` are removed once the DB-backed model ships — no dual-read migration period.
- RazorpayX requires the user's own account signup/KYC/funding outside this codebase — the code must be correct and ready, but cannot be exercised end-to-end until that account exists.

---

### Task 1: Schema — AxonPartner, BookingSource, and the Booking/User field changes

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `AxonPartner` model (`id`, `name`, `companyName`, `contactEmail`, `apiKeyHash`, `status: AxonPartnerStatus`, `createdAt`), `AxonPartnerStatus` enum (`ACTIVE`, `SUSPENDED`), `BookingSource` enum (`GUEST`, `AXON_PARTNER`), `Booking.customerId` (now `String?`), `Booking.axonPartnerId: String?`, `Booking.source: BookingSource`, `User.razorpayxFundAccountId: String?`. Every later task in this plan depends on these exact field/enum names.

- [ ] **Step 1: Add the new model and enums**

Open `prisma/schema.prisma`. Find the `Booking` model (search for `model Booking {`). Immediately before it, add:

```prisma
enum AxonPartnerStatus {
  ACTIVE
  SUSPENDED
}

model AxonPartner {
  id           String            @id @default(uuid())
  name         String
  companyName  String
  contactEmail String
  apiKeyHash   String
  status       AxonPartnerStatus @default(ACTIVE)
  createdAt    DateTime          @default(now())
  bookings     Booking[]
}

enum BookingSource {
  GUEST
  AXON_PARTNER
}
```

- [ ] **Step 2: Modify the Booking model**

In `model Booking {`, find these two lines:

```prisma
  customerId            String
  customer              User          @relation("CustomerBookings", fields: [customerId], references: [id])
```

Replace with:

```prisma
  customerId            String?
  customer              User?         @relation("CustomerBookings", fields: [customerId], references: [id])
  axonPartnerId         String?
  axonPartner           AxonPartner?  @relation(fields: [axonPartnerId], references: [id])
  source                BookingSource @default(GUEST)
```

- [ ] **Step 3: Add the cached fund-account field to User**

In `model User {`, find the line `bankAccountVerified Boolean @default(false)` (in the Sandbox verification block) and add immediately after it:

```prisma
  razorpayxFundAccountId String? // cached RazorpayX fund_account_id, created once, reused for every subsequent payout
```

- [ ] **Step 4: Run the migration**

```bash
npx prisma migrate dev --name add_axon_partner_booking
```

Expected: a new `migrations/<timestamp>_add_axon_partner_booking/migration.sql` is created and applied with no errors. If `prisma generate`'s client-regen step fails with an `EPERM: operation not permitted, rename ... query_engine-windows.dll.node` error, the currently-running `ts-node-dev` backend process has the file locked — kill it first (`taskkill /PID <pid> /T /F` on the `ts-node-dev --respawn ... server.ts` process tree), then re-run `npx prisma generate` on its own, then restart the backend.

- [ ] **Step 5: Verify the client picked up the new types**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no new errors (existing code doesn't reference the new fields yet, so this should be clean).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(axon): add AxonPartner model and Booking/User fields for partner bookings"
```

---

### Task 2: Axon partner auth — move off the plaintext env var

**Files:**
- Modify: `src/backend/routes/axon.routes.ts:1-33`
- Modify: `src/backend/config/index.ts:165-173` (remove the now-unused `axon.partnerApiKeys` config)

**Interfaces:**
- Consumes: `AxonPartner` model (Task 1), `hashPassword`/`comparePassword` from `src/backend/utils/password.ts` (existing — confirmed in an earlier security audit to be sound bcrypt wrappers).
- Produces: `req.axonPartner: { id: string; name: string; status: AxonPartnerStatus }` (attached by the rewritten `requireAxonApiKey`), for Task 5's booking-write endpoint to consume.

- [ ] **Step 1: Read the existing password utility to confirm its exact exports**

```bash
cat src/backend/utils/password.ts
```

Confirm it exports `hashPassword(plain: string): Promise<string>` and `comparePassword(plain: string, hash: string): Promise<boolean>` (these are the exact names used in `auth.routes.ts` per the earlier credential-storage audit). The new code below assumes these exact names — if they differ, use the actual names instead.

- [ ] **Step 2: Add the Express Request augmentation**

In `src/backend/routes/axon.routes.ts`, add near the top (after the existing imports):

```typescript
import { PrismaClient, AxonPartnerStatus } from '@prisma/client';
import { comparePassword } from '../utils/password';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      axonPartner?: { id: string; name: string; status: AxonPartnerStatus };
    }
  }
}

const prisma = new PrismaClient();
```

- [ ] **Step 3: Rewrite requireAxonApiKey**

Replace the entire existing `requireAxonApiKey` function (and the `safeEqual` helper above it, no longer needed — `comparePassword` is already timing-safe internally via bcrypt) with:

```typescript
async function requireAxonApiKey(req: Request, res: Response, next: NextFunction) {
  const suppliedKey = (req.headers['x-axon-api-key'] as string | undefined) ?? (req.query.apiKey as string | undefined);
  if (!suppliedKey) {
    return res.status(401).json({ error: 'Invalid or missing Axon API key' });
  }

  // apiKeyHash is bcrypt — there's no indexed lookup by the raw key, so this
  // checks every active partner's hash. Axon partners are a small, curated
  // set (a handful, not thousands), so this is not a real cost at this scale.
  const partners = await prisma.axonPartner.findMany({ where: { status: AxonPartnerStatus.ACTIVE } });
  for (const partner of partners) {
    if (await comparePassword(suppliedKey, partner.apiKeyHash)) {
      req.axonPartner = { id: partner.id, name: partner.name, status: partner.status };
      return next();
    }
  }
  return res.status(401).json({ error: 'Invalid or missing Axon API key' });
}
```

- [ ] **Step 4: Remove the now-unused env-var config**

In `src/backend/config/index.ts`, find and delete the `axon: { partnerApiKeys: ... }` block (lines ~165-173, the comment above it, and its closing brace/comma). Search the whole repo for any other reference before deleting:

```bash
grep -rn "config.axon\|AXON_PARTNER_API_KEYS" src/
```

If any other file references it, leave a note in this task's report rather than silently breaking that file — this plan only accounts for `axon.routes.ts`'s own usage.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. The three existing routes (`/search`, `/pricing/quote`, `/calendar/:carId/feed.ics`) are unaffected — `router.use(requireAxonApiKey)` still gates all of them, just via the new async implementation.

- [ ] **Step 6: Manual smoke test**

Start the backend (`npm run dev`), then:

```bash
curl -s http://localhost:5001/api/axon/search?city=Bengaluru&pickupTime=2026-09-01T10:00:00Z&dropTime=2026-09-02T10:00:00Z -H "X-Axon-Api-Key: wrong-key"
```

Expected: `{"error":"Invalid or missing Axon API key"}` with a 401 — confirms the rewritten auth path runs without crashing even with zero partners in the DB yet (Task 3 adds the first one).

- [ ] **Step 7: Commit**

```bash
git add src/backend/routes/axon.routes.ts src/backend/config/index.ts
git commit -m "feat(axon): authenticate partners against the DB instead of a plaintext env var"
```

---

### Task 3: Admin backend — partner management routes

**Files:**
- Modify: `src/backend/routes/admin.routes.ts` (add new routes near other resource-management routes in this file)

**Interfaces:**
- Consumes: `AxonPartner` (Task 1), `hashPassword` (`src/backend/utils/password.ts`), `recordAudit` from `src/backend/middleware/auditLog.ts` (exact signature: `recordAudit(userId: string, action: string, entityType: string, entityId: string, details?: unknown)` — confirmed from its use in `promoCode.routes.ts:51`).
- Produces: `GET /admin/axon-partners` (list, includes a `bookingCount`), `POST /admin/axon-partners` (create, returns the raw key **once**), both behind `requireAuth, requireRole(Role.ADMIN)` — for Task 4's admin page to consume.

- [ ] **Step 1: Add the imports this task needs**

At the top of `src/backend/routes/admin.routes.ts`, confirm `crypto` is imported (for generating the random key) — if not, add `import crypto from 'crypto';`. Confirm `hashPassword` and `recordAudit` are imported; if not:

```typescript
import { hashPassword } from '../utils/password';
import { recordAudit } from '../middleware/auditLog';
```

- [ ] **Step 2: Add the list route**

Add near the file's other admin-resource GET routes:

```typescript
router.get('/admin/axon-partners', requireAuth, requireRole(Role.ADMIN), async (_req: Request, res: Response) => {
  const partners = await prisma.axonPartner.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bookings: true } } },
  });
  res.json({
    success: true,
    data: partners.map((p) => ({
      id: p.id,
      name: p.name,
      companyName: p.companyName,
      contactEmail: p.contactEmail,
      status: p.status,
      createdAt: p.createdAt,
      bookingCount: p._count.bookings,
    })),
  });
});
```

- [ ] **Step 3: Add the create route**

```typescript
router.post('/admin/axon-partners', requireAuth, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const { name, companyName, contactEmail } = req.body;
  if (!name || !companyName || !contactEmail) {
    return res.status(400).json({ error: 'name, companyName, and contactEmail are required' });
  }

  const rawKey = crypto.randomBytes(24).toString('base64url'); // 32 chars, URL-safe — the partner's actual X-Axon-Api-Key value
  const apiKeyHash = await hashPassword(rawKey);

  const partner = await prisma.axonPartner.create({
    data: { name, companyName, contactEmail, apiKeyHash },
  });
  await recordAudit(req.user!.userId, 'CREATE_AXON_PARTNER', 'AxonPartner', partner.id, { name, companyName, contactEmail });

  // The raw key is returned exactly once, here — apiKeyHash is the only copy
  // ever persisted. If the admin loses this response, the only recovery is
  // creating a new partner (or a future "rotate key" action, not built here).
  res.json({
    success: true,
    data: {
      id: partner.id,
      name: partner.name,
      companyName: partner.companyName,
      contactEmail: partner.contactEmail,
      status: partner.status,
      createdAt: partner.createdAt,
      bookingCount: 0,
      apiKey: rawKey,
    },
  });
});
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 5: Manual smoke test**

With the backend running and logged in as an admin (or using an existing admin session cookie from a prior manual test in this session), confirm the route responds. If no easy admin session is on hand, at minimum confirm the route rejects an unauthenticated request:

```bash
curl -s http://localhost:5001/api/admin/axon-partners
```

Expected: `{"error":"Not authenticated"}` (matches the pattern already confirmed for other `requireAuth` routes in this session).

- [ ] **Step 6: Commit**

```bash
git add src/backend/routes/admin.routes.ts
git commit -m "feat(axon): add admin routes to list and create Axon partners"
```

---

### Task 4: Admin frontend — partner management page

**Files:**
- Create: `src/admin/app/axon-partners/page.tsx` (mirrors the structure of `src/admin/app/promo-codes/page.tsx`)
- Modify: `src/admin/lib/api.ts` (add `adminApi.axonPartners()` / `adminApi.createAxonPartner()`)
- Modify: `src/admin/lib/types.ts` (add the `AxonPartner` interface)
- Modify: `src/admin/components/Sidebar.tsx` (add a nav entry)

**Interfaces:**
- Consumes: `GET /admin/axon-partners`, `POST /admin/axon-partners` (Task 3).

- [ ] **Step 1: Add the type**

In `src/admin/lib/types.ts`, add near the other admin-resource interfaces (e.g. next to `PromoCode`):

```typescript
export interface AxonPartner {
  id: string;
  name: string;
  companyName: string;
  contactEmail: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  bookingCount: number;
  apiKey?: string; // only ever present in the response right after creation
}
```

- [ ] **Step 2: Add the API client functions**

In `src/admin/lib/api.ts`, add near the other `adminApi.*` functions (e.g. next to the `promoCodes`/`createPromoCode` pair):

```typescript
axonPartners: () => get<{ success: true; data: AxonPartner[] }>('/admin/axon-partners'),
createAxonPartner: (data: { name: string; companyName: string; contactEmail: string }) =>
  post<{ success: true; data: AxonPartner }>('/admin/axon-partners', data),
```

Add `AxonPartner` to the existing `import type { ... } from './types'` line at the top of the file.

- [ ] **Step 3: Write the page**

Create `src/admin/app/axon-partners/page.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AxonPartner } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function AxonPartnersPage() {
  const { show } = useToast();
  const [partners, setPartners] = useState<AxonPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ partnerName: string; key: string } | null>(null);

  function load() {
    setLoading(true);
    adminApi.axonPartners().then((res) => setPartners(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !companyName.trim() || !contactEmail.trim()) {
      show('Provide a name, company name, and contact email', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await adminApi.createAxonPartner({ name: name.trim(), companyName: companyName.trim(), contactEmail: contactEmail.trim() });
      setRevealedKey({ partnerName: res.data.name, key: res.data.apiKey! });
      setName(''); setCompanyName(''); setContactEmail('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to create partner', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Axon Partners" subtitle={`${partners.length} partners · B2B fleet-aggregator integrations`}>
      {revealedKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-amber-300 mb-1">API key for {revealedKey.partnerName}</h2>
          <p className="text-xs text-amber-200/80 mb-3">
            This is shown once and never again — copy it now and share it with the partner over a secure channel.
          </p>
          <code className="block bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 font-mono break-all">
            {revealedKey.key}
          </code>
          <button onClick={() => setRevealedKey(null)} className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200">
            I've copied it — dismiss
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-4">Add a Partner</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Contact Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Company</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Zoomcar" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Contact Email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ops@zoomcar.com" className={`${rowInput} w-full`} />
          </div>
          <button type="submit" disabled={busy} className="col-span-full sm:col-span-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
            Create Partner
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : partners.length === 0 ? (
        <p className="text-slate-500">No Axon partners yet.</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Since</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-semibold text-slate-200">{p.companyName}</td>
                  <td className="py-3 px-4 text-slate-400">{p.name} · {p.contactEmail}</td>
                  <td className="py-3 px-4 text-slate-400">{p.bookingCount}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 4: Add the sidebar nav entry**

Read the current `src/admin/components/Sidebar.tsx` first — it may have changed since this plan was written (another concurrent editor was touching it during this session). Add one entry to the `NAV` array, in a sensible position near the other revenue/partner-related entries (e.g. next to `Fleet Ledger` or `Financial ERP`):

```typescript
{ href: '/axon-partners', label: 'Axon Partners', icon: '🌐' },
```

- [ ] **Step 5: Typecheck**

```bash
cd src/admin && npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 6: Manual verification**

Start the admin app's dev server (check `src/admin/package.json` for the exact script, typically `npm run dev`), navigate to `/axon-partners`, confirm the page loads without a console error and the empty state ("No Axon partners yet.") renders.

- [ ] **Step 7: Commit**

```bash
git add src/admin/app/axon-partners src/admin/lib/api.ts src/admin/lib/types.ts src/admin/components/Sidebar.tsx
git commit -m "feat(axon): add admin UI to view and create Axon partners"
```

---

### Task 5: Extract the reusable availability-conflict check

**Files:**
- Modify: `src/backend/services/axonSupplyGateway.ts`

**Interfaces:**
- Produces: `AxonSupplyGateway.isCarAvailableForWindow(carId: string, pickupTime: Date, dropTime: Date): Promise<boolean>` — for Task 6's booking-write endpoint to call as its own atomic re-check, and for `searchAvailableFleet` to reuse instead of its current inline conflict query.

- [ ] **Step 1: Add the new method**

In `src/backend/services/axonSupplyGateway.ts`, inside the `AxonSupplyGateway` class, add (near `SANITIZATION_BUFFER_MS`):

```typescript
/**
 * True if no CONFIRMED/ACTIVE/PENDING_PAYMENT booking (plus the 2-hour
 * sanitization buffer) overlaps the requested window for this one car.
 * Extracted from searchAvailableFleet's inline query so the booking-write
 * endpoint can re-check the exact same rule atomically, immediately before
 * insert — a partner's search and book calls aren't the same request, so
 * availability can have changed in between.
 */
public static async isCarAvailableForWindow(carId: string, pickupTime: Date, dropTime: Date): Promise<boolean> {
  const requestedEndWithBuffer = new Date(dropTime.getTime() + this.SANITIZATION_BUFFER_MS);
  const conflict = await prisma.booking.findFirst({
    where: {
      carId,
      status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING_PAYMENT'] },
      startTime: { lte: requestedEndWithBuffer },
      endTime: { gte: pickupTime },
    },
    select: { id: true },
  });
  return !conflict;
}
```

- [ ] **Step 2: Reuse it from searchAvailableFleet**

Replace the existing inline query (the `conflictingBookings`/`bookedCarIds` block, steps 2-3 in `searchAvailableFleet`'s current body) with a call per car:

```typescript
const availability = await Promise.all(
  bookableCars.map(async (car) => ({ car, available: await this.isCarAvailableForWindow(car.id, requestedStart, requestedEnd) }))
);
return availability.filter((a) => a.available).map(({ car: { imageAngles, ...rest } }) => rest);
```

This changes the query shape from "one batched query for all cars" to "one query per car" — for the current fleet scale (a search result set of tens of cars, not thousands) this is an acceptable trade for the shared, provably-identical logic; do not further optimize this in this task.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 4: Manual smoke test**

With the backend running and at least one car seeded in the local DB (check with a quick `GET /api/cars`), hit search with a real city and a wide-open date window and confirm it still returns cars (i.e., the refactor didn't silently break search):

```bash
curl -s "http://localhost:5001/api/axon/search?city=Bengaluru&pickupTime=2026-09-01T10:00:00Z&dropTime=2026-09-02T10:00:00Z" -H "X-Axon-Api-Key: <a real partner key from Task 3's manual test>"
```

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/axonSupplyGateway.ts
git commit -m "refactor(axon): extract isCarAvailableForWindow for reuse in booking-write"
```

---

### Task 6: Booking-write endpoint

**Files:**
- Modify: `src/backend/routes/axon.routes.ts` (add `POST /bookings`)

**Interfaces:**
- Consumes: `req.axonPartner` (Task 2), `AxonSupplyGateway.isCarAvailableForWindow` (Task 5), `AxonPricingEngine.calculateFare` (existing), `isBookable` from `src/backend/utils/carPhotoAngles.ts` (existing, already used in `axonSupplyGateway.ts`), `notify` from `src/backend/services/notificationService.ts` (existing).
- Produces: `POST /axon/bookings` → `{ success: true, data: { bookingId, status, fare } }` — a real `Booking` row with `source: 'AXON_PARTNER'`, which Task 7/8's payout logic reads.

- [ ] **Step 1: Add the imports this task needs**

In `src/backend/routes/axon.routes.ts`, add:

```typescript
import { isBookable } from '../utils/carPhotoAngles';
import { notify } from '../services/notificationService';
```

(`AxonSupplyGateway`, `AxonPricingEngine`, `PrismaClient` are already imported from earlier tasks/the existing file.)

- [ ] **Step 2: Write the route**

Add after the existing three routes, before `export default router;`:

```typescript
// POST /api/v1/axon/bookings - Create a real, auto-confirmed booking
router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const { carId, pickupTime, dropTime } = req.body;
    if (!carId || !pickupTime || !dropTime) {
      return res.status(400).json({ error: 'carId, pickupTime, and dropTime are required' });
    }

    const pickup = new Date(pickupTime);
    const drop = new Date(dropTime);
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(drop.getTime()) || drop <= pickup) {
      return res.status(400).json({ error: 'pickupTime must be a valid date strictly before dropTime' });
    }

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (!car.isAvailable || car.verificationStatus !== 'VERIFIED' || !isBookable(car, config.photoAngleEnforcementDate)) {
      return res.status(422).json({ error: 'This car is not currently bookable' });
    }

    const available = await AxonSupplyGateway.isCarAvailableForWindow(carId, pickup, drop);
    if (!available) return res.status(409).json({ error: 'This car is already booked for the requested window' });

    const fare = AxonPricingEngine.calculateFare({ dailyRate: car.dailyRate, pickupTime: pickup, dropTime: drop });

    const booking = await prisma.booking.create({
      data: {
        carId,
        customerId: null,
        axonPartnerId: req.axonPartner!.id,
        source: 'AXON_PARTNER',
        startTime: pickup,
        endTime: drop,
        totalAmount: fare.baseFare,
        deliveryFeeAmount: 0,
        depositAmount: 0,
        status: 'CONFIRMED',
      },
    });

    await notify(car.ownerId, 'GENERIC', 'New booking (Axon partner)', `A partner booking is confirmed for your ${car.make} ${car.model}.`, '/host/dashboard');

    return res.json({
      success: true,
      data: { bookingId: booking.id, status: booking.status, fare },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Axon booking failed' });
  }
});
```

Note: `config` is already imported in this file. If `prisma.booking.create`'s required fields don't exactly match this task's assumptions (schema drift is possible since Task 1 landed earlier), check `prisma/schema.prisma`'s current `Booking` model for any other `@required` field with no default and add it explicitly — this plan cannot enumerate every field on a model this large, but every field used above is confirmed required-or-defaulted as of this plan's writing.

- [ ] **Step 3: Add this route inside the auth gate**

Confirm this new route is declared *after* the existing `router.use(requireAxonApiKey);` line (Task 2) — it must not be exempt from partner auth. If it was added before that line by mistake, move it below.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 5: Manual smoke test**

Using a real car id from the local DB and a real partner API key (from Task 3/4's manual test):

```bash
curl -s -X POST http://localhost:5001/api/axon/bookings \
  -H "X-Axon-Api-Key: <real key>" -H "Content-Type: application/json" \
  -d '{"carId":"<real car id>","pickupTime":"2026-09-10T10:00:00Z","dropTime":"2026-09-12T10:00:00Z"}'
```

Expected: `{"success":true,"data":{"bookingId":"...","status":"CONFIRMED","fare":{...}}}`. Then confirm via Prisma or a quick admin bookings check that the row has `source: 'AXON_PARTNER'`, `customerId: null`, `axonPartnerId` set. Re-running the exact same request should now return 409 (conflict).

- [ ] **Step 6: Commit**

```bash
git add src/backend/routes/axon.routes.ts
git commit -m "feat(axon): add POST /axon/bookings to create real, auto-confirmed partner bookings"
```

---

### Task 7: RazorpayX payout service

**Files:**
- Create: `src/backend/services/razorpayxPayoutService.ts`
- Modify: `src/backend/config/index.ts` (add `razorpayx` config block)
- Modify: `.env.local.example` / `.env` doc comment (note the new env vars — do not fabricate values)

**Interfaces:**
- Consumes: `axios` (already a dependency, used in `sandboxService.ts`), `User.bankAccountNumber`/`bankIfsc`/`bankNameAtBank` (existing, Sandbox-verified), `User.razorpayxFundAccountId` (Task 1).
- Produces: `razorpayxPayoutService.getOrCreateFundAccount(host): Promise<string>` (returns `fund_account_id`), `razorpayxPayoutService.createPayout(fundAccountId: string, amountRupees: number, ledgerId: string): Promise<{ id: string; status: string }>` — for Task 8's payout-engine branch to call.

- [ ] **Step 1: Add config**

In `src/backend/config/index.ts`, add a new block (near the existing `razorpay: {...}` block):

```typescript
razorpayx: {
  keyId: process.env.RAZORPAYX_KEY_ID ?? '',
  keySecret: process.env.RAZORPAYX_KEY_SECRET ?? '',
  accountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER ?? '', // the RazorpayX business account_number payouts debit from
  webhookSecret: process.env.RAZORPAYX_WEBHOOK_SECRET ?? '',
},
```

Add a comment above it noting these are separate credentials from `RAZORPAY_KEY_ID`/`SECRET` — confirm this with the RazorpayX dashboard once the account exists; Razorpay's docs don't make explicit whether the key pair is shared or distinct from standard Payments keys.

- [ ] **Step 2: Write the service**

Create `src/backend/services/razorpayxPayoutService.ts`:

```typescript
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

/**
 * RazorpayX Payouts — a separate product/API from Razorpay Payments, used
 * to pay a host directly from Ziyam's own RazorpayX balance (not a split of
 * a captured payment, unlike executeBankTransfer in payoutEngine.ts). The
 * installed `razorpay` SDK (2.9.8) has no `contacts`/`payouts` resources, so
 * this makes raw HTTP calls instead, matching the same Basic Auth scheme
 * documented at https://razorpay.com/docs/api/x/payouts/create/bank-account/.
 */
function client() {
  return axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: { username: config.razorpayx.keyId, password: config.razorpayx.keySecret },
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertConfigured() {
  if (!config.razorpayx.keyId || !config.razorpayx.keySecret || !config.razorpayx.accountNumber) {
    throw new Error('RazorpayX is not configured (RAZORPAYX_KEY_ID / RAZORPAYX_KEY_SECRET / RAZORPAYX_ACCOUNT_NUMBER)');
  }
}

export const razorpayxPayoutService = {
  /**
   * Idempotent per Razorpay's own docs (matching contact/fund-account
   * details return the existing record instead of creating a duplicate), so
   * this never needs to check for an existing one before calling — except
   * the cheap User.razorpayxFundAccountId cache, which skips both calls
   * entirely on every payout after the first for a given host.
   */
  async getOrCreateFundAccount(host: {
    id: string;
    fullName: string;
    email: string;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    bankNameAtBank: string | null;
    razorpayxFundAccountId: string | null;
  }): Promise<string> {
    if (host.razorpayxFundAccountId) return host.razorpayxFundAccountId;
    assertConfigured();
    if (!host.bankAccountNumber || !host.bankIfsc) {
      throw new Error('Host has no verified bank account on file');
    }

    const contactRes = await client().post('/contacts', {
      name: host.fullName,
      email: host.email,
      type: 'vendor',
      reference_id: host.id,
    });
    const contactId = contactRes.data.id;

    const fundAccountRes = await client().post('/fund_accounts', {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: host.bankNameAtBank || host.fullName,
        ifsc: host.bankIfsc,
        account_number: host.bankAccountNumber,
      },
    });
    const fundAccountId = fundAccountRes.data.id;

    await prisma.user.update({ where: { id: host.id }, data: { razorpayxFundAccountId: fundAccountId } });
    return fundAccountId;
  },

  async createPayout(fundAccountId: string, amountRupees: number, ledgerId: string): Promise<{ id: string; status: string }> {
    assertConfigured();
    const res = await client().post(
      '/payouts',
      {
        account_number: config.razorpayx.accountNumber,
        fund_account_id: fundAccountId,
        amount: Math.round(amountRupees * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: ledgerId,
      },
      { headers: { 'X-Payout-Idempotency': ledgerId } }
    );
    return { id: res.data.id, status: res.data.status };
  },
};
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 4: No live test in this task**

This task does not include a live call against RazorpayX — per this plan's Global Constraints, the RazorpayX account doesn't exist yet outside this codebase. Verify only that the module loads without error:

```bash
node -e "require('ts-node/register'); require('./src/backend/services/razorpayxPayoutService.ts')"
```

Expected: no output (a clean module load, no top-level errors). Confirm `assertConfigured()` throws the expected message if called with no env vars set (this can be checked by temporarily calling `getOrCreateFundAccount` with a fake host object in a throwaway script — delete the script after, don't commit it).

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/razorpayxPayoutService.ts src/backend/config/index.ts
git commit -m "feat(axon): add RazorpayX payout service (contact -> fund account -> payout)"
```

---

### Task 8: Wire the payout-engine branch and the RazorpayX webhook

**Files:**
- Modify: `src/backend/services/payoutEngine.ts` (the cron release loop, `retryPayout`, the damage-claim payout path)
- Create: `src/backend/routes/razorpayxWebhook.routes.ts` (mirrors `src/backend/routes/razorpayWebhook.routes.ts`'s structure)
- Modify: `src/backend/utils/razorpaySignature.ts` (add a RazorpayX-secret variant of the existing webhook-signature check)
- Modify: `src/backend/server.ts` (mount the new webhook route)

**Interfaces:**
- Consumes: `razorpayxPayoutService` (Task 7), `prisma.payoutLedger` (existing model).
- Produces: `PayoutLedger.status` transitions to `SETTLED`/`FAILED` for `AXON_PARTNER`-sourced bookings via the new webhook, instead of `executeBankTransfer`'s synchronous result.

- [ ] **Step 1: Add the RazorpayX signature check**

In `src/backend/utils/razorpaySignature.ts`, add (reusing the existing `hmacSha256Hex`/`timingSafeEqualHex` helpers already in this file):

```typescript
/**
 * Same HMAC-SHA256-of-raw-body scheme as verifyWebhookSignature, but against
 * the separate secret configured in the RazorpayX dashboard (a distinct
 * product from Razorpay Payments, with its own webhook config).
 */
export function verifyRazorpayXWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  const expected = hmacSha256Hex(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'), config.razorpayx.webhookSecret);
  return timingSafeEqualHex(expected, signature);
}
```

- [ ] **Step 2: Write the webhook route**

Create `src/backend/routes/razorpayxWebhook.routes.ts`:

```typescript
import express, { Router, Request, Response } from 'express';
import { PrismaClient, PayoutStatus } from '@prisma/client';
import { verifyRazorpayXWebhookSignature } from '../utils/razorpaySignature';
import { notify } from '../services/notificationService';

const prisma = new PrismaClient();
const router = Router();

/**
 * RazorpayX posts payout status here, signed the same way as the existing
 * Payments webhook (X-Razorpay-Signature, HMAC-SHA256 of the raw body) but
 * with RazorpayX's own separately-configured secret. Mounted ahead of the
 * CORS/cookie/JSON-body middleware in server.ts, same reasoning as the
 * existing razorpayWebhook.routes.ts: a server-to-server POST must skip our
 * strict CORS check, and signature verification needs the raw body.
 */
router.post(
  '/payments/razorpayx/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body as Buffer;

    if (typeof signature !== 'string' || !Buffer.isBuffer(rawBody) || !verifyRazorpayXWebhookSignature(rawBody, signature)) {
      console.error('[RAZORPAYX WEBHOOK] Signature verification FAILED — refusing to process.');
      return res.status(400).json({ error: 'invalid signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'malformed payload' });
    }

    const event = payload?.event;
    try {
      const payout = payload.payload?.payout?.entity;
      const ledgerId = payout?.reference_id;
      if (ledgerId && (event === 'payout.processed' || event === 'payout.failed' || event === 'payout.reversed')) {
        const ledger = await prisma.payoutLedger.findUnique({ where: { id: ledgerId } });
        if (ledger) {
          const newStatus = event === 'payout.processed' ? PayoutStatus.SETTLED : PayoutStatus.FAILED;
          await prisma.payoutLedger.update({ where: { id: ledgerId }, data: { status: newStatus, payoutTxnId: payout.id } });
          if (newStatus === PayoutStatus.SETTLED) {
            await notify(
              ledger.hostId,
              'PAYOUT_SETTLED',
              'Payout settled',
              `₹${ledger.netPayout.toLocaleString()} has been sent to your linked account.`,
              '/host/dashboard'
            );
          }
        }
      }
    } catch (err: any) {
      console.error('[RAZORPAYX WEBHOOK] Failed to process event %s:', event, err.message ?? err);
      return res.status(200).json({ received: true, processed: false });
    }

    return res.status(200).json({ received: true });
  }
);

export default router;
```

- [ ] **Step 3: Mount it in server.ts**

In `src/backend/server.ts`, add the import near `razorpayWebhookRoutes`:

```typescript
import razorpayxWebhookRoutes from './routes/razorpayxWebhook.routes';
```

And mount it the same way, on the same line as the existing webhook (ahead of the main `api` router, per the existing `app.use('/api', razorpayWebhookRoutes);` line ~54):

```typescript
app.use('/api', razorpayxWebhookRoutes);
```

- [ ] **Step 4: Branch the payout checkpoints**

In `src/backend/services/payoutEngine.ts`, import the new service near the top:

```typescript
import { razorpayxPayoutService } from './razorpayxPayoutService';
```

In the cron release loop (inside `initializePayoutCron`'s `for (const payout of maturePayouts)` block), replace:

```typescript
this.assertPayoutEligible(payout.host);
if (!payout.booking.razorpayPaymentId) {
  throw new Error('Underlying booking has no captured Razorpay payment to split from');
}
const payoutTxnId = await this.executeBankTransfer(
  payout.host.payoutAccountId!,
  payout.netPayout,
  payout.booking.razorpayPaymentId,
  payout.id
);
await prisma.payoutLedger.update({
  where: { id: payout.id },
  data: { status: PayoutStatus.SETTLED, payoutTxnId },
});
```

with:

```typescript
this.assertPayoutEligible(payout.host);
if (payout.booking.source === 'AXON_PARTNER') {
  const fundAccountId = await razorpayxPayoutService.getOrCreateFundAccount(payout.host);
  const result = await razorpayxPayoutService.createPayout(fundAccountId, payout.netPayout, payout.id);
  // Left HELD_IN_ESCROW here on purpose — the webhook (Step 2 above) is the
  // authoritative confirmation and moves it to SETTLED once RazorpayX
  // actually reports `payout.processed`, same "webhook is the source of
  // truth" pattern as the existing Razorpay Payments webhook.
  await prisma.payoutLedger.update({ where: { id: payout.id }, data: { payoutTxnId: result.id } });
} else {
  if (!payout.booking.razorpayPaymentId) {
    throw new Error('Underlying booking has no captured Razorpay payment to split from');
  }
  const payoutTxnId = await this.executeBankTransfer(
    payout.host.payoutAccountId!,
    payout.netPayout,
    payout.booking.razorpayPaymentId,
    payout.id
  );
  await prisma.payoutLedger.update({
    where: { id: payout.id },
    data: { status: PayoutStatus.SETTLED, payoutTxnId },
  });
}
```

Apply the exact same `if (payout.booking.source === 'AXON_PARTNER') { ... } else { ... }` restructuring to `retryPayout` (using `payout.booking.source`/`payout.host`/`payout.netPayout`/`payout.id`, same variable names already in scope there) and to the damage-claim payout path (using `booking.source`/`host`/the relevant `amount`/`ledger.id` variables already in scope in that function — that path currently makes up to two `executeBankTransfer` calls for a split deposit/excess charge; wrap each of those two call sites in the same branch individually, since either could independently be for an Axon-sourced booking's underlying trip).

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 6: No live payout test in this task**

Same reasoning as Task 7 Step 4 — RazorpayX isn't provisioned yet. Confirm only that:
1. The backend starts without error (`npm run dev`, check the log for a clean `🚀 ZiyamSelfDrive API running on port 5001`).
2. `curl -s -X POST http://localhost:5001/api/payments/razorpayx/webhook -H "Content-Type: application/json" -d '{}'` returns `{"error":"invalid signature"}` with a 400 (confirms the route is mounted and the signature gate runs, without needing a real signed payload).

- [ ] **Step 7: Commit**

```bash
git add src/backend/services/payoutEngine.ts src/backend/routes/razorpayxWebhook.routes.ts src/backend/utils/razorpaySignature.ts src/backend/server.ts
git commit -m "feat(axon): pay Axon-sourced bookings via RazorpayX Payouts instead of Route transfer"
```

---

## Self-review notes (for the plan author, not a task)

- **Spec coverage:** Data model (Task 1), auth (Task 2), admin UI (Tasks 3-4), booking-write + quote-consistency + availability re-check (Tasks 5-6), payout + webhook (Tasks 7-8) — every spec section maps to a task.
- **Out of scope items from the spec** (per-booking instant payment, partner webhooks, per-partner rate limiting, cancellation/modification by the partner, invoice-document generation) are deliberately not tasked here — do not add them speculatively.
- **RazorpayX account provisioning is not a task** — it's an external prerequisite the user owns, not something a task in this repo can complete.
