<!--
FILE OBJECTIVE:
- Shareable Sprint A status summary for engineering & stakeholders.

LINKED TODO:
- /manage_todo_list (Sprint A)

EDIT LOG:
- 2026-04-15T00:40:00Z | copilot | added Sprint A status summary for sharing
-->

Planned tasks
Sprint A Tickets

A1 — Trial DB + Migration: Add a Prisma Trial model (id, userId?, phone, parentName, childClass, utm fields, startAt, expiresAt, status ENUM). Create & run additive migration.

Acceptance: prisma.trial exists; sample trial record can be created from server.
Files/changes: schema.prisma (new model), DB migration.
Tests: unit test for create/read trial via Prisma client.
Estimate: 4h
Owner: Backend
A2 — POST /api/trial (create trial): Implement server endpoint to create trial, validate with Zod, prevent duplicate active trial per phone, persist UTM, emit trial_start analytics event.

Acceptance: POST /api/trial responds 201 with trial id; analytics event logged; input validated.
Files/changes: new app/api/trial/route.ts (or pages/api/trial.ts), use client.ts.
Tests: unit tests for validation, DB write, analytics call mocked.
Estimate: 6h
Owner: Backend
A3 — Landing CTA & Trial UI: Wire landing/pricing CTA to /api/trial. Capture parent name, WhatsApp/phone, child class, optional school, UTM from page.

Acceptance: Client posts to /api/trial, shows success toast and next steps (WhatsApp messages scheduled). No payments required.
Files/changes: update landing component(s) and PricingCard.tsx to add CTA; add small client-side trial form component components/TrialSignup.tsx.
Tests: UI test for form validation; end-to-end test for POST.
Estimate: 6h
Owner: Frontend
A4 — Trial Nudge Templates (prepare): Create stored WhatsApp templates for Day 2 / Day 5 / Day 12 and wire template IDs for provider.

Acceptance: Templates exist in lib/whatsapp/templates.ts (or DB table) and are ready for provider submission.
Files/changes: new lib/whatsapp/templates.ts or prisma table seed.
Tests: snapshot test for template strings.
Estimate: 2h
Owner: Product / Backend
A5 — Trial Nudge Job (skeleton + mock send): Add a scheduled worker job that finds trials at +2, +5, +12 days and enqueues messages (mock provider send; actual sending in Sprint B).

Acceptance: Job logs found trials and inserts QueuedMessage records (or marks sent in mock table).
Files/changes: new worker worker/jobs/trialNudges.ts, optional DB table QueuedMessage.
Tests: unit test for job logic using in-memory DB.
Estimate: 4h
Owner: Backend / Worker
P1 — Pricing UI: Inclusive copy + Lite soft-link: Update pricing UI to show Standard ₹399/month (Inclusive of all taxes) prominently and move Lite ₹249 behind a secondary link controlled by ENABLE_LITE_PLAN feature flag.

Acceptance: Standard is visually primary; Lite not shown by default; copy exactly matches inclusive phrasing.
Files/changes: PricingCard.tsx, update any pricing fragments, add feature flag ENABLE_LITE_PLAN.
Tests: visual/regression snapshot for PricingCard.
Estimate: 3h
Owner: Frontend
P2 — Central Plan Constants (server): Add lib/billing/plans.ts (Plan enum + paise prices + billingCycle ids). Use constants in checkout & invoices instead of hardcoded numbers.

Acceptance: Checkout and invoice code read plan values from new constants.
Files/changes: new lib/billing/plans.ts, update PaymentConfirmation.tsx to display plan.billedRupees from constants.
Tests: unit test for plan constants export and formatting helper.
Estimate: 3h
Owner: Backend / Frontend
C1 — Razorpay: create-subscription API & client flow: Implement server API /api/payments/create-subscription that creates Razorpay order/subscription (or returns checkout session), and update UpgradeFlow/PaymentConfirmation to call it. Ensure handler verifies payment & returns result.

Acceptance: Client requests checkout session → opens Razorpay → on success server verifies payment and creates subscription DB row.
Files/changes: UpgradeFlow.tsx, new app/api/payments/create-subscription/route.ts, update webhook handling.
Tests: integration test simulating payment success call and DB subscription creation (mock Razorpay).
Estimate: 12h
Owner: Backend + Frontend
C2 — Webhook handler + invoice generation: Implement /api/payments/webhook to handle Razorpay payment events idempotently, call createInvoiceForPayment() (reuse index.ts), and persist payment/subscription mapping.

Acceptance: Webhook processes event once, invoice PDF created & fileUrl saved, analytics converted_to_paid emitted.
Files/changes: new app/api/payments/webhook/route.ts, update index.ts usage.
Tests: webhook idempotency test + invoice generation unit test.
Estimate: 6h
Owner: Backend
D1 — /api/analytics/track server endpoint: Provide server route to accept analytics events (trial_start, converted_to_paid, trial_end_warning) and write into analytics table so existing aggregator works.

Acceptance: POST /api/analytics/track stores events with eventType, metadata, userId?, utm.
Files/changes: new route.ts or extend existing analytics endpoint; use client.ts.
Tests: unit tests for event validation and DB write.
Estimate: 4h
Owner: Backend
D2 — Instrument frontend events: Emit trial_start on successful /api/trial, trial_activate after first 3 sessions (client check), and converted_to_paid on successful subscription. Send both client-track AND server-track (server-side forwarding/CAPI).

Acceptance: Events visible in analytics DB; Meta pixel + server CAPI receive conversion for paid events.
Files/changes: update landing/trial UI, GoogleTagManager.tsx, update PaymentConfirmation.tsx.
Tests: e2e tests asserting events are created after flows.
Estimate: 6h
Owner: Frontend + Backend
TST1 — Unit & Integration tests (Sprint A): Add unit tests for new endpoints, DB models and core flows; integration test for trial→mocked payment path and webhook processing.

Acceptance: New tests run in CI; coverage added for changed files.
Files/changes: tests/unit/... and tests/integration/...
Estimate: 8h
Owner: QA / Dev
OPS1 — Feature flags + env setup: Add ENABLE_LITE_PLAN, WHATSAPP_PROVIDER, LAUNCH_COUPON_ENABLED env flags; document how to enable in deploy or README.

Acceptance: Flags toggle UI/behavior without code deploy (via env).
Estimate: 1h
Owner: DevOps

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

## Why many items are marked "In-progress"

Most items moved quickly from design → implementation (models, endpoints, UI skeletons). Several required follow-ups are environment-dependent or operational:

- DB migration + client generation need a local/test DB and developer-run commands (`prisma migrate`, `prisma generate`).
- Payments and WhatsApp flows require provider keys/approval (Razorpay, WhatsApp Business) and safe test credentials.
- Worker scheduling/queue integration and some integration tests require running background services (Redis/BullMQ) and CI changes.

Because these follow-ups rely on running commands, secrets, or external approvals, the tasks are functionally started but not fully verifiable — hence "In-progress" rather than "Done".

## How to share / copy

Copy this file or share the repo link and point other devs to this file: `docs/sprint-A-status.md`.
