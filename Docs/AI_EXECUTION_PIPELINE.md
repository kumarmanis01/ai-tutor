# Execution Pipeline — Single Source of Truth

## Purpose

The Execution Pipeline is the only mechanism through which long-running, retryable, or failure-prone operations (AI generation, hydration, imports, background jobs) are executed.

It exists to ensure:

- **Reliability** under network / LLM / Redis failures
- **Deterministic retries and backoff**
- **Cancellation safety**
- **Auditable execution history**
- **Clean separation between intent and execution**

---

## High-Level Architecture

```text
[ UI / API Routes ]
    |
    |  submit intent only
    v
[ Execution Pipeline ]
    |
    |  lease + execute
    v
[ Workers / LLM / DB ]
```

---

## Key Principle

- **API routes never execute work.**
- **Workers never accept user input.**
- **The pipeline owns retries, failures, and state.**

---

## Core Concepts

### 1. Intent vs Execution

| Layer      | Responsibility                |
|------------|------------------------------|
| UI         | Collects user intent         |
| API Route  | Validates input and submits intent |
| Pipeline   | Owns job lifecycle           |
| Worker     | Executes exactly one job     |

### 2. Canonical Job Record

All work is represented by a single canonical record:

```prisma
model ExecutionJob {
  id           String   @id @default(cuid())
  jobType      JobType        // SYLLABUS | GENERATE_NOTES | GENERATE_TEST | ...
  entityType   EntityType     // BOARD | CLASS | SUBJECT | CHAPTER | TOPIC
  entityId     String         // Canonical FK (never a string name)
  payload      Json           // Execution-specific input
  status       JobStatus      // pending | running | retrying | failed | completed | cancelled
  attempts     Int            @default(0)
  maxAttempts  Int            @default(5)
  nextRunAt    DateTime?
  lastError    String?
  lockedAt     DateTime?
  lockedBy     String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([status, nextRunAt])
}
```

This table is the source of truth for:

- retries
- failures
- progress
- auditability

---

## API Contract

**Rule:** API Routes Submit Intent Only

API routes must **not**:

- call LLMs
- implement retries
- manage backoff
- open Redis queues
- execute domain logic

**Correct API Example:**

```ts
// POST /api/admin/content-engine/jobs
await submitJob({
  jobType: "GENERATE_NOTES",
  entityType: "TOPIC",
  entityId,
  payload: { language }
})
```

---

## Pipeline Entry Point

### `submitJob()`

This is the only function allowed to create jobs.

**Responsibilities:**

- Validate entity existence (by ID)
- Enforce idempotency rules
- Respect global pause flags
- Insert job with `status = pending`

```ts
submitJob(input: {
  jobType: JobType
  entityType: EntityType
  entityId: string
  payload?: Json
})
```

---

## Worker Execution Model

### Leasing

Workers lease jobs atomically:

```sql
SELECT * FROM ExecutionJob
WHERE status IN ('pending', 'retrying')
AND nextRunAt <= now()
FOR UPDATE SKIP LOCKED
LIMIT 1
```

Once leased:

- `status → running`
- `lockedAt`, `lockedBy` set

### Execution

```ts
try {
  await executeJob(job)
  markCompleted(job)
} catch (err) {
  handleFailure(job, err)
}
```

---

## Retry & Failure Semantics

### Failure Handling

```ts
if (job.attempts >= job.maxAttempts) {
  markFailed(job, err)
} else {
  reschedule(job, exponentialBackoff(job.attempts))
}
```

### Backoff Strategy

| Attempt | Delay  |
|---------|--------|
| 1       | 30s    |
| 2       | 2m     |
| 3       | 10m    |
| 4       | 1h     |
| 5       | fail   |

---

## Cancellation Semantics

Jobs may be cancelled before execution.

```sql
UPDATE ExecutionJob
SET status = 'cancelled'
WHERE id = ? AND status IN ('pending', 'retrying')
```

Workers must re-check status before executing.

---

## Global Pause

Execution may be paused system-wide.

```ts
if (isSystemSettingEnabled("PIPELINE_PAUSED")) {
  abortExecution()
}
```

Used during:

- maintenance
- incident response
- data corrections

---

## Approval Gating

Execution never auto-publishes content.

Generated content must:

- be created as draft
- await admin approval
- never overwrite approved content

---

## Observability & Audit Logs

Each execution step should write:

- start timestamp
- end timestamp
- error messages
- AIContentLog (for all LLM calls)

This enables:

- admin dashboards
- downtime analysis
- cost attribution
- failure root cause analysis

---

## Admin Dashboard Enablement

The pipeline supports dashboards out of the box.

### Key Metrics

| Metric           | Source         |
|------------------|---------------|
| Job throughput   | ExecutionJob  |
| Failure rate     | status + lastError |
| Retry heatmap    | attempts      |
| Downtime windows | nextRunAt gaps|
| AI cost per job  | AIContentLog  |

### Example Queries

```ts
// Failed jobs last 24h
where: { status: 'failed', createdAt: { gte: yesterday } }

// Retry storms
where: { attempts: { gte: 3 } }
```

---

## Hard Rules (Non-Negotiable)

- ❌ No LLM calls outside workers
- ❌ No retries in API routes
- ❌ No string-based entity identification
- ❌ No queue creation at module load
- ✅ Jobs must be idempotent
- ✅ Workers must be restart-safe
- ✅ Failures must be persisted

---

## Why This Exists

Without a pipeline:

- failures are silent
- retries are inconsistent
- UI becomes unreliable
- debugging becomes impossible

With the pipeline:

- failures are observable
- retries are controlled
- execution is deterministic
- scale is safe

---

## Copilot Instructions (Paste & Lock)

**COPILOT EXECUTION PIPELINE RULES**

- All long-running or failure-prone operations must go through ExecutionJob
- API routes must only submit intent via submitJob()
- Workers are the only place allowed to call callLLM()
- Retry, backoff, and cancellation logic must not be duplicated
- Jobs must never auto-publish content
- Entity identity must always be passed as IDs, never strings
- Queue/Redis clients must be lazy-initialized

---

## Future Extensions (Planned)

- Job priorities
- Rate limiting per jobType
- SLA tracking
- Partial progress checkpoints
- Distributed worker pools

---

## Final Architect Note

This pipeline is infrastructure, not a feature.

Once stable, everything else becomes simpler:

- UI
- approvals
- analytics
- reliability

---
