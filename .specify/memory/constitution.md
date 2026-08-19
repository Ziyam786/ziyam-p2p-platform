<!--
Sync Impact Report
Version change: [TEMPLATE UNRATIFIED] → 1.0.0
Modified principles: n/a (first ratification — all six principles newly defined)
Added sections: Core Principles (I–VI), Security & Compliance Requirements, Development Workflow, Governance
Removed sections: none
Deferred / TODO placeholders: none — RATIFICATION_DATE set to the date of this ratification since no
  earlier adoption date exists for this project.
Templates requiring follow-up: none currently tracked; re-check plan-template.md, spec-template.md,
  and tasks-template.md at the next amendment for alignment with Principles III and IV (transactional
  state and RBAC) when those templates next change materially.
-->

# Ziyam Self Drive Constitution

## Core Principles

### I. Fixed Stack, One Backend
Web surfaces (`src/frontend`, `src/admin`, `src/agent`) MUST be built with Next.js App Router and
TypeScript in strict mode, styled with Tailwind CSS. The mobile client is Flutter (Dart). The backend
is a single Express + Prisma ORM service backed by PostgreSQL (`src/backend`). The Flutter app MUST
call the same backend API used by the web surfaces — no parallel or duplicate backend, and no
mobile-only data path that bypasses the shared Prisma models. New feature work MUST NOT introduce an
additional framework, ORM, or backend runtime without a constitution amendment.

**Rationale**: A single backend and a fixed set of frontend stacks keep booking, payout, and identity
logic in one place; a second backend or ORM would let the two clients drift out of sync on business
rules that must stay atomic and consistent (see Principle III).

### II. Zero Raw PII Exposure
Aadhaar, PAN, driving-licence numbers, and full bank/card details MUST NEVER be logged, stored
unmasked at rest, returned by an API response, or rendered in a UI without server-side masking
(e.g. `[Customer DL Number]`-style placeholders). Every request boundary that accepts user-supplied
data (REST endpoint, server action, webhook handler) MUST validate and shape that data with Zod
before it touches business logic or persistence. Client-side validation alone is never sufficient.

**Rationale**: This is a regulated mobility platform handling government ID and payment data;
unmasked PII in a log line, response payload, or error message is a compliance failure, not a bug to
triage later.

### III. Transactional Integrity for Shared State
Any code path that reads and then writes shared, contested state — vehicle availability, booking
creation, security-deposit holds, host payout settlement — MUST wrap the read-check-write sequence in
a Prisma `$transaction` (with row-level locking where the database requires it). A plain
`findFirst` followed by a later `create`/`update` with no transaction boundary is not acceptable for
any of these flows, regardless of how unlikely a race looks in testing.

**Rationale**: Double-booking a vehicle or double-settling a payout is a financial and trust incident,
not a cosmetic bug; the fix must be structural (transactions), not probabilistic (hoping requests
don't overlap).

### IV. Role-Based Access Control Everywhere
Every new API route and every new screen (web or Flutter) MUST declare which of the four roles —
Admin, Agent, Host, Customer — may reach it, and MUST enforce that server-side. A UI-only hide/show
of a control is never a substitute for a server-side role check. Cross-role data leakage (a Host
seeing another Host's payout ledger, an Agent seeing unrelated trips) is treated as a security defect.

**Rationale**: Four distinct roles share overlapping data (trips, vehicles, payouts); without an
explicit, server-enforced boundary on every new surface, role bleed is the default outcome, not an
edge case.

### V. Automotive-Grade Design System Fidelity
Web and Flutter UI MUST follow the existing Ziyam design language: Essence Blue `#183eeb` as the one
accent color, Manrope as the only typeface, dark `slate-950`-style surfaces for ops/agent/admin
screens, generous radius, and the single reserved CTA gradient — not a palette invented per feature.
Generic AI-SaaS visual patterns (default purple/violet gradients, glassmorphism-for-its-own-sake,
templated dashboard starter-kit looks) MUST NOT be introduced. New screens are bold, high-contrast,
and legible in direct sunlight on a phone held by a field agent — that constraint outranks decorative
preference.

**Rationale**: The brand already has a specific, deliberately non-generic visual identity documented
in the design system; every ad hoc deviation erodes the thing that makes the product recognizable and
usable in the field.

### VI. Secrets Never Leave Secure Storage
API keys, service-account JSON, payment-gateway secrets, and sync/auth tokens MUST NOT be pasted into
chat, tickets, commit messages, or logs. They are written directly into gitignored env files
(`.env`, `.env.local`) or the deployment platform's secret store, referenced by name only in
conversation and in code. Firebase's public web client config (`NEXT_PUBLIC_FIREBASE_*`) is exempt
from this rule — it is designed to ship to the browser — but `FIREBASE_SERVICE_ACCOUNT_JSON` and
equivalent server-side admin credentials are not.

**Rationale**: Chat transcripts, tickets, and commit history are not secret stores and are frequently
retained or logged; treating "paste the key here" as normal makes an eventual leak a matter of when,
not if.

## Security & Compliance Requirements

CSRF protection on the backend follows the existing double-submit-cookie pattern in
`src/backend/middleware/csrf.ts` (literal `ziyam_csrf` / `x-csrf-token` names, kept literal
deliberately so CodeQL's `js/missing-token-validation` recognizes the handler as CSRF middleware).
Any new state-changing route added to the Express router MUST be covered by `requireCsrfToken` (or an
equivalent already-recognized pattern) rather than a new, differently-shaped CSRF check. The
`.github/workflows/codeql.yml` scan is a required gate, not an advisory one — a change that
introduces a new CodeQL finding is not ready to merge until the finding is resolved or explicitly
suppressed with a documented reason.

Indian commercial-mobility compliance (Motor Vehicles Act references, GST line-item separation on
work orders and invoices, standard KYC/AML expectations for host and renter onboarding) is a design
input for every new Host, Booking, and Payout feature, not a follow-up pass after launch.

## Development Workflow

Unrelated work is not bundled onto the same branch: a security/CI fix (e.g. the CSRF/CodeQL branch)
ships and merges independently of feature branches, even when both are in flight at the same time.
New features are developed on their own branch off `main`, specified and planned through Spec Kit
(`/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`) before
implementation begins. Parallel workstreams (e.g. the Flutter app and Live Trip Handover & Tracking)
are tracked as separate Spec Kit features with their own spec/plan/tasks, even when scheduled
concurrently, so each can be reviewed and merged independently.

## Governance

This constitution supersedes ad hoc practice for every decision it covers. Amendments are made by
editing this file, incrementing the version per the rule below, and recording the change in a Sync
Impact Report comment at the top of the file. Any Spec Kit plan or review step that touches a
principle here MUST verify compliance with it explicitly, not assume it.

Versioning policy (semantic): MAJOR — a principle is removed or redefined in a backward-incompatible
way; MINOR — a new principle or materially expanded section is added; PATCH — wording, clarification,
or typo fixes with no rule change. Complexity that deviates from a principle above (e.g. a new
backend runtime, a UI pattern outside the design system) MUST be justified in the relevant plan
document before implementation, not justified retroactively.

**Version**: 1.0.0 | **Ratified**: 2026-08-20 | **Last Amended**: 2026-08-20
