📘 PHASE 14 — REGENERATION GOVERNANCE & RETRY CONTROL
# 1. Phase 14 — Purpose & Positioning
Why Phase 14 exists

By the end of Phase 13, the system can:
- Execute regeneration jobs exactly once
- Produce immutable outputs
- Separate control plane (admin/UI) from execution plane (worker)

However, the system is currently terminal:
- FAILED jobs cannot be retried
- COMPLETED jobs cannot be superseded
- Admins can observe failures but not govern recovery

Phase 14 introduces human-governed recovery without breaking:
- Immutability
- Auditability
- Execution isolation
- Determinism

# 2. Core Principles (Non-Negotiable)

Phase 14 MUST preserve all of these:
- No mutation of existing jobs or outputs
- Retries create new lineage, never reuse
- Admins approve intent, workers execute
- Retry is explicit, audited, and reasoned
- No generators run from APIs or UI
- Every retry is explainable post-hoc
If any of these are violated → Phase 14 is incorrect.

# 3. High-Level Concept
Introduce a new first-class concept: RetryIntent

A RetryIntent is:
An admin-created, audited declaration:
- “I want this failed job to be retried, for this reason, under these constraints.”
It does not:
- Execute generators
- Modify jobs
- Modify outputs
It simply authorizes the system to create a new RegenerationJob.

# 4. New Domain Objects
## 4.1 RetryIntent (NEW)
RetryIntent {
  id
  sourceJobId        // original FAILED job
  sourceOutputRef?   // optional, if output exists
  reasonCode         // enum
  reasonText         // admin explanation
  approvedBy         // admin user id
  approvedAt
  status             // PENDING | CONSUMED | REJECTED
  createdAt
}


Invariants
Insert-only
Status can only move forward
One RetryIntent can only be consumed once

## 4.2 RegenerationJob (EXTENSION)

Add lineage fields (no behavior change):
retryOfJobId?        // points to original job
retryIntentId?       // points to RetryIntent

Invariant
retryOfJobId is immutable
retryIntentId must be unique per job

## 5. Lifecycle Flow (Authoritative)
FAILED Job
   ↓
Admin reviews failure
   ↓
Admin creates RetryIntent (audited)
   ↓
System creates NEW RegenerationJob (PENDING)
   ↓
Worker claims & executes (Phase 13 rules)
   ↓
New RegenerationOutput (immutable)


At no point:
Is the original job modified
Is the original output overwritten

## 6. Phase 14 Sub-Phases
🔹 Phase 14.1 — Prisma Schema Changes
What we add
RetryIntent model
Extend RegenerationJob with lineage fields
Unique constraints for idempotency
What we do NOT add
No retry counters
No status resets
No cascading deletes

### Copilot Prompt — Phase 14.1 (Schema)

Copilot Prompt (run alone):

Add Phase 14 regeneration governance models.

Tasks:
Update schema.prisma:
Add model RetryIntent with fields:
id (cuid)
sourceJobId (string)
sourceOutputRef (string?, nullable)
reasonCode (enum RetryReasonCode)
reasonText (string)
approvedBy (string)
approvedAt (DateTime)
status (enum RetryIntentStatus)
createdAt (DateTime @default(now()))

Add enums:
RetryIntentStatus = PENDING | CONSUMED | REJECTED
RetryReasonCode = TRANSIENT_FAILURE | BAD_INPUT | IMPROVED_PROMPT | INFRA_ERROR | OTHER

Extend RegenerationJob:
Add retryOfJobId (string?, immutable)
Add retryIntentId (string?, unique)
Do NOT modify existing fields or behavior.

Generate Prisma client.

Do not write APIs or business logic yet.

## 🔹 Phase 14.2 — RetryIntent Store Layer
Purpose

- Centralize persistence
- Enforce idempotency
- Emit audit events

Required Functions
createRetryIntent(...)
consumeRetryIntent(...)
listRetryIntentsForJob(jobId)

Invariants
Only FAILED jobs allowed
Only admin callers
Consumed intents cannot be reused

### Copilot Prompt — Phase 14.2 (Store)
Copilot Prompt:

Implement the RetryIntent persistence layer.

Tasks:
Create lib/retryIntent/store.ts.

Implement:
createRetryIntent(input)
Validate source job exists and is FAILED
Insert RetryIntent with status=PENDING
Emit audit event RETRY_INTENT_CREATED (non-blocking)
consumeRetryIntent(id, tx)
Transition status PENDING → CONSUMED using guarded update
Throw if already consumed

Ensure:
Insert-only semantics
No generator imports
Prisma access via injected client

Add unit tests covering:
Cannot retry non-FAILED job
Idempotency on consume

Do not add APIs or UI.

## 🔹 Phase 14.3 — Retry Job Creation Service
Purpose

Convert a RetryIntent into a new RegenerationJob

Key Rule
This is job creation, not execution.

### Copilot Prompt — Phase 14.3 (Service)

Copilot Prompt:

Implement retry job creation from RetryIntent.

Tasks:
Create lib/regeneration/retryService.ts.

Implement createRetryJobFromIntent(intentId):
Run inside a DB transaction
Consume RetryIntent (PENDING → CONSUMED)

Create new RegenerationJob:
status = PENDING
retryOfJobId = sourceJobId
retryIntentId = intentId
Emit audit event REGEN_JOB_RETRIED

Enforce:
Exactly one job per RetryIntent
No mutation of original job

Add unit tests for:
Double execution blocked
Transactional safety

Do not touch worker code.

## 🔹 Phase 14.4 — Admin APIs
APIs (Admin-only)
POST /api/admin/retry-intents
POST /api/admin/retry-intents/:id/execute
GET /api/admin/retry-intents?jobId=

Guards
Admin auth
FAILED job only
No generator calls

### Copilot Prompt — Phase 14.4 (APIs)

Copilot Prompt:
Add admin APIs for RetryIntent governance.

Tasks:

Create admin routes:
POST create retry intent
POST execute retry intent (creates new job)
GET list retry intents for job

Enforce:
Admin-only access
Source job must be FAILED
Execute endpoint calls retryService only

Emit audit events:
RETRY_INTENT_CREATED
RETRY_INTENT_EXECUTED

Add API tests for:
Unauthorized access
Double execution blocked

Do not modify worker or generator code.

## 🔹 Phase 14.5 — Admin UI
Pages

Failed Job Detail → “Retry” section
RetryIntent list with status
RetryIntent detail (read-only)
“Execute Retry” button

### Copilot Prompt — Phase 14.5 (UI)

Copilot Prompt:
Build admin UI for RetryIntent governance.

Tasks:
Add RetryIntent section to failed job detail page.

Display:
reason
status
approvedBy / approvedAt

Add Execute button:
Calls POST execute endpoint
Disabled if status != PENDING

UI must be:
Read-only
Server-rendered where possible
Reuse ReadOnlyJsonViewer for evidence.

Do not allow edits or deletes.

## 🔹 Phase 14.6 — Tests & Invariant Enforcement
Required Tests

RetryIntent idempotency
Job lineage correctness
Worker executes retried job normally
Original output untouched

### Copilot Prompt — Phase 14.6 (Tests)

Copilot Prompt:

Add Phase 14 invariant tests.

Tasks:

Add tests asserting:
Retried job produces new output
Original job/output unchanged
RetryIntent cannot be reused

Add regression test:
No generator imports in admin APIs
Ensure full test suite passes.
Do not weaken existing Phase 13 tests.

✅ Phase 14 Completion Criteria

Phase 14 is DONE when:
RetryIntent exists and is audited
New jobs are created via retry, not mutation
Worker executes retried jobs unchanged
Admin has visibility and control
All invariants are enforced by tests


# What Was Intended (Phase 14)

## Goal: Add human-governed, auditable retry control without changing execution-plane invariants.
New concept: RetryIntent — an admin-created, insert-only intent that authorizes creating a new RegenerationJob.
Schema changes: Add RetryIntent model + enums (RetryIntentStatus, RetryReasonCode); extend RegenerationJob with retryOfJobId and retryIntentId.
Store/service: Provide a store to create/consume/list intents and a service to atomically consume an intent and create a new job (transactional, idempotent).
APIs: Admin-only routes to create/list/execute intents (no generator calls in APIs).
Invariants: No mutation of existing jobs/outputs; retries create new jobs; single-consumption of an intent; full audit trail.

## What We Accomplished
Schema: Updated schema.prisma with enums and RetryIntent model; added lineage fields to RegenerationJob; created migrations and applied them to DB.
Persistence: Implemented store.ts with createRetryIntent, consumeRetryIntent, listRetryIntentsForJob and unit tests enforcing FAILED-job guard and consume idempotency.
Service: Implemented retryService.ts with transactional createRetryJobFromIntent (consume intent → create new RegenerationJob) and unit tests (double-execution blocked, transactional safety).
APIs: Added admin routes:
POST /api/admin/retry-intents — create intent (admin-only, audited).
POST /api/admin/retry-intents/:id/execute — execute intent (calls retry service).
GET /api/admin/retry-intents?jobId= — list intents for a job.
Tests ensure admin-guard and idempotency; regression test added to assert admin APIs do not import generators.
Worker safety: Kept Phase 13 worker semantics unchanged.
Tests: Added Phase 14 invariant tests (lineage, original outputs unchanged, idempotency) and many unit/integration tests; full local test suite now passes.
Migrations & Client: Created migration files and successfully ran npx prisma migrate deploy and npx prisma generate against the configured DB.

## What Is Still Pending
CI/Test DB sync: Ensure CI and all test environments apply the new migrations (we ran migrate deploy locally — CI must do the same).
End-to-end DB-backed integration coverage: Add or expand E2E tests that exercise full admin → execute → worker end-to-end on CI (some DB-backed tests were added and pass locally).
Admin UI: Phase 14 UI pages (failed-job Retry section, intent list/detail, execute button) remain to be implemented.
Observability/metrics: Optional: add metrics/alerts for retry intent creation/consumption and job retries.
Deployment checklist: Communicate migration window, backups, and rollout plan for production (required before deploy).

## Suggestions
CI: Add a migration step to CI pipeline that runs npx prisma migrate deploy before tests/build to keep DB in sync. Example:
Audit & Monitoring: Emit metrics for RETRY_INTENT_CREATED / RETRY_INTENT_CONSUMED and alert on unusual retry rates (surge → investigation).
UI UX guardrails: Implement read-only admin UI with clear reason/approvedBy fields and a disabled/confirm modal for execute (force admin confirmation and require reason text).
Operational: Document migration and rollback steps in WORKFLOWS.md and add a short runbook entry for retry governance operations.
Security: Ensure admin APIs are RBAC-guarded and audit logs include actor, IP, and request context.
Would you like me to:
## Next steps
Add the CI migration step to the repo (CI config), or
Scaffold the admin UI pages for RetryIntents, or
Open a PR with a summary and migration notes?


# Open AI Feedback
This is a very strong Phase 14 outcome — Copilot executed it correctly and, importantly, did not violate any execution-plane or immutability guarantees. Well done.

Now let me answer clearly and decisively what comes next and what you should instruct Copilot to do, in the right order, without rework.

First: Is Phase 14 “functionally complete”?

Backend & governance: ✅ YES
Operationally shippable: ⚠️ Almost
Admin-usable end-to-end: ❌ Not yet (UI missing)

Phase 14 is architecturally complete, but not operationally usable by humans until the admin UI exists and CI is migration-safe.

So the next steps are not new features, but Phase 14 hardening + completion.

What to do next (Correct Order)
✅ Step 1 (MANDATORY): Add CI Prisma migration step
✅ Step 2 (MANDATORY): Implement Admin UI for RetryIntents
🔶 Step 3 (OPTIONAL but recommended): Minimal observability
⏭️ Only then move to Phase 15

I’ll give you Copilot-ready instructions for Step 1 and Step 2, broken down cleanly.

🔹 STEP 1 — CI Prisma Migration Sync (DO THIS FIRST)
Why this must be first
You already changed the schema
CI must never run tests against an old DB
Otherwise Phase 14 becomes fragile and non-repeatable
What success looks like
CI runs prisma migrate deploy before tests
No schema drift between local / CI / prod

🧠 Copilot Prompt — CI Migration Step

Copilot Prompt (run alone):

Update CI pipeline to apply Prisma migrations before tests.

Tasks:
Locate the CI workflow(s) that run tests/build (GitHub Actions or equivalent).

Before running tests:
Add step: npx prisma migrate deploy
Ensure DATABASE_URL is available (use existing CI secrets).

Ensure order is:
install deps
prisma generate
prisma migrate deploy
tests / build
Do NOT add migrate dev to CI.
Update CI comments or README if needed.
Goal: CI DB schema always matches repo schema.

✅ Commit this as something like:
chore(ci): apply prisma migrations before tests

## 🔹 STEP 2 — Admin UI for RetryIntents (Phase 14 UI Completion)

This is the last missing core deliverable of Phase 14.
You already did this pattern in Phase 12 and Phase 11 — reuse it.

### 2.1 UI Scope (STRICT)
Pages to build
RetryIntents List (per Job)
RetryIntent Detail
Execute Retry Button
Explicitly forbidden
❌ Edit RetryIntent
❌ Delete RetryIntent
❌ Run generators
❌ Modify jobs directly

2.2 Page Breakdown
A) Failed Job Detail → Retry Section

Shows
Existing RetryIntents
Status badge (PENDING / CONSUMED / REJECTED)
ReasonCode + ReasonText
ApprovedBy / ApprovedAt
Actions
“Create Retry Intent” (modal/form)
“Execute Retry” (only if PENDING)

B) RetryIntent Detail Page
Read-only
Full RetryIntent JSON (via ReadOnlyJsonViewer)
Linked sourceJobId
Status
Audit trail (if available)

### 2.3 Copilot Prompt — RetryIntent List UI

Implement admin UI list for RetryIntents.
Tasks:
Add a server-rendered admin page:
Route: /admin/jobs/[jobId]/retry-intents
Fetch retry intents via existing admin API.
Display table with:
id
status
reasonCode
approvedBy
approvedAt
Add link to RetryIntent detail page.
Page must be:
Admin-only
Read-only
Do not add any mutation logic yet.

### 2.4 Copilot Prompt — Create RetryIntent Form

Add UI to create a RetryIntent from a FAILED job.
Tasks:
Add a form/modal on failed job detail page.
Fields:
reasonCode (select enum)
reasonText (required textarea)
Submit to POST /api/admin/retry-intents.
On success:
Refresh list
Show confirmation
Enforce:
Disabled if job is not FAILED
Admin-only
Do not allow editing after creation.

### 2.5 Copilot Prompt — Execute Retry Button

Add Execute Retry button for RetryIntent.
Tasks:
On RetryIntent detail page:
Show Execute button if status === PENDING.
Button behavior:
Confirmation dialog explaining:
“This will create a new regeneration job.”
On confirm:
POST /api/admin/retry-intents/:id/execute
On success:
Redirect to new RegenerationJob detail
Disable button if status != PENDING.
Do not run generators or call worker code.

### 2.6 Copilot Prompt — RetryIntent Detail Page

Implement RetryIntent detail admin page.
Tasks:
Server-render page at:
/admin/retry-intents/[id]

Display:
Metadata fields
Status badge
Source job link
Render full RetryIntent JSON using ReadOnlyJsonViewer.
Include Execute button (from previous step).
No edits, no deletes.

✅ Phase 14 Completion Checklist (Final)

Phase 14 is DONE when:
- RetryIntent schema + migration exists
- Store + service enforce idempotency
- APIs are admin-only and audited
- Worker unchanged
- CI applies migrations
- Admin UI allows humans to govern retries
- After Step 2 → Phase 14 is fully closed.

What Comes Next (Preview)
- Once Phase 14 UI is done, the system now supports:
- Observation → Signal → Suggestion → Retry → Execution → New Output
That unlocks Phase 15: