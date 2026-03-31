📘 PHASE 11 — Adaptive Intelligence (Human-in-the-Loop)
1️⃣ Phase 11 — Why This Phase Exists

Up to Phase 10, the system can:

Generate content safely
Publish immutable packages
Observe learner behavior
Produce analytics signals

What it cannot yet do:
Turn insight into actionable intelligence without breaking trust.

Phase 11 introduces interpretation + recommendation, not mutation.

2️⃣ Phase 11 — Core Principle (Non-Negotiable)
The system may observe and suggest — but never change content automatically.
This ensures:
No silent regressions
No hallucinated rewrites
No circular self-training
Full human accountability

3️⃣ Phase 11 — Conceptual Architecture
AnalyticsEvent (raw)
      ↓
AnalyticsDailyAggregate
      ↓
AnalyticsSignal (rule-based)
      ↓
Insight Engine (Phase 11)
      ↓
ContentSuggestion (immutable)
      ↓
Admin Review UI


🚫 No path back into generators
🚫 No auto-approval
🚫 No model retraining

4️⃣ Phase 11 — Data Models
11.1 ContentSuggestion (Core Model)

This is the single output of Phase 11.

Prisma Schema
enum SuggestionScope {
  COURSE
  MODULE
  LESSON
  QUIZ
}

enum SuggestionType {
  LOW_COMPLETION
  HIGH_RETRY
  DROP_OFF
  LOW_ENGAGEMENT
  CONTENT_CLARITY
}

enum SuggestionSeverity {
  LOW
  MEDIUM
  HIGH
}

enum SuggestionStatus {
  OPEN
  ACCEPTED
  DISMISSED
}

model ContentSuggestion {
  id            String   @id @default(cuid())
  courseId      String
  scope         SuggestionScope
  targetId      String
  type          SuggestionType
  severity      SuggestionSeverity
  message       String
  evidenceJson  Json
  status        SuggestionStatus @default(OPEN)
  createdAt     DateTime @default(now())
}


Rules
Insert-only
Status is the only mutable field
Evidence must be reproducible

5️⃣ Phase 11 Activities (With Copilot Instructions)
🧠 11.2 Insight Engine (Rule Interpreter)
Goal

Convert AnalyticsSignal → ContentSuggestion

Copilot Instruction — Insight Engine
Create the Insight Engine that converts AnalyticsSignal records
into ContentSuggestion records.

File: src/insights/engine.ts

Requirements:
- Export generateSuggestionsForSignal(signal)
- Use pure deterministic rule mapping
- Each signal maps to 1+ suggestions
- Populate:
  - message (human-readable)
  - severity (rule-based)
  - evidenceJson (metrics snapshot)

Rules:
- No DB reads except the signal itself
- No deduplication
- No content mutation
- Suggestions must be reproducible from inputs

Do NOT:
- Call any generator
- Modify syllabus/lesson/package tables

Example Mapping (Implicit)
Signal	Suggestion
LOW_COMPLETION	Lesson too long / unclear
HIGH_RETRY	Quiz ambiguity
DROP_OFF	Module difficulty spike


🧾 11.3 Suggestion Persistence
Goal

Persist suggestions immutably.

Copilot Instruction — Store Layer
Create a persistence helper for ContentSuggestion.

File: src/insights/store.ts

Functions:
- saveSuggestions(suggestions[])
- listSuggestions(filters)
- updateSuggestionStatus(id, status)

Rules:
- Only status can be updated
- All writes must be audited
- No deletes
- Use Prisma client injection pattern

🧪 11.4 Tests (Mandatory)
Goal
Guarantee determinism + safety.

Copilot Instruction — Tests
Add unit tests for Phase 11.

Paths:
- tests/phase11/engine.test.ts
- tests/phase11/store.test.ts

Test cases:
- Same AnalyticsSignal always produces same suggestions
- EvidenceJson matches expected metrics
- Status transitions work (OPEN → ACCEPTED / DISMISSED)
- No other fields can be mutated

Do NOT mock Prisma excessively; use test DB injection.

🔒 11.5 Admin APIs (Read / Review)
## APIs
Route	Purpose
GET /api/admin/suggestions	List
POST /api/admin/suggestions/:id/accept	Approve
POST /api/admin/suggestions/:id/dismiss	Reject

# Copilot Instruction — Admin APIs
Implement admin-only APIs for ContentSuggestion.

Files:
- src/app/api/admin/suggestions/route.ts
- src/app/api/admin/suggestions/[id]/accept/route.ts
- src/app/api/admin/suggestions/[id]/dismiss/route.ts

Rules:
- Admin auth required
- Accept/Dismiss updates status only
- Log audit event on every action
- No deletes
- No edits to message or evidence

# 🖥️ 11.6 Admin UI (Review Dashboard)
UI Capabilities

List suggestions

Filter by severity, course, scope

View evidence JSON

Accept / Dismiss

🚫 No edit
🚫 No regenerate
🚫 No approve chain

## Copilot Instruction — UI
Create an admin UI for reviewing content suggestions.

Path:
- app/admin/suggestions/page.tsx
- components/SuggestionCard.tsx

Features:
- Server-rendered list
- Severity badge
- Expandable evidence viewer
- Accept / Dismiss buttons

Rules:
- Read-only except status
- Optimistic UI allowed
- No client-side mutation of suggestion data

# 🧾 11.7 Audit Logging
## Copilot Instruction — Audit
Ensure every suggestion lifecycle action is audited.

Events:
- SUGGESTION_CREATED
- SUGGESTION_ACCEPTED
- SUGGESTION_DISMISSED

Rules:
- Non-blocking
- Never throw
- Include suggestionId, adminId (if applicable)

# ⏰ 11.8 Job Wiring (Optional but Recommended)
## Copilot Instruction — Job Hook
Wire Insight Engine into nightly analytics job.

When:
- After generateSignalsForAllCourses()

Steps:
- Fetch new AnalyticsSignal records
- Generate ContentSuggestions
- Persist them

Rules:
- Idempotent per signal
- Guard against duplicates if signal already processed
- Use job lock

6️⃣ Phase 11 Completion Checklist

✅ Suggestions generated automatically
✅ Zero content mutation
✅ Deterministic + reproducible
✅ Admin-controlled acceptance
✅ Fully auditable
✅ No generator coupling

7️⃣ What Phase 11 Enables (Strategically)

After Phase 11, your system gains:

Institutional memory

Quality evolution without risk

Explainable AI assistance

Human-aligned intelligence

Long-term trust

8️⃣ What Comes Next (Phase 12 Preview)

Phase 12: Guided Regeneration

Suggestions become inputs

Human explicitly triggers regeneration

Side-by-side diffing

Versioned upgrades

But only after Phase 11 is stable.


Great question. Phase 11 is almost complete prompt-wise, but a few critical Copilot prompts were implicit, not explicitly written. Below is a clean, exhaustive list of the missing prompts, written in Copilot-ready, copy-pasteable form, with no overlap with what you already have.

I’ll group them by what gap they close.

✅ What You Already Have (for clarity)

You already received prompts for:

Insight Engine logic

Store layer

Admin APIs

Admin UI

Audit logging

Job hook (optional)

Tests (engine + store)

So we will not repeat those.

🔴 MISSING PROMPTS — PHASE 11

These are required to complete Phase 11 cleanly, safely, and production-ready.

🧱 11.A Prisma Migration Prompt (Missing)

You defined the schema, but did not give Copilot the migration + safety rules prompt.

Copilot Prompt — Prisma Migration
Add Prisma schema and migration for Phase 11 ContentSuggestion.

Steps:
1. Update schema.prisma:
   - Add enums:
     SuggestionScope, SuggestionType, SuggestionSeverity, SuggestionStatus
   - Add ContentSuggestion model exactly as specified in PHASE_11.md

2. Generate migration:
   - Name: add_content_suggestions
   - Ensure JSON field uses Prisma Json
   - No foreign key cascades
   - No soft-delete field

3. Validate:
   - prisma generate
   - prisma migrate dev
   - Ensure no existing tables are modified

Rules:
- Insert-only semantics
- Status is the only mutable column
- No indexes yet unless explicitly requested


Why this matters:

Prevents accidental cascades

Prevents soft-delete creep

Locks immutability at DB level

🧩 11.B Signal → Suggestion Mapping Registry (Missing)

Right now, mapping logic is implicit. You need a single deterministic registry.

Copilot Prompt — Mapping Registry
Create a deterministic mapping registry for AnalyticsSignal → ContentSuggestion.

File: src/insights/mappings.ts

Requirements:
- Export mapSignalToSuggestions(signal)
- Pure function (no DB access)
- One signal can emit multiple suggestions
- Each mapping defines:
  - scope
  - type
  - severity
  - message template
  - evidence selector

Rules:
- No randomness
- No date/time logic
- Mapping must be exhaustively switch-based on signal.type
- Throw error on unknown signal types


Why this matters:

Prevents silent logic drift

Makes suggestions explainable

Enables future review/versioning

🧪 11.C Mapping Registry Tests (Missing)

You tested the engine, but not the mapping table itself.

Copilot Prompt — Mapping Tests
Add unit tests for AnalyticsSignal → ContentSuggestion mappings.

File: tests/phase11/mappings.test.ts

Test cases:
- Each signal type produces expected suggestion types
- Severity mapping is correct
- EvidenceJson contains expected metrics
- Unknown signal type throws error

Rules:
- Use snapshot-style expectations for evidenceJson
- No Prisma usage


Why this matters:

Protects logic from regression

Guarantees reproducibility

🔁 11.D Idempotency Guard Prompt (Missing)

Phase 11 must not re-emit suggestions repeatedly for the same signal.

Copilot Prompt — Idempotency Guard
Add idempotency protection for ContentSuggestion creation.

Approach:
- Extend ContentSuggestion with sourceSignalId (String)
- Enforce unique constraint on (sourceSignalId, type, targetId)

Update:
- Prisma schema
- Insight Engine persistence logic

Rules:
- Same signal must never create duplicate suggestions
- Engine must skip already-processed signals
- Do NOT delete or overwrite suggestions


Why this matters:

Prevents noise explosion

Makes nightly jobs safe

🔐 11.E Admin Authorization Guard Prompt (Missing)

You mentioned “admin-only”, but did not specify enforcement logic.

Copilot Prompt — Admin Guard
Add a reusable admin authorization guard.

File: src/auth/adminGuard.ts

Requirements:
- Export requireAdmin(session)
- Throw HTTP 403 if user is not admin
- Use role-based check (session.user.role === 'ADMIN')

Apply guard to:
- All /api/admin/suggestions routes
- Future Phase 11 admin APIs

Rules:
- No silent fallbacks
- No client-side checks


Why this matters:

Prevents accidental privilege escalation

Centralizes security logic

🧾 11.F Admin Audit Event Types (Missing)

You referenced audit logging but didn’t define event taxonomy.

Copilot Prompt — Audit Events
Extend audit logging with Phase 11 events.

Add constants:
- CONTENT_SUGGESTION_CREATED
- CONTENT_SUGGESTION_ACCEPTED
- CONTENT_SUGGESTION_DISMISSED

Ensure:
- All suggestion lifecycle events are logged
- Payload includes:
  - suggestionId
  - courseId
  - adminId (if applicable)
  - timestamp

Rules:
- Non-blocking
- Never throw


Why this matters:

Compliance

Forensic traceability

Enterprise readiness

📊 11.G Admin Dashboard Signal → Suggestion Linking (Missing)

Your dashboard shows analytics, but doesn’t connect signals to suggestions yet.

Copilot Prompt — Dashboard Linking
Enhance admin analytics dashboard to surface content suggestions.

Steps:
- For a given courseId:
  - Fetch AnalyticsSignals
  - Fetch ContentSuggestions
- Group suggestions by:
  - scope
  - severity
  - signal type

UI:
- Show “Suggested Actions” panel
- Clicking opens suggestion details
- Read-only evidence viewer

Rules:
- No inline edits
- No generator triggers


Why this matters:

Makes Phase 11 usable

Closes the insight → action loop

⏳ 11.H Retention Policy Prompt (Optional but Recommended)

Without this, suggestions grow unbounded.

Copilot Prompt — Retention
Add retention policy for Phase 11 data.

Policy:
- ContentSuggestion: retain forever
- AnalyticsSignal: retain 180 days
- Raw AnalyticsEvent: retain 90 days

Implementation:
- Scheduled job
- Soft-delete or archive (no hard deletes unless required)
- Audit every pruning action

Rules:
- Never delete suggestions
- Never delete aggregates

✅ FINAL STATUS — PHASE 11 PROMPT COMPLETENESS
Area	Status
Insight Engine	✅
Store	✅
Admin APIs	✅
Admin UI	✅
Audit	✅
Jobs	✅
Prisma migration	❌ → now added
Signal mapping registry	❌ → now added
Idempotency guard	❌ → now added
Admin guard	❌ → now added
Audit taxonomy	❌ → now added
Dashboard linkage	❌ → now added
Retention policy	⚠ optional
🎯 Recommendation (Strong)

Execute missing prompts in this order:

1️⃣ Prisma migration
2️⃣ Mapping registry
3️⃣ Mapping tests
4️⃣ Idempotency guard
5️⃣ Admin guard
6️⃣ Audit events
7️⃣ Dashboard linking

Once done → Phase 11 is architecturally complete.


# Phase 11 implementation summary
Intended

Goal: Convert AnalyticsSignal → reproducible, insert-only ContentSuggestion records for admin review (no auto-mutation).
Core outputs: ContentSuggestion model with enums (scope/type/severity/status), evidenceJson, message, and status (only mutable field).
Components: deterministic mapping registry, Insight Engine (generateSuggestionsForSignal), persistence/store layer (saveSuggestions, listSuggestions, updateSuggestionStatus), admin APIs/UI, audit logging, idempotent job wiring, tests, and Prisma migration.
Rules/constraints: Insert-only, audited every lifecycle action, idempotency per-signal, no generator calls, admin-only approval, no streaming/progress, enums for statuses.
Completed

Engine & Mapping: Deterministic mapping + engine implemented (signal → suggestion) and unit-tested for reproducibility.
Store & Idempotency: Persistence helper added with idempotency guard (unique sourceSignalId pattern) and audited writes.
Prisma Schema: ContentSuggestion model added to schema with necessary fields and unique constraints (sourceSignalId usage implemented).
Admin APIs & UI: Admin routes and server page + client SuggestionCard created to list, view evidence, Accept/Dismiss (status-only).
Audit: Audit logging hardened and integrated for create/accept/dismiss events (non-blocking).
Job Wiring & Scripts: Insight Engine wired into analytics job with job-lock; local runner and lock-clear scripts added and exercised.
Tests: Phase 11 engine/store unit tests added and passing in the test suite.
Tooling fixes: Type-check / lint / unit tests made to pass after resolving next-auth typing/casting issues and small test/jest mappings.
Pending

Prisma migration run & DB verification: Migration must be generated/applied in each environment and verified (migration file present? run prisma migrate dev).
Centralized module augmentation: next-auth global augmentation could be finalized so fewer inline casts remain (optional refactor).
Dashboard linkage & grouping: Admin analytics dashboard linkage to surface signals → suggestions grouped by scope/severity (recommended in doc) not fully surfaced in dashboard.
Retention / archival job: Optional policy (signals retention 180d, raw 90d) and scheduling not implemented.
Integration tests: End-to-end test that runs job against test DB to assert suggestion creation + audit + idempotency still recommended.
Operational monitoring: Prometheus/alerts or retry instrumentation for job failures not yet added.
Suggestions

Run & commit Prisma migration (name: add_content_suggestions) and document migration steps in repo README; then run CI DB migration to validate schema in CI.
Add an integration test that runs the analytics job against test DB to assert (a) suggestions are created, (b) duplicates are not created on re-run, (c) audit rows recorded.
Add explicit audit event constants (CONTENT_SUGGESTION_CREATED/ACCEPTED/DISMISSED) in a shared module and use them in store + API handlers for consistent telemetry.
Optional: Add a small Retention scheduler job (configurable cron) that archives/prunes raw events while preserving ContentSuggestion forever.
Optional stricter typing: Create a single next-auth module augmentation file placed in types or next-auth.d.ts and ensure tsconfig typeRoots/includes pick it up, then remove remaining inline client casts for cleaner types.
If you want, I can:

Create and apply the Prisma migration and run it locally, or
Add the integration test for job → suggestion → audit idempotency, or
Implement the audit event constants and wire them through store/APIs.