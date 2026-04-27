# AI Content Engine – Production Architecture v1.0

**Single Source of Truth – Mandatory Reading**

This document defines the authoritative architecture, contracts, and guardrails for the AI Content Engine. Any implementation, refactor, or feature must comply with this document.

## 1. Purpose & Scope

The AI Content Engine generates, moderates, versions, and delivers educational content (syllabus, notes, questions, tests) in a safe, auditable, scalable, and deterministic manner.

This system is designed for:

- Board → Class → Subject → Chapter → Topic hierarchy
- Admin-driven AI generation
- Human moderation
- On-demand and batch execution
- Enterprise-grade observability and governance

## 2. Core Principles (Non-Negotiable)
### 2.1 Separation of Concerns
Layer | Responsibility
---|---
UI | Selection, submission, monitoring
API | Validation, normalization, job creation
Queue | Best-effort delivery only
DB | Single source of truth
Worker | All AI execution
Moderator | Approval & publishing

### 2.2 Source of Truth

Postgres (Prisma models) is the only source of truth.

Redis never determines state — only delivery.

No in-memory state is authoritative.

### 2.3 AI Safety Boundary

❌ APIs must NEVER call LLMs

❌ UI must NEVER call LLMs

✅ ONLY workers may call LLMs

✅ Every LLM call must produce an `AIContentLog`

## 3. Academic Domain Model (Authoritative Definitions)
### 3.1 Hierarchy (Immutable Identity)

Board
 └── ClassLevel (grade)
      └── SubjectDef
           └── ChapterDef (versioned, approved)
                └── TopicDef (approved)
                     ├── TopicNote (language + version)
                     └── GeneratedTest (difficulty + version)

### 3.2 Definitions
Entity | Meaning
---|---
Board | Curriculum authority (CBSE, ICSE, State)
ClassLevel | Grade under a board
SubjectDef | Subject under a class
ChapterDef | Syllabus unit (versioned)
TopicDef | Atomic teaching unit
TopicNote | Language-specific explanation
GeneratedTest | Evaluative content

## 4. Job System (AI Content Engine)
### 4.1 ExecutionJob (Canonical)

ExecutionJob is the only execution contract.

Key rules:

- Immutable after completion
- Retry = new job
- Status transitions are one-way

Job Lifecycle
```
PENDING
  ↓ (atomic DB claim)
RUNNING
  ↓ success
COMPLETED

RUNNING
  ↓ error
FAILED
```

### 4.2 Job Claiming Contract (MANDATORY)

Workers must claim jobs atomically in DB before execution.

Example claim:

```js
updateMany({
  where: { id, status: 'pending', lockedAt: null },
  data: { status: 'running', lockedAt: now(), lockedBy }
})
```

If claim fails → worker must abort.

## 5. Worker Architecture
### 5.1 Worker Role

Workers are capacity units, NOT job-scoped.

One worker processes many jobs

Workers are long-lived

Workers are controlled explicitly

### 5.2 Worker Lifecycle
STARTING
RUNNING
DRAINING
STOPPED | FAILED

Tracked in `WorkerLifecycle` (persistent).

### 5.3 Worker Start Model
Environment | How Workers Start
---|---
Local Dev | `node worker/bootstrap.ts`
Production | Orchestrator or K8s Jobs
Autoscale | Orchestrator decides, never API

APIs may request capacity — never spawn workers directly.

## 6. Redis Contract (Explicit)

Redis is:

✅ Best-effort delivery

❌ NOT a source of truth

❌ NOT authoritative

Failure Modes

Scenario | Behavior
---|---
Redis down | Jobs remain PENDING
Duplicate messages | DB claim prevents double execution
Worker crash | Job unlocked after timeout

## 7. Syllabus Generation Workflow (Production)
### 7.1 Trigger

Admin UI → Submit SYLLABUS job (subjectId)

### 7.2 Execution

API validates hierarchy IDs

ExecutionJob created

Job enqueued (if Redis available)

Worker claims job

Worker generates:

- Chapters (draft)
- Topics (draft)
- `AIContentLog` written

Job marked COMPLETED

### 7.3 Moderation

Chapters & topics remain draft

Admin approves → visible to UI

## 8. Content Moderation Lifecycle

`draft → pending → approved → archived`

No auto-publish

Every transition emits `ApprovalAudit`

Rejection does NOT delete content

## 9. Deletion Policy (Critical)

❌ No cascading deletes for academic or AI content

✅ Soft deletes only (lifecycle = deleted)

Logs are immutable forever

## 10. Observability & Telemetry
### 10.1 Mandatory Metrics

- Job counts (by type/status)
- Worker counts & health
- Queue depth
- AI token usage & cost
- Failure rates

### 10.2 Dashboards

Admin dashboards MUST include:

- Job health
- Worker lifecycle
- AI cost telemetry
- Moderation backlog
- Redis / DB connectivity status

## 11. Admin UX Principles

- Hierarchical selectors only (no free text)
- IDs flow everywhere
- Clear status badges
- No destructive actions without confirmation
- Retry = new job

## 12. Failure Modes & Recovery
Failure | Recovery
---|---
Redis down | Jobs stay pending
Worker crash | Mark FAILED
Partial AI output | Log + manual review
Bad content | Reject, regenerate

## 13. Schema Alignment (Reviewed)

Your Prisma schema largely aligns with this architecture.
Key strengths:

- Enums for statuses
- `WorkerLifecycle` table
- `ExecutionJob` with locking
- `AIContentLog` immutability
- `ApprovalAudit` present

⚠️ Mandatory follow-ups (non-breaking):

- Enforce ID-first APIs everywhere
- Ensure no string-based job filters
- Add heartbeat enforcement to `WorkerLifecycle`
