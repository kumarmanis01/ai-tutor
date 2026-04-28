# Internal Beta — 3-Day Testing Plan

This document provides an execution-ready plan for a 3-day internal beta focused on validating data correctness, engine behavior, and user-facing experience before a soft launch. No feature or engine changes are permitted during this test window.

Overview

- Audience: internal QA, on-call engineer, product owner, data lead
- Scope: simulate real student flows (manual + automated), run stress & chaos tests, validate metrics & logs
- Preconditions: production-like environment (DB, Redis, server), `NEXTAUTH_SECRET` set, backups taken before Day 1

Day 1 — Data & Engine Validation (Day 0 → Prep)
Goal: Ensure DB/Redis connectivity, schema integrity, and that engine rules produce deterministic, non-destructive outputs for seeded students.

What to do

- Run `scripts/prelaunch-check.cjs` to validate environment (Redis, Postgres, NEXTAUTH_SECRET, STM key scan, test-mvp-flow)
- Run `scripts/expand-seed-curriculum.cjs` to ensure required curriculum density (if permitted in test DB)
- Run `scripts/audit-logs-safety.cjs` to detect unsafe logging
- Run `scripts/failure-injection-test.cjs` to validate engine fallback on DB latency/failure
- Run `scripts/manual-user-simulation.cjs` for 2–3 manual inspections of `next-action` / `complete-action` flows
- Export DB snapshot / backup (logical dump) and note backup id

Metrics to record

- Baseline `next_action_click_rate`, `completion_rate` (sample of seeded users)
- `engine.loop.detected` initial count
- HTTP 5xx and latency (p50/p95) for `GET /api/home/next-action` and `POST /api/home/complete-action`

Logs to watch

- `web.err`, `worker.err` for uncaught exceptions or unhandled promise rejections
- Structured app logs (via `lib/logger.ts`) for `student.curriculum.changed`, engine loop warnings, and audit logs

Blocker criteria (stop and investigate)

- Any detected duplicate `StudentTopicMastery` rows
- Unhandled promise rejections in `web.err` or `worker.err`
- `test-mvp-flow` failure or `prelaunch-check` failing
- Redis unreachable or STM composite keys present

Acceptable minor issues (continue, but document)

- Occasional 5xx when running failure-injection tests (expected) but system recovers and no data corruption
- Minor latency spikes during stress tests if not sustained and no errors

Day 2 — Real Student Simulation (3 Personas)
Goal: Simulate realistic usage patterns across three representative personas and validate behavior under parallel usage.

Personas

- Persona A — Beginner student: short sessions, high pacing, many new topics
- Persona B — Remedial student: repeated low-accuracy practice, repeated guidance
- Persona C — Advanced student: longer lessons, higher practice accuracy, fewer repeats

What to do

- Seed 30 test users (10 per persona) using `scripts/concurrency-stress-test.cjs` harness or manual upsert via Prisma if required
- Run `scripts/concurrency-stress-test.cjs` with 20 parallel users first (smoke), then with full 30 in a controlled window
- For each persona, run 5 manual `scripts/manual-user-simulation.cjs` sessions to confirm UX expectations
- Run `scripts/chaos-progress-simulation.cjs` (if present) to inject realistic event sequences

Metrics to record (per persona)

- `next_action_click_rate` (per-session)
- `completion_rate` and `practice_success_rate`
- Number of `override_rate` events (manual corrections)
- `engine.loop.detected` spikes
- Error rates (5xx) and request latency (p50/p95)

Logs to watch

- AuditLog entries for `student.login`, `student.curriculum.changed`, and `student.*` engine events
- Any `logger.warn` or `logger.error` entries referencing `topic`, `mastery`, or DB operations

Blocker criteria

- Duplicate STM rows detected after parallel runs
- Any persistent API 5xx errors (>1% for 10 minutes) affecting core flows
- `LearningSession` rows with inconsistent state (endedAt null + isCompleted true)

Acceptable minor issues

- Individual user flows returning unexpected `next-action` once; document and investigate rule triggers
- Non-persistent rate-limit warnings if within expected throttle levels

Day 3 — Performance & UX Friction Audit
Goal: Verify system performance boundaries, measure UX friction, and finalize go/no-go decisions.

What to do

- Run `scripts/concurrency-stress-test.cjs` at target levels: Phase 1 load (10 users) then Phase 2 (50 users) if infra allows
- Run `scripts/failure-injection-test.cjs` to ensure graceful degradation
- Run `scripts/prelaunch-check.cjs` and `scripts/audit-logs-safety.cjs` again
- Manual walkthrough: product owner and QA run 10 user journeys across key flows (onboarding → practice → mastery)
- UX friction testing: measure time to first actionable `next-action`, number of choices before completion, and clarity of messages for fallbacks

Metrics to record

- Scalability: request throughput, p50/p95 latency under given concurrency
- Error budget: 5xx %, target <1% during test windows
- UX metrics: time-to-first-action, completion funnel conversion per persona

Logs to watch

- System health logs (`lib/systemHealth.ts` outputs), worker bootstrap logs
- Any `engine.loop.detected` or repeated warnings

Blocker criteria

- Sustained p95 latency degradation causing >10s responses on core endpoints
- Reproducible data corruption (duplicate STM, invalid mastery records)
- Any evidence of feature regression that impacts learning correctness (not UI cosmetics)

Acceptable minor issues

- Non-blocking UI text issues, minor styling/UX tweaks
- Temporary telemetry gaps if infrastructure is being instrumented during tests

Execution Checklist (prior to starting Day 1)

- [ ] Take DB & Redis backups and store backup IDs
- [ ] Ensure `NEXTAUTH_SECRET`, `DATABASE_URL`, `REDIS_URL` are set for test environment
- [ ] Confirm `scripts/prelaunch-check.cjs` passes on the environment
- [ ] Share test schedule and on-call contacts

Post-Test Deliverables

- Test run logs (archive `web.err` and `worker.err`) and exported structured logs
- Metrics snapshot and graphs for all watched metrics
- Incident report for any blockers with reproduction steps and remediation
- Decision: Proceed to soft launch or pause and remediate

Appendix — Quick Run Commands

```powershell
# Run environment checks
node scripts/prelaunch-check.cjs

# Run concurrency smoke test
node scripts/concurrency-stress-test.cjs

# Run failure injection
node scripts/failure-injection-test.cjs

# Run audit logs safety
node scripts/audit-logs-safety.cjs

# Manual interactive test
node scripts/manual-user-simulation.cjs
```

---

Document maintained in `docs/internal-beta-plan.md`. Update owners, contact lists, and any thresholds before executing the plan.
