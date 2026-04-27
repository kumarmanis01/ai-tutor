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

- **Validate jobType/entityType combination** (Phase 1 validation)
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

## JobType/EntityType Validation Matrix

Each jobType is scoped to specific entityTypes. Invalid combinations are rejected at submission time with a clear error message.

| jobType    | Valid entityTypes | Description |
|------------|------------------|-------------|
| `syllabus` | `SUBJECT`        | Creates chapters and topics for a subject (SUBJECT-scoped per Hydration_Rules.md) |
| `notes`    | `TOPIC`          | Generates notes for a specific topic (TOPIC-scoped per Hydration_Rules.md) |
| `questions`| `TOPIC`          | Generates questions for a specific topic (TOPIC-scoped per Hydration_Rules.md) |
| `tests`    | `TOPIC`          | Generates test content for a specific topic |
| `assemble` | `TOPIC`          | Assembles content for a specific topic |

### Invalid Combination Examples

These combinations will be rejected with descriptive errors:

| jobType    | entityType | Result |
|------------|-----------|--------|
| `syllabus` | `CHAPTER` | ❌ Rejected: "jobType 'syllabus' requires entityType [SUBJECT], got 'CHAPTER'" |
| `syllabus` | `TOPIC`   | ❌ Rejected: syllabus is SUBJECT-scoped only |
| `notes`    | `SUBJECT` | ❌ Rejected: "jobType 'notes' requires entityType [TOPIC], got 'SUBJECT'" |
| `notes`    | `CHAPTER` | ❌ Rejected: notes is TOPIC-scoped only |
| `questions`| `CHAPTER` | ❌ Rejected: questions is TOPIC-scoped only |

### Implementation Reference

The validation matrix is defined in `lib/execution-pipeline/submitJob.ts`:

```ts
export const VALID_JOB_ENTITY_COMBINATIONS: Record<string, string[]> = {
  syllabus: ['SUBJECT'],
  notes: ['TOPIC'],
  questions: ['TOPIC'],
  tests: ['TOPIC'],
  assemble: ['TOPIC'],
};
```

Unit tests: `tests/lib/execution-pipeline/submitJob.test.ts`

---

## Job Routing (Phase 2)

After validation, `submitJob()` routes each jobType to the appropriate hydrator enqueue function:

| jobType    | Enqueue Function            | Worker Type    |
|------------|----------------------------|----------------|
| `syllabus` | `enqueueSyllabusHydration` | `SYLLABUS`     |
| `notes`    | `enqueueNotesHydration`    | `NOTES`        |
| `questions`| `enqueueQuestionsHydration`| `QUESTIONS`    |
| `tests`    | `enqueueTestsHydration`    | `ASSEMBLE_TEST`|
| `assemble` | `enqueueAssembleHydration` | `ASSEMBLE_TEST`|

### Enqueue Function Contract

All enqueue functions follow the same pattern:

1. **Check global pause** (`HYDRATION_PAUSED` system setting)
2. **Resolve entity** (validate topic/subject exists)
3. **Check idempotency** (existing approved content, or queued job)
4. **Create HydrationJob** (DB record)
5. **Create Outbox row** (for reliable queue dispatch)

Implementation: `lib/execution-pipeline/enqueueTopicHydration.ts`
Unit tests: `tests/lib/execution-pipeline/enqueueTopicHydration.test.ts`

---

## Worker Processing (Phase 3)

The content worker (`worker/processors/contentWorker.ts`) dispatches jobs to type-specific handlers:

```ts
const WORKER_HANDLERS: Record<string, (jobId: string) => Promise<void>> = {
  SYLLABUS: handleSyllabusJob,
  NOTES: handleNotesJob,
  QUESTIONS: handleQuestionsJob,
  ASSEMBLE_TEST: handleAssembleJob,
};
```

### Worker Service Handlers

| Worker Type    | Handler File                        | Creates                |
|---------------|-------------------------------------|------------------------|
| `SYLLABUS`    | `worker/services/syllabusWorker.ts` | ChapterDef, TopicDef   |
| `NOTES`       | `worker/services/notesWorker.ts`    | TopicNote              |
| `QUESTIONS`   | `worker/services/questionsWorker.ts`| GeneratedTest          |
| `ASSEMBLE_TEST`| `worker/services/assembleWorker.ts`| Approves existing tests|

### Handler Contract

Each handler follows the same pattern:
1. Atomically claim the HydrationJob
2. Check global pause (`HYDRATION_PAUSED`)
3. Load entity with full academic context
4. Check idempotency (existing approved content)
5. Call LLM (except ASSEMBLE_TEST)
6. Persist content in transaction
7. Mark HydrationJob + linked ExecutionJob completed

Unit tests: `tests/worker/contentWorkerDispatch.test.ts`

---

## Hydrator Compliance (Phase 4)

Per Copilot guardrails, hydrators must comply with strict rules:

```
COPILOT RULES — HYDRATOR:
- Hydrators only enqueue jobs
- No AI calls allowed here
- Must be idempotent
- Must check DB before enqueue
- Never mutate existing content
```

### Deprecated Hydrators

The following files have been refactored to compliance:

| File | Before (Violation) | After (Compliant) |
|------|-------------------|-------------------|
| `hydrators/hydrateNotes.ts` | Called `callLLM()` directly | Delegates to `enqueueNotesHydration()` |
| `hydrators/hydrateQuestions.ts` | Called `callLLM()` directly | Delegates to `enqueueQuestionsHydration()` |

These are marked `@deprecated` and should be replaced with:
- `submitJob({ jobType: 'notes', entityType: 'TOPIC', ... })`
- `submitJob({ jobType: 'questions', entityType: 'TOPIC', ... })`

### LLM Calls: Correct Location

LLM calls are **only** permitted in worker service handlers:

| Worker Service | Has LLM Calls | Reason |
|----------------|---------------|--------|
| `worker/services/notesWorker.ts` | ✅ Yes | Generates topic notes |
| `worker/services/questionsWorker.ts` | ✅ Yes | Generates questions |
| `worker/services/assembleWorker.ts` | ❌ No | Assemble is non-AI (approves drafts) |

### Worker Bootstrap

`worker/bootstrap.ts` has been updated to use the new worker handlers:

```ts
switch (type) {
  case "NOTES":
    return handleNotesJob(payload.jobId);      // ✅ Correct
  case "QUESTIONS":
    return handleQuestionsJob(payload.jobId);  // ✅ Correct
  // NOT: hydrateNotes(payload.topicId, ...)   // ❌ Deprecated
}
```

Unit tests: `tests/hydrators/hydratorCompliance.test.ts`

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
