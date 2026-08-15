# ZiyamSelfDrive

P2P self-drive car rental platform: fleet operators + self-hosts, 70/30 revenue split,
N+1 day automated payouts via PayU, keyless telematics, an AI support chatbot, a full
renter/host web app, and a separate admin/CMS control panel — in the spirit of Zoomcar,
BharatCarSelfDrive, and Turo.

## Stack
- **Backend:** Node.js, Express, TypeScript, Prisma (PostgreSQL), JWT auth (httpOnly cookie), node-cron
- **Payments:** PayU Hosted Checkout (collection) + PayU Split After Transaction (N+1 host payouts)
- **AI:** Anthropic Claude (support chatbot, admin-editable system prompt)
- **Frontend:** Next.js 14 (App Router), React, Tailwind, Motion — deployed independently from the backend
- **Admin:** a second, separate Next.js app (`src/admin`) — full data management + live-editable site content
- **Infra:** Docker, Docker Compose, Nginx, Certbot, GitHub Actions

## 1. Local setup

### Backend
```bash
cp .env.example .env        # fill in DB, JWT_SECRET, PayU/KYC/telematics/AI credentials
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

## 2. Payments (PayU)

Checkout is real PayU Hosted Checkout, not a mock:

1. `POST /api/booking` creates a `PENDING_PAYMENT` booking (no money moves yet).
2. The checkout page calls `POST /api/booking/:id/checkout-session`, which asks
   `paymentGateway.initiateCheckout()` to build the SHA-512 hash PayU requires
   (`src/backend/utils/payuHash.ts`) and returns a `{url, fields}` PayU expects as a POSTed form.
3. The checkout page auto-submits that form, redirecting the browser to PayU.
4. PayU redirects back to `POST /api/payments/payu/callback` (`surl`/`furl` both point here —
   the `status` field tells success from failure). That route **re-derives the reverse hash
   and only trusts it if the hash matches** — this is the only place a booking is ever moved
   out of `PENDING_PAYMENT`. Never trust a client-side "I paid" click for real money.

**Host payouts (N+1) use PayU's Split After Transaction API, not PayU's split-at-checkout
feature.** We collect the full amount into our own aggregator PayU account at checkout, then
`PayoutEngine`'s hourly cron calls PayU's `payment_split` command API to move each host's
70% cut out of that account once their N+1 window matures. This matches our existing
hold-in-escrow-then-release architecture; PayU's split-at-checkout would send the host's
money instantly and bypass N+1 entirely, so we deliberately don't use it.

**This requires each host to be onboarded with PayU as a child/sub-merchant first** — that's
a manual business/KYC process on PayU's side, not something this codebase can automate.
A host's `User.payoutAccountId` is where you store their PayU child merchant key once that
onboarding is done; until then, `PayoutEngine` will fail their payouts with a clear error
("Host has no linked payout account") rather than silently losing money.

One documented edge case worth knowing before you go live: PayU's docs say a split's line
items must sum to the *original* transaction amount. We currently send only the host's line
item (the remainder implicitly stays with the aggregator account). If PayU rejects a split
with error `AGG-108` ("amount mismatch"), add a second `splitInfo` entry in
`PayoutEngine.executeBankTransfer` for your own merchant key covering the platform's cut —
see the comment there.

Set `PAYU_MODE=test` while developing (uses `test.payu.in`) and `PAYU_MODE=live` only once
you've verified a full checkout → callback → payout cycle end-to-end with real PayU test
credentials, ideally a small real transaction before trusting it with volume.

## 3. What's wired up vs. what you still need to connect

| Component | Status |
|---|---|
| Auth (signup/login/logout, JWT in httpOnly cookie, bcrypt hashing, suspend/reactivate) | ✅ implemented |
| Car catalogue: search/filter/sort, detail page, host CRUD, delisting, delivery option | ✅ implemented |
| Booking lifecycle: create → real PayU checkout → hash-verified confirm → start → complete → cancel | ✅ implemented |
| **PayU Hosted Checkout + hash-verified callback** | ✅ implemented — see §2 |
| **PayU Split After Transaction payouts (N+1)** | ✅ implemented — requires host PayU child-merchant onboarding, see §2 |
| Reviews (two-way: renter rates car + host), public host profile pages | ✅ implemented |
| Promo codes (percent/flat, max uses, expiry), long-rental tiered discounts | ✅ implemented |
| Fleet dashboard: overview, my cars, utilization, payout policy | ✅ implemented |
| **Separate admin app** (`src/admin`): users, cars, bookings, reviews, payouts, promo codes, audit log | ✅ implemented |
| **Live-editable site content** (hero copy, categories, cities, testimonials) via admin `/content` | ✅ implemented |
| **Live-editable platform config** (commission split, protection-plan pricing, discounts) via admin `/settings` | ✅ implemented |
| **AI support chatbot** (Claude, admin-editable system prompt, transcript viewer) | ✅ implemented — needs `ANTHROPIC_API_KEY` |
| Renter account: profile, trip history, trip detail/invoice | ✅ implemented |
| 30+ pages: about (animated stats + timeline), careers, press, blog, support, safety, legal, cities, corporate, subscription, insurance, earnings calculator, 404 | ✅ implemented |
| Motion polish: scroll reveals, parallax hero, custom cursor, micro-interactions | ✅ implemented (renter site only) |
| Telematics unlock/lock/telemetry routes | ✅ implemented (stubbed HTTP calls) |
| **KYC verification** (`routes/kyc.routes.ts`) | ⚠️ stubbed as an "instant" pass — plug in the real DigiLocker / Aadhaar XML API |
| **Car images / KYC docs** | ⚠️ stored as plain URL strings — no object storage (S3/Cloudinary) is wired up |
| **SMS/OTP** | ⚠️ not implemented — auth is email + password only, no phone OTP step |
| Telematics provider credentials | ⚠️ point `TELEMATICS_GATEWAY_URL` at your IoT vendor |

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
cp .env.example .env   # fill in production secrets: JWT_SECRET, PayU live keys, ANTHROPIC_API_KEY, SERVER_URL

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
public URL — PayU redirects the browser there after checkout. In production, set
`NODE_ENV=production` so auth cookies are issued with `Secure; SameSite=None`, and set
`ADMIN_URL` to wherever the admin app is deployed (for CORS).

CI/CD: push to `main` triggers `.github/workflows/deploy.yml`, which builds and SSHes into
your server to redeploy the backend. Set `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` as
repo secrets.

## 5. Project layout

```
prisma/schema.prisma               Data model (users, cars, bookings, payouts, reviews, promo codes, settings, chat log, audit log)
prisma/seed.ts                     Sample hosts/cars/bookings/reviews for local dev
src/backend/config/                Env loading (JWT, PayU, AI, payout policy)
src/backend/middleware/            auth.ts (requireAuth/requireRole), auditLog.ts
src/backend/utils/                 jwt.ts, password.ts, payuHash.ts
src/backend/services/
  payoutEngine.ts                  70/30 split + N+1 escrow + PayU Split After Transaction payouts
  paymentGateway.ts                PayU Hosted Checkout session builder
  aiService.ts                     Anthropic Claude wrapper for the support chatbot
  settingsService.ts               CMS/platform-config key-value store + defaults
  telematicsService.ts             Keyless unlock/lock + live telemetry
  fleetService.ts                  Earnings & utilization aggregation
src/backend/routes/
  auth.routes.ts                   Signup, login, logout, /auth/me
  car.routes.ts                    Search, list, detail, owner update/delist
  booking.routes.ts                Create, checkout-session, start, complete, unlock
  payuCallback.routes.ts           Hash-verified PayU success/failure postback (the only real "payment confirmed" trigger)
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
