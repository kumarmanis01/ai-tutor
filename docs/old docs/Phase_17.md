If Phase 13–16 made the system correct, Phase 17 makes it trustworthy.

# Phase 17 Goals

Operational visibility:

## Admins and operators can see what the system is doing and why

- Governance clarity
- Every automated or admin decision is explainable and traceable
- Failure resilience
- Failures are detectable, diagnosable, and safely recoverable
- Human confidence
- Humans can answer: “What happened?”, “Who approved it?”, “What changed?”

## 🚧 Phase 17 Scope (Strict)

Included

- Admin Observability UI
- Audit log browsing & correlation
- Job + regeneration lineage visualization
- Health & readiness endpoints
- Read-only operational metrics
- Runbooks & operational docs
- Soft governance constraints

## Explicitly Excluded

- ❌ New content generation
- ❌ Automatic remediation
- ❌ Any learner-facing changes
- ❌ Any mutation of historical data

## 🧱 Phase 17 Architecture Overview

┌──────────────┐
│ Admin UI │
│ (Ops Views) │
└──────┬───────┘
│
┌──────▼────────────────────────┐
│ Observability APIs (read-only) │
│ - audit logs │
│ - job runs │
│ - lineage │
│ - health │
└──────┬────────────────────────┘
│
┌──────▼───────────┐
│ Existing DB │
│ (no mutation) │
└──────────────────┘

📂 Phase 17 Deliverables

## 1️⃣ Admin Audit Log Explorer

### Purpose

- Allow admins to search, filter, and correlate audit events.
- Design
- Read-only

### Filterable by:

- actorId
- eventType
- entityType
- entityId
- time range
- Pagination only (no infinite scroll)
- Correlation view (same entityId across events)

### API

- GET /api/admin/audit
- GET /api/admin/audit/:id

### UI

- /admin/audit
- /admin/audit/[id]

#### Copilot Prompt — Audit API

Copilot Prompt (Audit API):

Implement read-only admin audit log APIs.

Requirements:

- GET /api/admin/audit with pagination and filters:
  - actorId
  - eventType
  - entityType
  - entityId
  - from / to timestamps
- GET /api/admin/audit/[id] to fetch a single audit entry
- Admin-only guard
- No mutation of audit records
- Return stable ordering (createdAt desc)
- Add unit tests for filtering and access control
  Do not import generators or job logic.

#### Copilot Prompt — Audit UI

Create a server-rendered admin audit explorer.

Requirements:

- Page: /admin/audit
- Table with pagination
- Filter form (actor, eventType, date range)
- Click row → detail page
- Detail page shows JSON payload (read-only viewer)
- No client-side data mutation
- No delete or edit actions

## 2️⃣ Job & Regeneration Lineage Viewer

### Purpose

- Explain how an output came to exist.

### Lineage Graph (Read-Only)

- For a given PublishedOutput:

PublishedOutput
└─ PromotionCandidate
└─ RegenerationOutput
└─ RegenerationJob
└─ RetryIntent? (optional)

### API

- GET /api/admin/lineage/output/:publishedOutputId

Returns:
{
publishedOutput,
promotionCandidate,
regenerationOutput,
regenerationJob,
retryIntent?: ...
}

#### 🔹 Copilot Prompt — Lineage API

Implement a read-only lineage resolver API.

Requirements:

- Input: publishedOutputId
- Resolve related records across:
  PublishedOutput → PromotionCandidate → RegenerationOutput → RegenerationJob → RetryIntent?
- Admin-only
- No writes
- If any link missing, return partial graph + warnings
- Unit tests for:
  - full lineage
  - retry lineage
  - missing optional nodes

#### 🔹 Copilot Prompt — Lineage UI

Create an admin lineage visualization page.

Requirements:

- Page: /admin/lineage/output/[id]
- Render entities as a vertical timeline
- Each node shows:
  - ID
  - status
  - createdAt
- JSON expandable view per node
- No edits, no triggers

## 3️⃣ System Health & Readiness

Purpose

- Allow infra + ops to know if the system is safe to operate.

Endpoints

- GET /api/health/live
- GET /api/health/ready

live

- Always returns 200 if process alive
- ready

Checks:

- DB connectivity
- Migrations applied
- Job registry loaded
- Required env vars present

#### 🔹 Copilot Prompt — Health Endpoints

Implement health endpoints.

Requirements:

- GET /api/health/live → { status: "ok" }
- GET /api/health/ready:
  - DB connectivity check
  - prisma migrate status check
  - job registry loaded flag
  - required env vars present
- ready returns 503 with reasons if failing
- No side effects
- Unit tests for each failure mode

## 4️⃣ Operational Metrics Viewer (Admin)

Purpose

- Make metrics human-visible without Prometheus access.

Data Source

- Use existing metrics helper
- Snapshot counters (read-only)

UI

- /admin/metrics

Show:

- Job runs
- Job failures
- Avg job duration
- Retention deletes

#### 🔹 Copilot Prompt — Metrics UI

Create an admin metrics snapshot page.

Requirements:

- Read-only
- Pull metrics via internal helper or adapter
- Display counts and averages
- No reset buttons
- No mutation
- Server-rendered page

## 5️⃣ Operational Runbooks (Docs)

Required Docs

- RUNBOOK.md
- INCIDENTS.md
- GOVERNANCE.md

Contents:

- How to inspect a failed job
- How to trace an output
- How to safely retry
- What admins can and cannot do
- Escalation policy

#### 🔹 Copilot Prompt — Docs

Generate operational documentation.

Files:

- RUNBOOK.md
- INCIDENTS.md
- GOVERNANCE.md

Requirements:

- No marketing language
- Step-by-step operational procedures
- Explicit “DO NOT” sections
- Reference Phase 13–17 invariants

## 6️⃣ Phase 17 Invariants (Tests)

Required Tests

- Audit logs are immutable
- Lineage resolution is read-only
- Health ready fails on missing migration
- Metrics endpoints never mutate state
- Admin UI has no mutation paths

#### 🔹 Copilot Prompt — Invariant Tests

Add Phase 17 invariant tests.

Requirements:

- Assert audit records are never mutated
- Assert lineage API performs zero writes
- Assert health/ready fails when migrations missing
- Assert admin metrics UI does not expose mutation endpoints

## ✅ Phase 17 Exit Criteria

### You are done with Phase 17 when:

- Admin can answer:
- “Why did this output exist?”
- “Who approved it?”
- “What job produced it?”

### Ops can:

- Detect failures early
- Safely retry
- Audit all actions
- System behavior is explainable without reading code

## 🧠 Strategic Note

### After Phase 17:

- You are production-grade
- Future phases become optional enhancements, not risk reducers
- You can onboard new engineers safely
