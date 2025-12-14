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

