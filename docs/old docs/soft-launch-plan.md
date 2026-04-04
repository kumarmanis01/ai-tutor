# Soft Launch Plan

This document defines a controlled, measurable soft-launch for the AI Tutor content engine. It lists phased rollout targets, the metrics to monitor, alert thresholds, rollback steps, backup procedures, and the emergency kill-switch.

## Goals
- Validate engine stability under real user traffic
- Detect and fix race conditions, duplicate writes, and mastery corruption
- Confirm acceptable error rates and UX metrics before broader release

## Phases

- **Phase 1 — Pilot (10 users)**
  - Duration: 2–3 days
  - Purpose: safety verification, manual observation, validate alerts
  - Acceptance: zero production data corruption, <1% HTTP 5xx, no duplicate STM rows

- **Phase 2 — Small Rollout (50 users)**
  - Duration: 3–7 days
  - Purpose: capacity and concurrency validation
  - Acceptance: sustained performance, <0.5% error rate on core flows, acceptable latency

- **Phase 3 — Extended Rollout (200 users)**
  - Duration: 7–14 days
  - Purpose: validate at scale for soft-launch KPIs
  - Acceptance: metrics stable, no persistent regressions, readiness for incremental expansion

## Metrics to Watch

- **next_action_click_rate** — fraction of `next-action` responses leading to immediate user clicks; monitor daily and hourly.
- **completion_rate** — fraction of `complete-action` successes per attempts.
- **override_rate** — fraction of times the engine is manually overridden (human remediation); high values indicate rule mismatch.
- **practice_success_rate** — pass rate for practice submissions (expected ranges by grade/subject).
- **engine.loop.detected** — count of detected engine oscillations or retries (should be near zero).
- **Error and Latency** — HTTP 5xx count, median and p95 latency for `GET /api/home/next-action` and `POST /api/home/complete-action`.

For each metric define an alert with a recovery window (5–15 minutes) before paging.

## Alert Thresholds (recommended)

- HTTP 5xx rate > 1% for 10m → page on-call
- engine.loop.detected > 5 in 10m → page on-call
- duplicate STM rows discovered → page immediately and pause rollout
- next_action_click_rate drop > 30% vs baseline → investigate (no immediate rollback)

## Rollback Plan

1. Immediately enable emergency kill-switch (see below).
2. Communicate to stakeholders (Slack: #ops, #product) and open an incident thread.
3. If data corruption suspected: run DB read-only scripts to identify affected rows and restore from latest pre-launch backup (see backup procedure).
4. If regression is service-level (errors/latency): rollback web worker/process deployment to last-known-good release and re-run smoke tests.
5. After rollback, run integrity checks (STM duplicates, session consistency, mastery census) before resuming.

## Data Backup Procedure

1. Trigger a logical DB dump of relevant schemas (Postgres):

```bash
PGPASSWORD="$DB_PASSWORD" pg_dump --format=custom --no-owner --file=prelaunch-$(date -u +%Y%m%dT%H%M%SZ).dump $DATABASE_URL
```

2. Snapshot Redis keys of interest (STM keys, session keys):

```bash
redis-cli -u "$REDIS_URL" --rdb redis-prelaunch-$(date -u +%Y%m%dT%H%M%SZ).rdb
```

3. Store backups in secure, access-controlled storage (S3 with versioning) and verify checksum.

4. Maintain a retention policy (e.g., 30 days for pre-launch snapshots) and document the backup used for any recovery.

## Emergency Kill Switch (Feature Flag)

- Implement a single feature flag `feature.soft_launch.enable` or `engine.enabled` controlled via the admin console or a simple toggle in the config service.
- Toggle behavior:
  - `enabled=true` → normal behavior
  - `enabled=false` → API endpoints return a safe fallback: structured empty `next-action` advising maintenance; enqueue a non-destructive audit entry.
- Ensure the flag is readable by web and worker processes within 30s of toggling (use Redis or config service with short TTL).

## Integrity Checks & Post-Rollout Tests

- Run the `scripts/concurrency-stress-test.cjs` and `scripts/chaos-progress-simulation.cjs` after each phase and before proceeding.
- Run `scripts/prelaunch-check.cjs` to validate environment and gating conditions.
- Run targeted DB queries to detect duplicate `StudentTopicMastery` entries and inconsistent `LearningSession` rows.

## Responsibilities

- **On-call Engineer:** monitor alerts, execute rollback, run backups and integrity checks.
- **Product Owner:** approve progression between phases and review user-facing regressions.
- **Data Lead:** validate backups and lead recovery if needed.

## Communication

- Use the incident channel and status page for user-facing issues.
- Document all rollback and remediation steps in the incident ticket.

---
Document maintained in `docs/soft-launch-plan.md`. Update thresholds and owners before production rollout.
