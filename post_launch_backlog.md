# Post-Launch Backlog

Items that are intentionally deferred from the pre-launch sprint.
Do NOT implement any of these during the sprint unless a task explicitly instructs it.

Last updated: 2026-04-20

---

## F-STU-002 Diagnostic Assessment

### PLB-DIAG-01: Enable FEATURE_ADAPTIVE_DIAGNOSTIC in production
**Priority**: HIGH
**Owner**: Engineering
**Trigger**: After QA soak confirms no theta divergence at `ROLLOUT_PERCENTAGE=5`

**What**: Set `FEATURE_ADAPTIVE_DIAGNOSTIC=true` on the VPS to activate IRT-based adaptive
question selection in live diagnostics. The code path is fully implemented and tested behind
the feature flag -- only the env var change is needed.

**Pre-conditions**:
- Run diagnostic sessions at ROLLOUT_PERCENTAGE=5 for at least 2 weeks
- Confirm theta estimates converge within expected range (-3 to +3) for >95% of sessions
- Confirm SE stopping rule fires correctly (no sessions hitting max_items > 90% of the time)
- No increase in diagnostic abandonment rate vs baseline

**Implementation**: `lib/config.ts:featureFlags.adaptiveDiagnostic`; flip env var on VPS.

---

### PLB-DIAG-02: Tune grade-level seeding confidence
**Priority**: MEDIUM
**Owner**: Engineering + Data
**Trigger**: After 500+ completed diagnostics with follow-up learning sessions

**What**: Adjust `masteryVariance` (default 0.3) and initial `memoryStrength` heuristics in
`diagnosticBootstrapWorker` for partial-abandon runs. Current values are conservative estimates.
Tune based on comparing seeded mastery scores vs observed accuracy in subsequent learning sessions.

**Implementation**: `worker/services/diagnosticBootstrapWorker.ts:88-96`

---

### PLB-DIAG-03: Monitoring & observability for bootstrap pipeline
**Priority**: HIGH
**Owner**: Engineering
**Trigger**: Before raising `ROLLOUT_PERCENTAGE` above 20

**What**: Emit structured metrics from `diagnosticBootstrapWorker` on every run:
- `seeded_count` -- number of concepts newly seeded
- `skipped_count` -- number of concepts skipped (existing mastery higher)
- `is_partial_abandon` -- whether the run was triggered by < 10 answers
- `chapter_count` -- how many chapters were bootstrapped

Add alert: if `skipped_count / (seeded_count + skipped_count) > 0.8` for a student,
flag for manual review (indicates a repeat diagnostic on an already-seeded profile).

**Implementation**: `worker/services/diagnosticBootstrapWorker.ts` -- wire to metrics pipeline.

---

### PLB-DIAG-04: Rapid-fire gaming -- downstream action
**Priority**: MEDIUM
**Owner**: Engineering + Product
**Trigger**: After admin dashboard is built (Task 33+)

**What**: When `gamingFlagged=true` is persisted in `SubjectDiagnosticMeta` (currently logged
as a warning only), surface it in the admin dashboard so Manish can review and take action.
Possible actions:
- Require a supervised retake
- Apply a confidence discount to bootstrapped mastery scores
- Send a guidance nudge to the student (not punitive -- "Try reading each question carefully")

**Evidence**: `lib/diagnostics/stateStore.ts:gamingFlagged` field; `submit/route.ts:195-204`

---

### PLB-DIAG-05: Manual concept re-seed (instructor/parent override)
**Priority**: LOW
**Owner**: Engineering
**Trigger**: After parent dashboard v2 is shipped

**What**: Add an instructor/parent UI to re-seed concepts or select starting chapters when a
student reports misplacement after a diagnostic. Would call a protected API that re-runs
`processDiagnosticBootstrap` with a custom chapter list and `isPartialAbandon=false` override.

---

### PLB-DIAG-06: Analytics for minAnswersForValidity threshold tuning
**Priority**: LOW
**Owner**: Data
**Trigger**: After experiment framework is available

**What**: Expose `DIAGNOSTIC_MIN_ANSWERS` (default 10) as an A/B experiment variable.
Compare downstream learning plan quality and student retention across cohorts with
different thresholds (e.g., 7 vs 10 vs 13). Goal: find the minimum number of answers
that still produces reliable bootstrapped mastery scores.

---

## Other Features

### PLB-UI-LANG-01: Hindi language toggle in StickyHeader
**Priority**: LOW
**Owner**: Frontend
**Trigger**: After Hindi content is live in production

**What**: `components/StickyHeader.tsx` has a language toggle removed pending Hindi content availability.
Re-add the toggle when the Hindi syllabus hydration pipeline is complete and verified.
See: `components/StickyHeader.tsx` line 62 comment.

### PLB-INFRA-01: BullMQ explicit job timeouts
**Priority**: MEDIUM
**Owner**: Backend
**Trigger**: After go-live load testing

**What**: BullMQ workers currently rely on the default 30-minute job timeout.
Add explicit `timeout` values per queue (e.g., 60 000 ms for short jobs,
300 000 ms for content hydration) to prevent zombie jobs from blocking queues.

### PLB-OPS-01: PM2 log rotation configuration
**Priority**: LOW
**Owner**: Ops
**Trigger**: Before 1-month post-launch review

**What**: PM2 log files grow unbounded. Configure logrotate or pm2-logrotate module
with a max file size of 50 MB and 7-day retention for all three processes
(ai-tutor-web, content-engine-worker, ai-tutor-scheduler).

### PLB-PERF-01: Hydration and slow-query metrics in daily admin report
**Priority**: MEDIUM
**Owner**: Backend
**Trigger**: After stable production baseline (1 week post-launch)

**What**: `worker/services/costReportingWorker.ts` daily email covers AI cost and cache hit rate.
Extend with: hydration job completion/failure counts (from HydrationJob table),
slow query aggregation (from prisma slow-query logs), and worker queue depth.
Recipient: feedback@spinzyacademy.com alongside ONCALL_EMAIL.

### PLB-INFRA-02: Centralised env schema validation (Zod)
**Priority**: MEDIUM
**Owner**: Backend
**Trigger**: After go-live stabilisation

**What**: Environment variables are validated ad-hoc (string comparisons, parseInt with defaults).
Create `lib/envSchema.ts` with a Zod schema covering all required vars, run it at
process startup for both web and worker, and fail fast with a clear error message
if any required var is missing or invalid.

### PLB-INFRA-03: NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN in ecosystem.config.cjs
**Priority**: HIGH
**Owner**: Ops
**Trigger**: Before go-live

**What**: Sentry is integrated (sentry.server.config.ts, sentry.client.config.ts) but
NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN are absent from ecosystem.config.cjs env_production blocks.
Sentry is silently disabled in production. Add the DSN values to the PM2 env_production
blocks for all three processes (web, worker, scheduler) to activate error tracking.

*(Add future backlog items here as they are identified during the sprint)*
