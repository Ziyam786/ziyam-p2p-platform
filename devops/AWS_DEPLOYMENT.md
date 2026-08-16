# Deploying to AWS

This repo now has everything needed to build and deploy all three apps
(backend, frontend, admin) as containers on AWS ECS Fargate. What's
**not** included is the AWS account setup itself — that requires real
credentials and account-specific decisions (region, budget, domain) that
can't be scripted blindly. This is the exact checklist to go from "code in
this repo" to "running on AWS."

## What's already in this repo

- `devops/Dockerfile` (backend), `devops/Dockerfile.frontend`, `devops/Dockerfile.admin` — multi-stage production builds for all three apps.
- `devops/docker-compose.yml` — runs all three apps + Postgres + Redis locally. Good for proving the containers work before touching AWS at all: `docker compose -f devops/docker-compose.yml --env-file .env up --build`.
- `devops/ecs/*.json` — ECS Fargate task definition templates for all three services.
- `.github/workflows/deploy-aws.yml` — builds, pushes to ECR, and deploys to ECS. Manual trigger only (`workflow_dispatch`) until you've run it successfully at least once.

None of this has been build-tested end-to-end yet — Docker Desktop wasn't running in the environment this was written in, so **run the docker-compose build locally first** before wiring up AWS, to catch anything environment-specific.

## One-time AWS setup

1. **ECR repositories** — one per app: `ziyam-backend`, `ziyam-frontend`, `ziyam-admin`.
2. **RDS PostgreSQL** — or run Postgres as a fourth Fargate service using the same image as `docker-compose.yml`'s `postgres` service if you'd rather not pay for RDS yet. Either way you'll get a `DATABASE_URL` to put in Secrets Manager (step 4).
3. **ECS cluster** — Fargate, name it `ziyam-cluster` (or set the `ECS_CLUSTER_NAME` repo variable in GitHub to whatever you name it instead).
4. **AWS Secrets Manager** — create one secret per entry under the `secrets` block in `devops/ecs/backend-task-def.json` (16 of them: `ziyam/database-url`, `ziyam/jwt-secret`, `ziyam/anthropic-api-key`, `ziyam/payu-key`, etc. — the exact key values come from your real `.env`, never commit those).
5. **IAM roles** — `ziyam-ecs-execution-role` (needs `AmazonECSTaskExecutionRolePolicy` + read access to the Secrets Manager entries above) and `ziyam-ecs-task-role` (whatever the app itself needs at runtime — starts empty, add permissions as needed).
6. **Replace placeholders** in all three `devops/ecs/*.json` files: `<AWS_ACCOUNT_ID>` and `<AWS_REGION>` everywhere they appear.
7. **ECS services** — one per app (`ziyam-backend-service`, `ziyam-frontend-service`, `ziyam-admin-service` — these exact names are what `deploy-aws.yml` targets), each pointed at its task definition, behind an Application Load Balancer if you want a single public entry point with path/host-based routing across the three apps.
8. **Domain + ALB** — point `ziyam.in` / `api.ziyam.in` / `admin.ziyam.in` (or whatever domains you're using) at the load balancer via Route 53, and set `CLIENT_URL` / `SERVER_URL` / `ADMIN_URL` in the backend task definition's `environment` block to match.

## GitHub setup

Repo Settings → Secrets and variables → Actions:

**Secrets:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ACCOUNT_ID` — from an IAM user/role scoped to ECR push + ECS deploy, not your root account credentials.
- `NEXT_PUBLIC_API_URL` — e.g. `https://api.ziyam.in/api`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — if you're using the Maps integration.

**Variables (optional):**
- `ECS_CLUSTER_NAME` — only needed if you didn't name the cluster `ziyam-cluster`.

## First deploy

Once the above is in place: Actions tab → "Deploy to AWS ECS" → Run workflow. It builds all three images, pushes to ECR, and deploys to the three ECS services in one run. Check CloudWatch Logs (`/ecs/ziyam-backend`, `/ecs/ziyam-frontend`, `/ecs/ziyam-admin` — auto-created on first run) if a service doesn't come up healthy.
