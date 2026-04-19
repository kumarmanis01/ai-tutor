# F-ADM-030 — Core Growth Metrics: LTV / CAC automation

Date: 2026-04-17
Author: github-copilot (implementation agent)

Summary (commit message): Implement automated LTV/CAC computation and snapshot pipeline

- Added Prisma models: `MarketingSpend`, `LtvSnapshot` and corresponding SQL migrations.
- Implemented scheduled snapshot job: `jobs/metricsSnapshot.ts` and job registration in `lib/jobs/registerJobs.ts`.
- Exposed on-demand metrics API: `app/api/admin/metrics/ltv-cac/route.ts` (month-to-date default) and history API at `app/api/admin/metrics/ltv-cac/history/route.ts`.
- Added minimal admin dashboard UI: `app/admin/metrics/ltv-cac/page.tsx`.
- Created admin CLI to insert marketing spend: `scripts/insert-marketing-spend.ts`.
- Added unit test scaffold for metrics API: `tests/unit/app/api/admin/metrics_ltv_cac.spec.ts`.

Notes / Outstanding actions (pre-production):

1. Apply DB migrations and generate Prisma client:

   ```bash
   npx prisma migrate dev --name add_marketing_and_ltv_snapshot
   npx prisma generate
   ```

2. Fix tooling/schema warning: CI/type-check flagged a `datasource.url` schema deprecation. Align Prisma CLI/validator or migrate to `prisma.config.ts` if upgrading to Prisma 7.

3. Run a one-off snapshot (smoke test) and verify `LtvSnapshot` row creation and accuracy.

4. Add integration tests for snapshot job, CLI, and worker scheduling in CI.

Phase 2 (planned enhancements):

- Centralize metric SQL into `lib/metrics/aggregator.ts` and reuse across API/job/UI.
- Add per-channel marketing spend attribution and CAC-by-channel reporting.
- Add Admin UI to manage monthly spend with validation, audit logs, and soft-delete.
- Build an operational dashboard (Grafana/Prometheus or internal UI) with alerts on LTV/CAC thresholds.
- Provide safe backfill and idempotent re-run tooling for historical snapshots.
- Harden CI gates: require unit + integration coverage for job, CLI, and admin APIs before deploy.

Linked files:

- `prisma/migrations/20260417020000_add_marketing_spend`
- `prisma/migrations/20260417030000_add_ltv_snapshot`
- `jobs/metricsSnapshot.ts`
- `lib/jobs/registerJobs.ts`
- `app/api/admin/metrics/ltv-cac/route.ts`
- `app/api/admin/metrics/ltv-cac/history/route.ts`
- `app/admin/metrics/ltv-cac/page.tsx`
- `scripts/insert-marketing-spend.ts`
- `tests/unit/app/api/admin/metrics_ltv_cac.spec.ts`

EDIT LOG:
- 2026-04-17T00:00:00Z | github-copilot | implemented AC-07 automation: models, migrations, job, API, admin UI, CLI, tests (pending DB migrate + prisma generate)
