# 📘 Phase 12 — Regeneration Jobs (Admin Control Plane)

Phase Goal

Provide a safe, admin-only, observable control plane for content regeneration jobs — without allowing:

- Direct content mutation
- Generator invocation from UI
- Editing or deleting jobs
- Re-running completed jobs

This phase establishes human-in-the-loop regeneration control, not automation.

## Why Phase 12 Exists

Earlier phases intentionally separated:

- Insight generation (Phase 11)
- Content generation (Phases 6–7)
- Analytics (Phase 10)
- Phase 12 bridges intent → execution without violating immutability or safety guarantees.

## Core Principles

Principle Rule

- Insert-only RegenerationJob rows are never deleted or edited
- Explicit action Only admins may trigger regeneration
- Generator isolation UI/API never call generators
- Read-only UI JSON is observable, never editable
- Auditability Every lifecycle event is logged
- Determinism Triggering creates state change only
- Scope (What This Phase Covers)

## ✅ Admin UI to:

- List regeneration jobs
- Inspect job details
- Trigger pending jobs

## ✅ APIs to:

- Read job metadata
- Transition job state from PENDING → RUNNING

## ❌ Explicitly out of scope:

- Editing jobs
- Deleting jobs
- Retrying completed/failed jobs
- Background execution
- Steaming output
- Scheduling logic

Data Model (Assumed)
RegenerationJob {
id
status // PENDING | RUNNING | COMPLETED | FAILED
targetType
targetId
instructionJson
outputRef
errorJson
createdAt
createdBy
}

## Only status may change.

### API Contract

Method Route Purpose
GET /api/admin/regeneration-jobs List jobs
GET /api/admin/regeneration-jobs/[id] Job detail
POST /api/admin/regeneration-jobs/[id]/trigger Transition to RUNNING

No other HTTP verbs permitted.

### UI Pages

Path Description
/admin/regeneration-jobs Job list
/admin/regeneration-jobs/[id] Job detail

### UI is server-rendered, admin-only.

Audit Events
Event
REGEN_JOB_CREATED
REGEN_JOB_TRIGGERED
REGEN_JOB_COMPLETED
REGEN_JOB_FAILED

Audit failures must never block state transitions.

Completion Criteria

### Phase 12 is complete when:

- Admins can observe all regeneration jobs
- Admins can trigger pending jobs
- No mutation beyond status change is possible
- All actions are audited
- Tests enforce invariants
- No generators are callable from UI or routes

### What Comes Next

Phase 13 will:

- Execute jobs asynchronously
- Produce outputs
- Attach outputs to immutable references
- Surface results for human approval

You should run these prompts sequentially, only moving to the next after:

Code compiles

Tests pass

You visually inspect the output

🔷 Phase 12 — Copilot Prompt Set (Sectioned & Safe)

## How to use

Copy one prompt at a time
Paste into Copilot Chat
Let it finish
Run lint / type-check / tests
Then proceed to the next prompt

## 🧱 Prompt 12.1 — Establish Invariants (Read First)

Purpose: Anchor Copilot’s behavior for the entire phase
Run this first, always

We are implementing Phase 12: Regeneration Jobs Admin Control Plane.

Global invariants (do not violate in this phase):

- RegenerationJob rows are INSERT-ONLY
- No job may be edited or deleted
- Only status transitions are allowed
- Allowed status transition: PENDING → RUNNING only
- No generators may be called
- No content mutation is allowed
- UI and APIs are ADMIN-ONLY
- All job actions must be audited
- No background execution or scheduling
- No streaming or progress updates
- No retries or re-triggers for completed/failed jobs

If a change would violate these invariants, do NOT implement it.

Acknowledge and wait for next instruction.

✅ Expected output: Copilot confirms understanding, no code changes.

## 🔌 Prompt 12.2 — Admin API: List Regeneration Jobs

Maps to: Phase 12 → API Contract → List
Goal: Read-only list endpoint

Create a new admin-only API route:

GET /api/admin/regeneration-jobs

Requirements:

- Read-only
- Admin-auth guarded
- No pagination yet
- Sorted by createdAt DESC
- Returns minimal metadata:
  id, status, targetType, targetId, createdAt, createdBy

Constraints:

- Do not allow POST/PUT/PATCH/DELETE
- Return 405 for unsupported methods
- Do not modify any database rows
- Do not include instructionJson or outputRef here

Add unit tests asserting:

- Non-admin access is rejected
- PUT/DELETE return 405
- Returned data is sorted correctly

## 🔍 Prompt 12.3 — Admin API: Regeneration Job Detail

Maps to: Phase 12 → API Contract → Detail
Goal: Read-only job inspection

Create a new admin-only API route:

GET /api/admin/regeneration-jobs/[jobId]

Requirements:

- Read-only
- Admin-auth guarded
- Returns full job record:
  id, status, targetType, targetId,
  instructionJson, outputRef, errorJson,
  createdAt, createdBy

Constraints:

- No mutation
- No status change
- Return 404 if job not found
- Return 405 for non-GET methods

Add unit tests asserting:

- Admin can fetch job
- Non-admin is rejected
- Unsupported methods return 405

## ▶️ Prompt 12.4 — Admin API: Trigger Regeneration Job

Maps to: Phase 12 → Trigger Contract
This is the most critical prompt

Create a new admin-only API route:

POST /api/admin/regeneration-jobs/[jobId]/trigger

Behavior:

- Validate job exists
- Validate status === PENDING
- Inside a DB transaction:
  - Update status to RUNNING
  - Write audit event: REGEN_JOB_TRIGGERED
- Return updated job metadata

Constraints:

- Do NOT execute any generator
- Do NOT enqueue background work
- Do NOT modify any other fields
- If status !== PENDING → return 409 Conflict
- Unsupported methods return 405

Add unit tests asserting:

- Trigger works only for PENDING jobs
- Trigger is idempotent-safe
- Trigger does not call generators
- Audit log is written

## 🖥️ Prompt 12.5 — Admin UI: Job List Page (Server-rendered)

Maps to: Phase 12 → UI → Job List

Create a server-rendered admin page at:

/admin/regeneration-jobs

UI requirements:

- Server component
- Admin-only guard
- Fetch from GET /api/admin/regeneration-jobs
- Display table columns:
  id, status badge, targetType, targetId, createdAt
- Each row links to detail page

Constraints:

- No client-side fetching
- No mutations
- No buttons
- No inline JSON editing

## 📄 Prompt 12.6 — Admin UI: Job Detail Page

Maps to: Phase 12 → UI → Job Detail

Create a server-rendered admin page at:

/admin/regeneration-jobs/[jobId]

Render:

- Job metadata
- instructionJson (read-only)
- outputRef (read-only, if exists)
- errorJson (read-only, if exists)
- Audit events (if available)

Trigger Button:

- Visible only when status === PENDING
- POSTs to trigger endpoint
- Disabled while submitting
- Redirects back to same page

Constraints:

- No editing
- No retry button
- No delete button

## 🧩 Prompt 12.7 — ReadOnlyJsonViewer Component

Maps to: Phase 12 → UI Utilities

Create a reusable ReadOnlyJsonViewer component.

Features:

- Pretty-printed JSON
- Collapsible nodes
- Copy-to-clipboard button
- Download JSON button

Constraints:

- Absolutely read-only
- No textarea or input
- No mutation handlers
- Used for instructionJson, outputRef, errorJson

## 📋 Prompt 12.8 — Audit Logging Hardening

Maps to: Phase 12 → Audit

Ensure audit logging exists for:

- REGEN_JOB_TRIGGERED

Requirements:

- Non-blocking
- Failures must not stop the request
- Include admin user id and job id
- Centralized helper preferred

Add a unit test asserting audit is called on trigger.

## 🧪 Prompt 12.9 — Final Safety & Regression Tests

Maps to: Phase 12 → Completion Criteria

Add regression tests to enforce Phase 12 invariants:

- ❌ Job cannot be triggered twice
- ❌ Completed/Failed jobs cannot be triggered
- ❌ PUT/PATCH/DELETE not allowed anywhere
- ❌ No generator functions are imported or called
- ✅ Status transition only affects status column

Run:

- npm run lint
- npm run type-check
- npm test

Fix any violations before stopping.

🛑 STOP POINT

After Prompt 12.9, Phase 12 is complete.

Do not proceed to execution, scheduling, retries, or Phase 13 unless explicitly instructed.

✅ Why This Will Work

- Each prompt has one responsibility
- Constraints are locally restated
- Copilot can reason within context limits
- No hallucination space
- Easy to debug if something goes wrong

# Summary of Phase 12 implemetation

## What Was Intended?

- Goal: Build a safe, admin-only control plane for RegenerationJobs: list, inspect, and trigger jobs without allowing edits or generator runs.
- Deliverables: Read-only APIs (GET list/detail, POST trigger), server-rendered admin UI pages, a reusable read-only JSON viewer, non-blocking audit for REGEN_JOB_TRIGGERED, and tests enforcing Phase‑12 invariants.

## What Did We Complete?

- APIs: route.ts (list), route.ts (trigger — now calls centralized non-blocking audit).
- UI: Server pages page.tsx (list) and page.tsx (detail); client trigger button TriggerJobButton.tsx.
- UI Utility: Added ReadOnlyJsonViewer.tsx (client component with collapsible view, copy, download).
- Audit: Central helper log.ts used; trigger path switched to fire‑and‑forget logAuditEvent to satisfy “non‑blocking” requirement.
- Tests: Updated regenerationJobs.trigger.test.ts; added regression tests regenerationJobs.regressions.test.ts enforcing invariants (double-trigger, completed/failed blocking, method 405s, no generators imported, status-only update).
  Verification: Ran lint, type-check, and full test suite — all green (full test run after changes: 42 suites, 104 tests passed).

## What Is Pending?

- Integration: Replace raw <pre/> JSON rendering in page.tsx with the new ReadOnlyJsonViewer.tsx.
- UI Tests: End-to-end or integration tests for admin detail page + trigger flow (client behavior, redirect, error handling).
  Audit resilience: Consider stronger handling/monitoring for audit failures (alerts, metrics, or a durable fallback) beyond current fire‑and‑forget logging.
  UX / Scale: Pagination/filtering for the list endpoint and richer audit browsing in the admin UI (optional, future phases).

## Suggestions

- Integrate viewer now: I can wire ReadOnlyJsonViewer into page.tsx and re-run checks (recommended next step).
- Add an E2E test: Add one Cypress/Playwright test to exercise admin trigger end‑to‑end (auth, POST trigger, page reload, audit presence).
  Monitor audit writes: Add a lightweight metric/alert when logAuditEvent emits warnings so audit failures become observable.
- Future improvement: Add server-side pagination and filtering to the list API if the job set grows.
