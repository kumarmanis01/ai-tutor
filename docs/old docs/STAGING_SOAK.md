# Staging Soak Runbook (48-hour)

Purpose
- Validate Phase 16 jobs under production-like load for 48 hours.
- Confirm advisory locks, metrics, alerts, retention, and startup validation behave correctly.

Prerequisites
- Staging environment with DB accessible and `STAGING_DATABASE_URL` secret set in CI.
- Prometheus / monitoring configured to scrape the app's `prom-client` metrics endpoint.
- Alert router configured for staging.
- A snapshot backup of the staging DB (for retention test safety).

Steps
1. Deploy code to staging (branch or commit).
2. Apply migrations via CI (use the `Deploy Prisma Migrations to Staging` workflow).

   - From GitHub Actions UI, run `Deploy Prisma Migrations to Staging`.

3. Start app with jobs enabled (server process must import `lib/jobs/registerJobs` — already wired in `app/layout.tsx`).

   - Use env var `JOB_DRY_RUN=1` for initial smoke runs (jobs will be logged but not executed):

```bash
# Example: start server with dry-run
NODE_ENV=staging JOB_DRY_RUN=1 npm run start
```

4. Verify metrics and alerts in first 1-2 hours:
   - Confirm `job_runs_total`, `job_failures_total`, and `job_duration_ms` metrics appear in Prometheus.
   - Confirm no excessive alerts are emitted. Tune alert rate-limits if noisy.

5. After smoke verification, disable dry-run and start real jobs:

```bash
NODE_ENV=staging npm run start
```

6. Enable retention job carefully:
   - Run retention in dry-run mode first (if implemented) or run manual `pruneOldAnalyticsEvents` with a test `days` param against a DB snapshot.
   - Only enable automatic retention after manual verification.

7. Soak for 48 hours:
   - Monitor metrics, logs, alerts, and audit logs.
   - Have on-call check-ins at 1h, 6h, 24h, and 48h.

8. Post-soak actions:
   - Review alert volume and false positives.
   - Verify audit logs for job runs (STARTED / SUCCESS / FAILED / TIMED_OUT).
   - If everything looks good, schedule rollout to production per normal release process.

Rollbacks
- If retention deletes were enabled and unexpected data loss occurs, restore from DB snapshot immediately.
- If jobs cause high error rates, scale down job frequency or set `JOB_DRY_RUN=1` (or comment out registration import) and redeploy.

Notes
- Do NOT run retention on production without a verified snapshot and a manual dry-run first.
- Ensure CI and infra teams are on-call during the soak window.
