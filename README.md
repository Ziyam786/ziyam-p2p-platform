# ZiyamSelfDrive

P2P self-drive car rental platform: fleet operators + self-hosts, 70/30 revenue split,
N+1 day automated payouts, keyless telematics, and a fleet dashboard.

## Stack
- **Backend:** Node.js, Express, TypeScript, Prisma (PostgreSQL), node-cron
- **Frontend:** React / Next.js (App Router), Tailwind
- **Infra:** Docker, Docker Compose, Nginx, Certbot, GitHub Actions

## 1. Local setup

```bash
cp .env.example .env        # fill in DB, payment, KYC, telematics credentials
npm install
npx prisma migrate dev      # create tables
npm run dev                 # starts API on :5000
npm run frontend:dev        # starts the Next.js frontend on :3000
npm run frontend:build      # creates the optimized frontend build
npm run frontend:start      # serves the optimized frontend build
```

Health check: `GET http://localhost:5000/health`

## 2. What's wired up vs. what you still need to connect

| Component | Status |
|---|---|
| Booking flow, 70/30 split math, ledger model | ✅ implemented |
| N+1 escrow scheduling + hourly settlement cron | ✅ implemented |
| Fleet earnings/utilization aggregation | ✅ implemented |
| Telematics unlock/lock/telemetry routes | ✅ implemented (stubbed HTTP calls) |
| **Payment gateway calls** (`services/paymentGateway.ts`) | ⚠️ stubbed — wire up Razorpay Route / Stripe Connect / Cashfree SDK calls where marked `TODO` |
| **KYC verification** | ⚠️ not implemented — plug in DigiLocker / Aadhaar XML API and gate `host.isKycVerified` |
| Auth / session management | ⚠️ not implemented — add JWT or session auth before exposing routes publicly |
| Telematics provider credentials | ⚠️ point `TELEMATICS_GATEWAY_URL` at your IoT vendor |

The stubbed sections are intentional: real payment-gateway and KYC integration requires
your live merchant/API credentials and legal agreements with the provider, so those calls
return mock data until you fill in the `TODO`s with your provider's SDK.

## 3. Deploying to `ziyam.in`

```bash
# DNS: point A record @ -> server IP, CNAME www -> ziyam.in

# On the server (Ubuntu 22.04/24.04):
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker

sudo certbot --nginx -d ziyam.in -d www.ziyam.in

git clone <your-repo-url> /var/www/ziyam
cd /var/www/ziyam
cp .env.example .env   # fill in production secrets

cd devops
sudo docker-compose up -d --build
sudo docker exec -it devops-ziyam-app-1 npx prisma migrate deploy

sudo cp nginx.conf /etc/nginx/sites-available/ziyam.in
sudo ln -s /etc/nginx/sites-available/ziyam.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

CI/CD: push to `main` triggers `.github/workflows/deploy.yml`, which builds and SSHes into
your server to redeploy. Set `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` as repo secrets.

## 4. Project layout

```
prisma/schema.prisma              Data model (users, cars, bookings, payout ledger)
src/backend/config/               Env loading
src/backend/services/
  payoutEngine.ts                 70/30 split + N+1 escrow + settlement cron
  paymentGateway.ts                Payment provider abstraction (stubbed)
  telematicsService.ts            Keyless unlock/lock + live telemetry
  fleetService.ts                 Earnings & utilization aggregation
src/backend/routes/
  booking.routes.ts               Search, book, complete trip, unlock
  host.routes.ts                  Host onboarding, car listing, earnings, utilization
src/backend/server.ts             Express entrypoint
src/frontend/app/host/dashboard/  Fleet operator dashboard (React)
src/frontend/app/                 Consumer booking frontend (Next.js App Router)
devops/                           Dockerfile, docker-compose, nginx.conf
.github/workflows/deploy.yml      CI/CD
```
