<!--
FILE OBJECTIVE:
- Shareable Sprint A status summary for engineering & stakeholders.

LINKED TODO:
- /manage_todo_list (Sprint A)

EDIT LOG:
- 2026-04-15T00:40:00Z | copilot | added Sprint A status summary for sharing
-->

# Sprint A — Status (2026-04-15)

Branch: `feat/lang-modification`

Goal: implement trial funnel, pricing UI, payments wiring, and analytics for initial launch.

Summary of tickets:

- **A1 — Trial DB & Migration:** In-progress
  - What exists: `prisma/schema.prisma` contains the `Trial` model.
  - Pending: generate & apply Prisma migration, run `prisma generate`, add unit tests (create/read).

- **A2 — POST /api/trial:** Completed
  - Location: `app/api/trial/route.ts`
  - Status: Zod validation, duplicate-phone guard, server-side `trial_start` analytics write implemented.
  - Pending: unit tests (validation, DB write, analytics mock) and an e2e flow.

- **A3 — Landing CTA & Trial UI:** Partially done
  - Location: `components/TrialSignup.tsx`
  - Pending: wire CTA into landing/pricing pages, capture UTMs and forward them to the POST endpoint, improve success UX, add UI/e2e tests.

- **A4 — Trial Nudge Templates:** Completed
  - Location: `lib/whatsapp/templates.ts`
  - Pending: provider submission/approval and a snapshot test for template strings.

- **A5 — Trial Nudge Job (skeleton):** Completed (skeleton)
  - Location: `worker/jobs/trialNudges.ts`, `lib/whatsapp/provider.ts`
  - Pending: enqueueing/queue integration, schedule registration, unit tests, production provider wiring.

- **P1 — Pricing UI:** In-progress
  - Location: `components/PricingCard.tsx`
  - Pending: add `ENABLE_LITE_PLAN` feature flag, soft-link/hide Lite plan behavior, snapshot tests.

- **P2 — Central Plan Constants:** Completed
  - Location: `lib/billing/plans.ts`
  - Pending: run full type-check & test suite to catch any remaining import drift after refactor.

- **C1 — Razorpay create-subscription:** Not started
  - Pending: implement server route (e.g., `app/api/payments/create-subscription/route.ts`), client hookup, Razorpay key wiring, integration tests.

- **C2 — Webhook & Invoice:** In-progress
  - Location: `app/api/razorpay/webhook/route.ts`
  - Pending: invoke `createInvoiceForPayment()` on `payment.captured`, add idempotent invoice creation, and add webhook unit tests.

- **D1 — /api/analytics/track:** Completed
  - Location: `app/api/analytics/*` (batch + track endpoints implemented).
  - Pending: tests for validation and optional CAPI forwarding.

- **D2 — Frontend Instrumentation:** In-progress
  - Pending: add client-side instrumentation to emit `trial_start`, `trial_activate`, and `converted_to_paid` events from UI flows.

- **TST1 — Unit & Integration tests (Sprint A):** In-progress
  - Pending: add unit tests for trial API, trial nudges worker, webhook idempotency and integration tests for trial→paid flows; run CI.

- **OPS1 — Feature Flags & Env:** Not started
  - Pending: add env flags (`ENABLE_LITE_PLAN`, `WHATSAPP_PROVIDER`, `LAUNCH_COUPON_ENABLED`) and document them in README/deploy.


Why many items are marked "In-progress"
--------------------------------------

Most items moved quickly from design → implementation (models, endpoints, UI skeletons). Several required follow-ups are environment-dependent or operational:

- DB migration + client generation need a local/test DB and developer-run commands (`prisma migrate`, `prisma generate`).
- Payments and WhatsApp flows require provider keys/approval (Razorpay, WhatsApp Business) and safe test credentials.
- Worker scheduling/queue integration and some integration tests require running background services (Redis/BullMQ) and CI changes.

Because these follow-ups rely on running commands, secrets, or external approvals, the tasks are functionally started but not fully verifiable — hence "In-progress" rather than "Done".


How to share / copy
-------------------
Copy this file or share the repo link and point other devs to this file: `docs/sprint-A-status.md`.
