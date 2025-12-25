# Jobs Runbook

This document describes the background jobs, how to run them manually, expected durations, and failure behavior. It intentionally omits implementation details.

- **analytics_jobs**
  - Purpose: Aggregate analytics events into daily aggregates and derive signals.
  - How to run manually: Run the orchestrator or invoke the job runner with the `analytics_jobs` definition, or run the analytics script used by the orchestrator (local developer: `node scripts/run-analytics.js`).
  - Expected duration: minutes (typical run < 5 minutes); may be longer on first run or large datasets.
  - Failure behavior: Job logs error and emits an alert; partial results are persisted where possible and the job can be re-run safely.

- **generate_signals**
  - Purpose: Scan aggregates and generate rule-based AnalyticsSignal entries (e.g., low completion rate, low quiz pass rate).
  - How to run manually: Invoke the job runner for `generate_signals` or call the signals generator script/function used by engineering tooling.
  - Expected duration: minutes (typically < 5 minutes depending on course count).
  - Failure behavior: Failures are logged and alerted; job is idempotent and safe to re-run.

- **generate_suggestions**
  - Purpose: Convert new AnalyticsSignal records into content suggestions (idempotent mapping).
  - How to run manually: Run the `generate_suggestions` job via the runner, or execute the insights engine on recent signals.
  - Expected duration: minutes (depends on number of new signals; usually < 5 minutes).
  - Failure behavior: Errors are logged and alerted. The suggestion persistence layer uses idempotency keys so re-running is safe.

- **regeneration_worker**
  - Purpose: Claim and process pending regeneration jobs (execute content generators and persist immutable outputs).
  - How to run manually: Start the regeneration worker process or invoke the `regeneration_worker` job through the runner; there may also be a `startWorker` CLI for local debugging.
  - Expected duration: per-item runtime varies (seconds to minutes per job). The worker processes jobs sequentially by default.
  - Failure behavior: Individual regeneration jobs are marked FAILED with error details; the worker logs errors and emits alerts. Re-running will only reprocess PENDING jobs.

- **prune_analytics_events** (manual retention job)
  - Purpose: Delete raw AnalyticsEvent rows older than a retention threshold (default 90 days).
  - How to run manually: Invoke the `prune_analytics_events` manual job via the job runner or call the retention script.
  - Expected duration: depends on rows to delete; may be minutes to hours for large datasets. Run during maintenance windows.
  - Failure behavior: Failures are logged and alerted. The job only deletes raw analytics events and does not delete aggregates, signals, suggestions, outputs, or audit logs.

Notes
- All jobs emit structured audit events and metrics. Alerts for failures are rate-limited and de-duplicated by the alerting router.
- Use `JOB_DRY_RUN=1` environment variable to log job execution without performing work in non-destructive test runs.
- For operational concerns (scheduling, expected windows, runbooks for incident response), refer to the incident and retention runbooks.
# AI Content Engine – Job System

## Purpose
The Job system powers **all AI content generation** in the platform. It is intentionally designed to be **simple, auditable, and failure-tolerant**.

This document is a **hard architectural contract**. Any future changes must preserve the guarantees listed below.

---

## Core Principles (Non‑Negotiable)

### 1. Job‑Based Execution Only
- Every AI operation runs as a **Job**
- No inline or synchronous AI calls from UI or API routes
- Jobs are persisted before execution

> If it involves AI → it is a Job.

---

### 2. Jobs Are Atomic
- A Job is a **single, indivisible execution**
- Partial progress is never exposed
- A Job either:
  - completes successfully, or
  - fails with an error

There is **no concept of partial completion**.

---

### 3. No Pause / Resume (By Design)
- Jobs **cannot** be paused
- Jobs **cannot** be resumed
- This is intentional and enforced at:
  - UI layer
  - API layer
  - documentation

Reasoning:
- AI provider calls are atomic
- Streaming introduces state complexity and corruption risk
- Retry is safer than resume

> If pause/resume appears in code, it is a bug.

---

### 4. Retry = New Execution Attempt
- Retrying a Job:
  - does NOT resume the old execution
  - creates a **new execution attempt**
  - increments retry count

Old attempts remain:
- stored
- auditable
- immutable

---

### 5. Explicit Job Lifecycle

```text
queued → running → completed
          ↘ failed
          ↘ cancelled
```

Valid statuses:
- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

No other states are allowed.

---

## Admin UI Rules

### Allowed Actions

| Status     | Retry | Cancel |
|----------|-------|--------|
| queued   | ❌    | ✅     |
| running  | ❌    | ❌     |
| failed   | ✅    | ✅     |
| completed| ❌    | ❌     |
| cancelled| ❌    | ❌     |

These rules must be enforced in:
- UI buttons
- API handlers
- backend validation

---

### What Admins Can See
- Job metadata (type, entity, language, board, class)
- Status + retries
- Error message (if failed)
- Created / updated timestamps
- Audit trail link

Admins **cannot**:
- edit jobs
- modify prompts
- intervene mid‑execution

---

## Error Handling

- Errors come from:
  - AI provider
  - validation layer
  - infrastructure failures
- Error messages are stored verbatim
- Errors are immutable once recorded

Admins are encouraged to:
- inspect audit logs
- retry the job if appropriate

---

## Audit & Compliance

Every job action is logged:
- creation
- execution start
- completion / failure
- retry
- cancellation

Audit logs are:
- append‑only
- queryable by jobId
- never deleted

---

## Content Moderation Relationship

- Job completion does **not** publish content
- Generated content enters `pending` state
- Admin approval is required to:
  - approve
  - reject
  - rollback

This separation ensures:
- safety
- quality control
- regulatory compliance

---

## Copilot Guardrails

Copilot **must not**:
- add pause/resume
- add streaming/progress bars
- introduce new job states
- auto‑approve content

Copilot **may**:
- add new job types
- improve logging
- add observability

If Copilot suggests violating these rules, **reject the change**.

---

## When to Change This Document

Only update this document if:
- a fundamental AI execution model changes
- streaming is adopted platform‑wide
- regulatory requirements change

Any such change requires **explicit architectural approval**.

---

## Summary

The Job system is intentionally boring.

That boredom is what makes it:
- reliable
- scalable
- auditable
- safe

**Do not optimize away the boring parts.**

