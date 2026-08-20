# ZiyamSelfDrive

P2P self-drive car rental platform: fleet operators + self-hosts, 70/30 revenue split,
N+1 day automated payouts, real government-backed KYC, keyless telematics, an AI support
chatbot, a full renter/host web app, a Flutter mobile app, plus separate admin/CMS and
field-agent control panels — in the spirit of Zoomcar and Turo.

## Stack
- **Backend:** Node.js, Express, TypeScript, Prisma (PostgreSQL), JWT auth (httpOnly cookie), node-cron
- **Payments:** **Razorpay** — Orders API checkout, signature-verified client callback, signed webhook, and Transfers for host payouts
- **KYC:** **Setu** (DigiLocker + eSign) and **Arya** (document extraction, liveness, deepfake, face match, Aadhaar masking, RC verification)
- **AI:** Anthropic Claude (support chatbot, admin-editable system prompt)
- **Frontend:** Next.js 14 (App Router), React, Tailwind, Motion — deployed independently from the backend
- **Mobile:** Flutter renter app (`mobile/`) — Riverpod, go_router, Razorpay checkout
- **Admin:** a second Next.js app (`src/admin`) — data management, finance/ERP, live-editable site content
- **Agent:** a third Next.js app (`src/agent`) — field-ops jobs, cash log, trip handovers
- **Storage/notifications:** Firebase (storage + push), Resend (email), WhatsApp + SMS + OTP services
- **Infra:** Docker, Docker Compose, Nginx, Certbot, GitHub Actions

## Tests

```bash
npm test              # money-path suite (Vitest)
npm run test:watch
npm run test:coverage
npm run typecheck
```

The suite deliberately covers the code where a silent regression costs real money:
Razorpay signature verification (payment + webhook), the 70/30 commission split,
GST place-of-supply computation, and deposit/damage deduction arithmetic. CI
(`.github/workflows/test.yml`) also applies the migrations to a clean Postgres and
asserts the double-booking exclusion constraint is present and behaving.

**Run `npx prisma generate` before `npm run typecheck`** — without a generated client,
tsc reports ~140 spurious "has no exported member" errors.

## 1. Local setup

### Backend
```bash
cp .env.example .env        # fill in DB, JWT_SECRET, Razorpay/Setu/Arya/telematics/AI credentials
npm install
npx prisma migrate dev      # create tables
npx prisma db seed          # sample hosts, cars, bookings, reviews, a promo code
npm run dev                 # starts API on :5000
```

Health check: `GET http://localhost:5000/health`

Seeded logins (password `password123` for all): `admin@ziyam.in` (ADMIN),
`ravi.host@ziyam.in` / `fleet@ziyam.in` (hosts), `aisha@example.com` (renter).

### Renter frontend
```bash
cd src/frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:5000/api
npm install
npm run dev                        # starts the app on :3000
```

### Admin control panel
```bash
cd src/admin
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, same backend as above
npm install
npm run dev                        # starts the app on :3000 (use PORT=3002 to avoid clashing with the renter app)
```

Log in with an ADMIN account (e.g. `admin@ziyam.in`). Every `/api/admin/*` route is
role-gated server-side, so this app is only as private as you make its deployment (e.g.
put it behind its own subdomain/VPN, not linked from the public site).

Both frontends are standalone Next.js projects (their own `package.json`s), deployable to
Vercel independently of the Express API and of each other, matching the CORS setup in
`server.ts`.

## 2. Payments (Razorpay)

Checkout is real Razorpay, not a mock, and there are two independent confirmation paths:

1. `POST /api/booking` creates a `PENDING_PAYMENT` booking (no money moves yet).
2. The checkout page requests a Razorpay **Order**; the client opens Razorpay Checkout against it.
3. **Client callback** — Razorpay's browser handler returns `razorpay_order_id`,
   `razorpay_payment_id` and a signature. `POST /api/payments/razorpay/verify` recomputes
   `HMAC-SHA256(orderId|paymentId, keySecret)` and only trusts the callback if it matches
   (`utils/razorpaySignature.ts`). Never confirm a payment from the client response alone.
4. **Webhook (authoritative)** — `POST /api/payments/razorpay/webhook` receives Razorpay's
   server-to-server event, signed with the *webhook* secret over the **exact raw body**.
   This is mounted ahead of `express.json()`/CORS/cookie middleware in `server.ts`
   precisely so the raw bytes survive for signature verification. It fires even if the
   guest closes the tab, so it — not the client callback — is what the system relies on.

Both paths funnel into `processCapturedPayment()`, which is idempotent: Razorpay retries
webhooks, and the client verify call can also land twice.

> The raw-body requirement is load-bearing. Switching the webhook route to `express.json()`
> and re-serializing would change the bytes and break every signature.
> `tests/razorpaySignature.test.ts` has a test that fails loudly if anyone does this.

**Host payouts (N+1).** The full amount is collected into the platform account at checkout,
then `PayoutEngine`'s cron releases each host's share once their N+1 window matures
(`PayoutStatus: HELD_IN_ESCROW → QUEUED_FOR_N1 → SETTLED`). Deliberately not an
instant split at checkout — that would bypass the escrow window that makes damage
claims and deposit deductions resolvable.

The 70/30 split is admin-editable (`commission_percentage` / `host_share_percentage`).
Because those are two independent settings, `splitAmount()` clamps the host's share if
they are ever configured to sum above 100% and logs an error, rather than silently
overpaying every host.

Set `RAZORPAY_*` test credentials and verify a full checkout → webhook → payout cycle
before going live.

## 3. What's wired up vs. what you still need to connect

| Component | Status |
|---|---|
| Auth (signup/login/logout, JWT httpOnly cookie, bcrypt, **phone OTP**, Supabase/Firebase OAuth, suspend/reactivate) | ✅ implemented |
| Car catalogue: search/filter/sort, detail page, host CRUD, delisting, delivery, wishlist, blackouts | ✅ implemented |
| Booking lifecycle: create → **Razorpay checkout** → signature-verified confirm → host review → start (OTP) → complete → cancel | ✅ implemented |
| **Razorpay Orders checkout + signature-verified callback + signed webhook** | ✅ implemented — see §2 |
| **N+1 host payouts with escrow ledger** | ✅ implemented — see §2 |
| **Double-booking prevention** | ✅ serializable transaction on the guest path **plus a Postgres exclusion constraint** covering every write path |
| **Real KYC** — Setu DigiLocker + Aadhaar OTP, Arya document extraction, liveness, deepfake, face match, Aadhaar masking, RC verification | ✅ implemented — **not stubbed**; needs `SETU_*` / `ARYA_*` credentials |
| **Deposit lifecycle** (`HELD → RELEASED / PARTIALLY_DEDUCTED / FORFEITED`) | ✅ implemented |
| **Damage claims with evidence chain** — condition photos, admin review, host-uploaded real repair bill, excess billing | ✅ implemented |
| Dispute support, refund requests | ✅ implemented |
| **GST** — CGST/SGST vs IGST by place of supply, frozen on the invoice | ⚠️ implemented, but `default_gst_rate` is a **placeholder (0.05)** — confirm the applicable rate with your CA before live invoicing |
| **Dynamic pricing** (`yieldEngine.ts`) — utilization + forward fill rate → bounded suggestion with a plain-language reason | ✅ implemented (suggestion only; not auto-applied) |
| **Finance/ops ERP** — journal entries, fleet expenses, outstandings, monthly balances, ops trips, invoices, cash log, service requests | ✅ implemented |
| **Legal automation** — host onboarding + fleet partner + lease agreement PDFs, eSign via Setu | ✅ implemented |
| Notifications — WhatsApp, SMS, email (Resend), Firebase push | ✅ implemented |
| Reviews (two-way), public host profiles, promo codes, tiered long-rental discounts | ✅ implemented |
| **Admin app** (`src/admin`): users, cars, bookings, reviews, payouts, damage claims, disputes, refunds, finance, fleet ledger, ops trips, invoices, team access, audit log, CMS, settings | ✅ implemented |
| **Agent app** (`src/agent`): field jobs, bookings, cash log | ✅ implemented |
| **Flutter mobile app** (`mobile/`) — browse, car detail, booking, Razorpay checkout, KYC status, itineraries | ✅ implemented |
| **AI support chatbot** (Claude, admin-editable prompt, transcript viewer) | ✅ implemented — needs `ANTHROPIC_API_KEY` |
| File storage (car images, KYC docs) via Firebase | ✅ implemented |
| **Money-path test suite + CI** | ✅ implemented — see [Tests](#tests) |
| Telematics unlock/lock/telemetry | ⚠️ routes and service implemented; **point `TELEMATICS_GATEWAY_URL` at a real IoT vendor** |
| Observability (Sentry / OpenTelemetry) | ❌ **not wired** — only Mixpanel. Add before scaling |
| Test coverage outside the money path | ❌ routes, services and the Flutter app are still untested |

### Known issues worth fixing

- **`default_gst_rate` is a placeholder.** Confirm with a CA before you invoice for real.
- **A `REJECTED` booking still occupies the calendar.** The overlap check excludes only
  `CANCELLED`, so a host-rejected booking keeps blocking its dates. The exclusion
  constraint deliberately mirrors this rather than silently changing behaviour — fix it
  in the app layer.
- **Refunds are still manual.** `refundRequest.routes.ts` queues a refund for an admin to
  process by hand in the Razorpay dashboard. Automating this via the Razorpay Refunds API
  is the prerequisite for any deposit-return time guarantee.

## 4. Deploying to `ziyam.in`

```bash
# DNS: point A record @ -> server IP, CNAME www -> ziyam.in

# On the server (Ubuntu 22.04/24.04):
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker

sudo certbot --nginx -d ziyam.in -d www.ziyam.in

git clone <your-repo-url> /var/www/ziyam
cd /var/www/ziyam
cp .env.example .env   # fill in production secrets: JWT_SECRET, Razorpay live keys, SETU_*/ARYA_*, ANTHROPIC_API_KEY, SERVER_URL

cd devops
sudo docker-compose up -d --build
sudo docker exec -it devops-ziyam-app-1 npx prisma migrate deploy
sudo docker exec -it devops-ziyam-app-1 npx prisma db seed   # optional: seed sample data

sudo cp nginx.conf /etc/nginx/sites-available/ziyam.in
sudo ln -s /etc/nginx/sites-available/ziyam.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

The two frontends (`src/frontend`, `src/admin`) deploy separately — e.g. to Vercel, each
with its own root directory and `NEXT_PUBLIC_API_URL` pointing at `https://api.ziyam.in/api`
(or wherever the backend above is reachable). Set `SERVER_URL` on the backend to that same
public URL — Razorpay redirects the browser there after checkout. In production, set
`NODE_ENV=production` so auth cookies are issued with `Secure; SameSite=None`, and set
`ADMIN_URL` to wherever the admin app is deployed (for CORS).

CI/CD: push to `main` triggers `.github/workflows/deploy.yml`, which builds and SSHes into
your server to redeploy the backend. Set `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` as
repo secrets.

## 5. Project layout

```
prisma/schema.prisma               Data model (users, cars, bookings, payouts, reviews, promo codes, settings, chat log, audit log)
prisma/seed.ts                     Sample hosts/cars/bookings/reviews for local dev
src/backend/config/                Env loading (JWT, Razorpay, KYC, AI, payout policy)
src/backend/middleware/            auth.ts (requireAuth/requireRole), auditLog.ts
src/backend/utils/                 jwt.ts, password.ts, razorpaySignature.ts, bookingOverlap.ts, depositDeduction.ts
src/backend/services/
  payoutEngine.ts                  70/30 split + N+1 escrow + Razorpay Transfers payouts
  paymentGateway.ts                Razorpay Orders/checkout session builder
  razorpayPaymentHandler.ts        Idempotent capture handling for both confirmation paths
  aiService.ts                     Anthropic Claude wrapper for the support chatbot
  settingsService.ts               CMS/platform-config key-value store + defaults
  telematicsService.ts             Keyless unlock/lock + live telemetry
  fleetService.ts                  Earnings & utilization aggregation
src/backend/routes/
  auth.routes.ts                   Signup, login, logout, /auth/me
  car.routes.ts                    Search, list, detail, owner update/delist
  booking.routes.ts                Create, checkout-session, start, complete, unlock
  razorpayVerify.routes.ts         Signature-verified client callback
  razorpayWebhook.routes.ts        Signed server-to-server webhook (the authoritative "payment confirmed" trigger)
  damageClaim.routes.ts            Issue reports, admin review, repair-bill upload, deposit deduction
  disputeSupport.routes.ts         Dispute intake and resolution
  refundRequest.routes.ts          Deposit release / partial refund queue
  financeErp.routes.ts             Journal entries, expenses, outstandings, monthly balances
  fleetLedger.routes.ts            Fleet-operator ledger
  opsTrip.routes.ts                Field-ops trips, handovers, cash log
  itinerary.routes.ts              Trip itineraries
  notification.routes.ts           In-app notifications + push tokens
  serviceRequest.routes.ts         Vehicle service/maintenance requests
  upload.routes.ts                 File upload (Firebase-backed)
  wishlist.routes.ts               Saved cars
  user.routes.ts                   Profile, trip history, booking detail/cancel
  review.routes.ts                 Reviews + public host profile/cars/reviews
  kyc.routes.ts                    KYC submission (stubbed)
  admin.routes.ts                  Full admin CRUD: users, cars, bookings, reviews, payouts, audit log
  settings.routes.ts               Public + admin CMS/platform settings
  ai.routes.ts                     Chat endpoint + admin conversation viewer
  promoCode.routes.ts              Promo code CRUD (admin) + validate (public)
  host.routes.ts                   Host car CRUD, earnings, utilization
src/backend/server.ts              Express entrypoint
src/frontend/                      Renter/host Next.js app (own package.json)
  app/                             ~30 routes: marketing, auth, account, booking, host
  components/                      Navbar, Footer, CarCard, forms, ChatWidget, CustomCursor, ScrollReveal, etc.
  lib/                             api.ts (typed fetch client), auth-context.tsx, types.ts
src/admin/                         Separate admin/CMS Next.js app (own package.json)
  app/                             login, dashboard, users, cars, bookings, reviews, payouts, promo-codes, content, settings, ai, audit-log
  components/                      Sidebar, AdminShell, DataTable-style pages, Modal, Toast
devops/                            Dockerfile, docker-compose, nginx.conf
.github/workflows/deploy.yml       CI/CD
```
