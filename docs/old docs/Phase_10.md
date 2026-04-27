# PHASE 10 — Analytics, Insights & Intelligence

## 🎯 Goal
Turn learner activity into:
- Actionable insights
- Funnel metrics
- Course quality signals
- Monetization intelligence  
Do this WITHOUT touching content or generation logic.

## 🔒 Core Rule
Phase 10 observes only. It must never modify:
- CoursePackage
- Lessons
- Quizzes
- Projects

## 🧩 Architecture
Learner Events → Event Collector → Analytics Store → Dashboards / Reports

## 📊 What We Measure

### Learner Engagement
- lesson_viewed  
- lesson_completed  
- quiz_attempted  
- quiz_passed

### Funnel Metrics
- course_view → enroll → complete  
- purchase → enroll → completion

### Quality Signals
- drop-off per lesson  
- quiz failure rate  
- time spent per lesson

## 🧱 Data Model (NEW)

```prisma
model AnalyticsEvent {
    id         String   @id @default(cuid())
    eventType  String
    userId     String?
    courseId   String?
    lessonIdx  Int?
    metadata   Json
    createdAt  DateTime @default(now())

    @@index([eventType, createdAt])
    @@index([courseId])
}
```

(Consider converting `eventType` to an enum in a controlled migration.)

---

## Phase 10.1 — Event Ingestion
Create a write-only, batched ingestion endpoint.

- Add AnalyticsEvent Prisma model
- POST /api/analytics/event
    - Accept batched events
    - Validate eventType against enum
    - Fire-and-forget design (write-only)
- Rules: No reads, no business logic
- Add unit tests

## Phase 10.2 — Client Event Emitters
Client-side emitters for:
- lesson_viewed
- lesson_completed
- quiz_attempted
- quiz_passed

Requirements:
- Debounced
- Non-blocking
- POST → /api/analytics/event
- No UI changes

## Phase 10.3 — Aggregation Jobs
Nightly aggregation jobs to compute:
- lesson completion rate
- average time per lesson
- course completion %

Store results in an `AnalyticsDailyAggregate` model. Implement as idempotent, testable job (no UI).

## Phase 10.4 — Admin Analytics APIs
Read-only admin endpoints (aggregated data only):
- GET /api/admin/analytics/course/[courseId]
- GET /api/admin/analytics/funnel/[courseId]

Rules:
- Return only aggregated data (no raw events)
- Admin-only access
- Add tests

## Phase 10.5 — Analytics Dashboard UI
Admin dashboard pages (read-only):
- Course analytics overview
- Lesson drop-off chart
- Funnel visualization

Requirements:
- Use Phase 10.4 APIs
- Simple chart library
- No write actions or exports yet

## Phase 10.6 — Intelligence Signals (Non-AI)
Rule-based signals saved to `AnalyticsSignal`:
- High drop-off lesson
- Low quiz pass rate
- High refund rate (approximate until explicit refunds available)

No AI suggestions yet. Add unit tests.

---

## ✅ Outcomes (Phase 10 Completed)
- Full analytics pipeline (ingest → aggregate → surface)
- Monetization insights decoupled from content
- Course quality signals persisted
- Enterprise observability in place
- AI-ready intelligence layer (non-generative signals)

## 🚧 Pending / Recommended
- Schedule nightly aggregator and signals worker (cron/orchestrator)
- Add admin read API for AnalyticsSignal and surface alerts in dashboard
- Replace purchase→enrollment refund heuristic with explicit refunds
- Convert eventType → enum via controlled migration
- Add retention/pruning for raw AnalyticsEvent
- Add job observability, retries, and audit logs
- Extend per-lesson aggregates for accurate drop-off metrics
- Improve admin UX (time-range, course picker, pagination, drilldowns)

## Suggestions / Next Steps (prioritized)
1. Add admin read API for AnalyticsSignal (high impact).  
2. Schedule nightly aggregator + signals worker + monitoring (operational critical).  
3. Implement retention policy and DB indexes for scaling.  
4. Replace refund heuristic and convert eventType to enum safely.  
5. Iterate dashboard to use per-lesson aggregates.

---

## 🚦 What Comes After Phase 10 (Preview)

| Phase | Focus                         |
|-------|-------------------------------|
| 11    | Personalization (non-generative) |
| 12    | AI Tutor (safe, scoped)       |
| 13    | Marketplace & creators        |
| 14    | Adaptive learning             |

## 🔥 Final Advice
- Content is immutable. Analytics is observational. Monetization is decoupled. AI is boxed and audited.  
- Do not let shortcuts compromise the architecture.

---

## SUMMARY OF IMPLEMENTATION

**Intention:** Build a read-only, observational analytics pipeline to collect learner events, aggregate metrics for admins, and produce rule-based intelligence signals — without modifying content or generation logic.

**Achieved:**
- Event ingestion endpoint (batched, validated, write-only) with tests.
- Debounced, non-blocking client emitters.
- Nightly-style aggregator that upserts into `AnalyticsDailyAggregate` with tests.
- Admin read-only aggregated APIs with admin guard and tests.
- Server-rendered admin dashboard with overview, drop-off approximation, funnel visualization, and simple chart components.
- `AnalyticsSignal` model and rule-based signal generation (low completion, low quiz pass, high refund approximation) with tests.
- Tests updated to use test DB/session injection pattern for reliability.

**Next operational tasks:**
- Wire aggregator and signals into scheduler/cron.
- Expose admin APIs for signals.
- Implement retention, improve refund metric fidelity, and convert eventType to enum in a migration.


✅ Phase 10 Status — FINAL VERDICT
✔ What Phase 10 already achieved (this is important)

You now have:

✅ Write-only analytics ingestion (safe, batched, validated)

✅ Immutable aggregation layer (daily aggregates, tested)

✅ Admin read-only analytics APIs

✅ Dashboard UI (overview, funnel, drop-off approximation)

✅ Rule-based intelligence signals

✅ Testable, deterministic analytics pipeline

✅ No content mutation, no feedback loops yet (by design)

This satisfies the entire intent of Phase 10.

⚠️ What’s still pending — and what it means

Let’s classify the pending items properly:

🔴 Operational blockers (must do before “real usage”)

These are not conceptual, but runtime:

Schedule aggregator + signal jobs

Basic monitoring for job success/failure

Without these:

Analytics exist only when manually triggered

Signals never update automatically

👉 These are activation steps, not new features.

🟡 Quality / accuracy improvements (safe to defer)

These are refinements, not blockers:

Refund accuracy

EventType enum

Retention/pruning

Per-lesson drop-off accuracy

Dashboard UX polish

👉 These belong to Phase 10.x hardening or later.

🎯 Strong Recommendation (Clear Answer)
✅ Do ONE small thing, then move to Phase 11

Wire the nightly jobs + minimal monitoring, then proceed to Phase 11.

Why?

Phase 10 without scheduled jobs is dormant

Phase 11 depends on analytics being alive

Doing admin UX or retention now would be premature optimization

🛠 What I Recommend You Do Now (Concrete)
Step 1 — Activate Phase 10 (Required)

Ask Copilot to do only this:

“Wire analyticsAggregator and generateSignalsForAllCourses into the existing orchestrator/cron runner, add basic success/failure logging and an audit entry per run.”

This should include:

Nightly (or hourly) execution

Non-overlapping run guard

AuditLog entries

One metric/log per run (success / failure / duration)

⏱ This is usually <1 day of work.

PART 1 — Copilot-ready instructions
🔌 Phase 10 Job Wiring (Activation, Not New Features)
Objective

Activate analytics by scheduling aggregation + signal jobs with:

deterministic execution

auditability

safety (no overlap)

minimal operational visibility

No schema redesign. No feature creep.

10.J1 — Job Runner Entry Point
Prompt to Copilot
Create a new server-side job runner for analytics aggregation and signals.

File: src/jobs/analyticsJobs.ts

Responsibilities:
- Export a single async function runAnalyticsJobs()
- Inside it:
  1. Call analyticsAggregator.runForAllCourses()
  2. Call generateSignalsForAllCourses()
- Ensure execution order: aggregation first, then signals
- Wrap the full run in try/catch
- Measure execution time (Date.now)
- Do NOT throw on partial failure; log and continue
- Return a structured result:
  { success: boolean, durationMs: number, error?: string }

Constraints:
- No DB writes except those performed by the called functions
- No content mutation
- No direct Prisma import; use injected db or shared helper pattern

10.J2 — Non-overlapping Execution Guard
Prompt to Copilot
Add a non-overlapping execution guard for analytics jobs.

Approach:
- Create src/jobs/jobLock.ts
- Implement acquireJobLock(jobName: string, ttlMs: number)
- Implement releaseJobLock(jobName: string)
- Use Prisma with a JobLock table OR reuse an existing lock mechanism if present

Rules:
- If a lock exists and is not expired, abort execution gracefully
- Do not throw; return { skipped: true, reason: "locked" }
- Ensure lock auto-expires if process crashes


(If no JobLock table exists, Copilot should add it via Prisma with minimal fields: jobName, lockedUntil.)

10.J3 — Audit Logging
Prompt to Copilot
Add audit logging for analytics job runs.

For each run of runAnalyticsJobs():
- Write a non-blocking audit entry with:
  action: "ANALYTICS_JOB_RUN"
  status: SUCCESS | FAILED | SKIPPED
  durationMs
  error (if any)
- Reuse existing audit log helper (do not invent new infra)
- Audit failure must NEVER block job completion

10.J4 — Scheduler Hook
Prompt to Copilot
Wire analytics jobs into the existing scheduler / orchestrator.

Options (pick what exists):
- If cron-based: add a nightly cron entry
- If serverless scheduled job: add handler
- If GitHub Actions (temporary): nightly workflow calling the job

Rules:
- Frequency: once per day (UTC or system timezone)
- Ensure job lock is checked before execution
- Ensure logs are emitted for start/end
- No retries yet (fail fast, observable)

10.J5 — Minimal Monitoring Signal
Prompt to Copilot
Add minimal observability for analytics jobs.

Requirements:
- Log structured JSON:
  { job: "analytics", status, durationMs }
- Increment a simple counter (if metrics infra exists)
- Add TODO comments for future alerting
- Do NOT add dashboards or alerts yet

✅ Completion Criteria (Phase 10 Activation)

Copilot should confirm:

Jobs run on schedule
Only one instance runs at a time
Audit logs show job outcomes
No tests broken
No new write paths to content tables

➡️ Once done: Phase 10 is officially “LIVE”


# Phase 10 — implementation Summary
Intended
Lock: Add non-overlapping job lock for analytics runs (DB-backed JobLock).
Implementation: Create jobLock.ts and use in analyticsJobs.ts.
Audit: Record an audit entry per run via log.ts.
Scheduling: Wire runAnalyticsJobs() into the orchestrator (orchestrator.ts) with env control.
Metrics: Add Prometheus counter and increment on run (metrics-server.ts).
Tests & Quality: Add unit tests and fix lint/type issues; validate via CI/test suite.
Completed
Prisma model: Added JobLock to schema.prisma.
Lock implementation: Added jobLock.ts (acquire/release semantics, test-friendly).
Job runner: Updated analyticsJobs.ts to use the lock, write non-blocking audit entries, increment metrics, and release lock.
Orchestrator: Scheduling hook added in orchestrator.ts (env-controlled).
Metrics: Added analytics_job_runs_total counter and incAnalyticsJobRun() in metrics-server.ts.
Tests: Added analyticsJobs.test.ts and fixed related tests; full test suite passed (32 suites, 82 tests).
Lint/TS: Replaced problematic console.* usages with project logger and fixed TS typing issues.
Pending
DB migration: Apply Prisma migration so JobLock exists in the running DB.
Integration tests (optional): Run job runner end-to-end against a migrated test/staging DB.
Enable scheduler: Turn on scheduling with ORCHESTRATOR_ENABLE_ANALYTICS=1 (only after migration).
Alerting & dashboards: Add Prometheus alert rules and an admin dashboard for analytics_job_runs_total (e.g., alert on consecutive failures / high duration).
Monitor: Observe audit logs and metrics for first runs in staging before production enablement.
Suggestions / Next Steps
Run the Prisma migration in a dev/staging environment.

Enable orchestrator scheduling in staging and verify one manual run first.

Add a Prometheus alert rule (example concept): alert when failed runs > 0 over 15m or failure rate spikes; and create an on-call escalation to inspect AuditLog entries.

Run an integration smoke test after migration.

If you want, I can:

Create and run the Prisma migration now (needs DATABASE_URL), or
Draft a sample Prometheus alert rule and a short monitoring playbook, or
Enable the orchestrator in staging and run a manual job run.