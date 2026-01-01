Excellent — Phase 16 is the right next step, and it’s also the phase that separates “this works” from “this is production-ready and resilient”.

Below is a very detailed Phase 16 document followed by section-by-section Copilot instructions, deliberately broken down so you do NOT give Copilot everything at once.

This phase introduces NO new product features.
It is pure hardening, ops, reliability, and governance.

# PHASE 16 — Production Hardening, Ops, and Governance
Phase 16 Purpose (WHY)

By Phase 15, your system has:
Immutable content generation
Admin-governed retries & promotion
Learner-safe read paths
Analytics → signals → suggestions → regeneration → promotion

Phase 16 ensures:
Nothing breaks silently
Jobs don’t double-run
Failures are observable and recoverable
Ops teams can trust the system
You can safely scale without re-architecture
Phase 16 Principles (NON-NEGOTIABLE)
No new writes to content models
No generators in control plane
Everything observable
Failures must be detectable, auditable, and recoverable
Every background job must be idempotent
Every environment must be reproducible

Phase 16 Breakdown
## 16.1 Background Job Orchestration & Scheduling
What we want to achieve

Centralized, explicit job scheduling
No hidden cron logic
Jobs safe to restart
Single-runner or multi-runner compatible
Scope
Analytics Aggregator
Signal Generator
Insight Engine (Phase 11)
Regeneration Worker
Retry Executor (Phase 14)
Design
Introduce a Job Registry

Each job declares:
name
interval / trigger mode
lock key
timeout
retry policy (usually NONE)
Use advisory locks or equivalent
One job = one execution unit

### Copilot Prompt — Phase 16.1

#### Prompt 1 — Job Registry

Create a lib/jobs/registry.ts that exports a JobDefinition interface and a JobRegistry map.

Each JobDefinition must include:
- name: string
- run(): Promise<void>
- lockKey: string
- timeoutMs: number
- schedule: { type: 'interval' | 'manual', everySec?: number }

Do NOT add cron logic yet.
Do NOT execute jobs automatically.

#### Prompt 2 — Register Existing Jobs
Register existing jobs:
- analyticsAggregator
- generateSignals
- generateSuggestions
- regenerationWorker

Each must be wrapped as a JobDefinition using existing run functions.
Do not change job logic.

## 16.2 Unified Job Runner (Safe Execution Wrapper)
What we want to achieve

One way to run jobs
Enforced timeout
Guaranteed lock
Structured logs
Consistent error handling
Design
Introduce runJob(job: JobDefinition)

Steps:
Acquire advisory lock
Start timer
Execute job
Release lock
Emit metrics & audit
Never crash the process
Never retry automatically

### Copilot Prompt — Phase 16.2
#### Prompt 3 — Job Runner

Create lib/jobs/runner.ts.

Implement runJob(job: JobDefinition) that:
- Acquires Postgres advisory lock using job.lockKey
- Enforces timeout using AbortController or Promise.race
- Logs structured start/end/error events
- Releases lock in finally

Do NOT add retries.
Do NOT swallow errors silently.


### Copilot Prompt - Phase 16.3
#### Prompt 4 — Dry Run Support

Add support for JOB_DRY_RUN=1.
When enabled, runJob logs execution but does not call job.run().

## 16.3 Metrics & Observability (Minimum Viable)
What we want to achieve

Know when jobs run
Know when they fail
Know how long they take
Know if they stop running
Design

Metrics helper:
job_runs_total
job_failures_total
job_duration_ms
No vendor lock-in
Use counters + histograms
Emit from job runner only

#### Prompt 5 — Metrics Helper
Create lib/metrics/jobs.ts.

Expose functions:
- recordJobStart(name)
- recordJobSuccess(name, durationMs)
- recordJobFailure(name, error)

Implementation may be console-based or Prometheus-style, but must be isolated.
Do not import this directly into job logic.


### Copilot Prompt - 16.4
#### Prompt 6 — Integrate Metrics

Integrate metrics helper into runJob() so all jobs emit metrics automatically.

## 16.4 Alerting on Job Failures (Ops Signals)
What we want to achieve

Humans know when jobs fail
No alert spam
No silent degradation
Design
Emit AlertType = JOB_FAILED

Include:
job name
error summary
timestamp
Rate limit alerts (reuse alerting infra)
No auto-recovery

### Copilot Prompt — Phase 16.4

#### Prompt 7 — Job Failure Alerts

When runJob catches an error:
- Emit a JOB_FAILED alert using existing alert router
- Include job name and error message
- Respect rate limiting

## 16.5 Retention & Data Pruning
What we want to achieve
Control DB growth
Preserve critical artifacts
Avoid accidental deletion
Retention Policy
Model	Retention
AnalyticsEvent	90 days
AnalyticsDailyAggregate	2 years
AnalyticsSignal	1 year
ContentSuggestion	FOREVER
RegenerationOutput	FOREVER
PublishedOutput	FOREVER
AuditLog	FOREVER
Design

Retention job (manual + scheduled)
Soft delete where possible
Hard delete only for raw events

### Copilot Prompt — Phase 16.5

#### Prompt 8 — Retention Job

Create lib/jobs/retention.ts.

Implement pruneOldAnalyticsEvents(days=90) that deletes AnalyticsEvent rows older than threshold.

Do NOT delete signals, suggestions, outputs, or audits.
Register this as a JobDefinition (manual trigger only).

## 16.6 Environment & Deployment Hardening
What we want to achieve

Same behavior locally, CI, staging, prod
No missing migrations
Predictable boot behavior
Design

Startup checks:
DB connectivity
Pending migrations
Fail fast on misconfiguration
Explicit ENV contract

### Copilot Prompt — Phase 16.6
#### Prompt 9 — Startup Validation

Create lib/bootstrap/validateEnvironment.ts.

On app start:
- Verify DATABASE_URL exists
- Verify prisma client can connect
- Optionally check for pending migrations

Throw a fatal error if validation fails.

## 16.7 Operational Runbooks (Docs Only)
What we want to achieve

Humans know what to do
No tribal knowledge
Docs to add
JOBS.md
RETENTION.md
INCIDENTS.md

### Copilot Prompt — Phase 16.7

#### Prompt 10 — Runbook Docs

Create docs/JOBS.md documenting:
- Each job
- How to run manually
- Expected duration
- Failure behavior

Do not include implementation details.

Phase 16 Completion Criteria (VERY IMPORTANT)

Phase 16 is DONE ONLY IF:

✅ All jobs run via JobRunner
✅ Locks enforced everywhere
✅ Metrics emitted for every job
✅ Job failures produce alerts
✅ Retention job exists and is safe
✅ Environment validation prevents bad deploys
✅ No business logic changed

What Phase 16 DOES NOT DO

🚫 No new learner features
🚫 No AI generation
🚫 No retries
🚫 No mutation of content
🚫 No UI features

Recommended Execution Order (for Copilot)
16.1 Job Registry
16.2 Job Runner
16.3 Metrics
16.4 Alerts
16.5 Retention
16.6 Bootstrap validation
16.7 Docs

One Copilot prompt per subsection. Always wait for green tests before continuing.

After Phase 16

Once Phase 16 is complete, your system is:

✔ Safe
✔ Observable
✔ Governable
✔ Auditable
✔ Scalable

At that point, going live is a business decision, not a technical one.


# Summary of Phase 16 implementaion
## What Was Intended

Goal: Centralize and harden background jobs so they are safe, observable, auditable, and non-destructive per Phase 16 (no new features or content mutations).
Key requirements: JobRunner for unified execution, advisory locks, timeouts, metrics (job_runs_total, job_failures_total, job_duration_ms), job-failure alerts, a safe retention job, startup environment validation, and no business-logic changes.

## What We Completed

Job runner: Implemented runJob() with advisory-locking, timeout, dry-run support and structured audit events — runner.ts.
Registry & registrations: Job registry and job registrations added (analytics, signals, suggestions, regeneration) — registerJobs.ts and registry module.
Metrics helper: Isolated metrics wrapper (Prometheus dynamic import with logger fallbacks) — jobs.ts.
Alerting: Job failures emit alerts via existing alert router (rate-limited/deduped by router).
Retention job: pruneOldAnalyticsEvents(days=90) and registered manual job — retention.ts.
Startup validation: DB connectivity / migrations check helper — validateEnvironment.ts.
Docs / runbook: JOBS.md added (how to run, durations, failure behavior).
Verification: Ran npx prisma migrate status, npm run lint, and npx tsc --noEmit locally — all passed.

## What Is Pending

Register jobs at process bootstrap: import side-effect module so jobs are actually registered at runtime (add import '@/lib/jobs/registerJobs' in your app bootstrap/server entry or providers.tsx). Status: not started.
Apply migrations to staging/prod: requires infra access and environment credentials — do in CI/infra (not performed here).
Runtime monitoring & Prometheus scrape: metrics helper initialized, but ensure Prometheus scrape endpoint / exporter is wired in your deployment and that prom-client is present where you want scraping.
Operational verification in staging: run jobs in staging for a few cycles, validate alert noise/rate-limiting, and sanity-check retention deletes on a snapshot.

## Suggestions / Next Steps

Wire registration at bootstrap: add import '@/lib/jobs/registerJobs' to your server bootstrap (example: top of providers.tsx or your orchestrator entry). I can patch this for you.
Deploy migrations from CI: run in CI with locked credentials:
Prometheus & monitoring: expose Prometheus metrics endpoint (or ensure existing exporter scrapes prom-client) so job_* metrics are collected.
Staging runbook: run retention job in dry-run first, then a small production-like window; validate alerts and audit logs.
Optional: I can (a) add the bootstrap import patch now, (b) add a tiny CI checklist / one-liner job to run migrations in deployment, or (c) create a short docs/RETENTION.md with safe-run instructions — which would you like me to do next?