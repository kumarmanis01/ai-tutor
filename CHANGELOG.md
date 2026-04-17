# Changelog

## Unreleased

- chore(prompts): centralize prompt templates under `prompts/` and integrate templates into worker services
  - Added: `prompts/base_context.md`, `prompts/chapters.md`, `prompts/topics.md`, `prompts/notes.md`, `prompts/questions.*.md`, `prompts/quality_control.md`, `prompts/additional_examples.md`, `prompts/prompt_config.json`
  - Integrated prompt templates into `worker/services/*Worker.ts` (syllabus, notes, questions) with placeholder substitution and fallbacks
  - Added smoke script `scripts/smoke-render.cjs` to validate template rendering
  - Added unit tests under `tests/unit/prompts/` to validate templates and `prompt_config.json`
  - Fixed lint warnings related to unused variables

- feat(metrics): Automated LTV/CAC pipeline (F-ADM-030)
  - Added Prisma models and migrations: `MarketingSpend`, `LtvSnapshot` (`prisma/migrations/20260417020000_add_marketing_spend`, `prisma/migrations/20260417030000_add_ltv_snapshot`)
  - Scheduled snapshot job: `jobs/metricsSnapshot.ts` and registration in `lib/jobs/registerJobs.ts`
  - Admin APIs: on-demand metrics at `app/api/admin/metrics/ltv-cac/route.ts` and history endpoint at `app/api/admin/metrics/ltv-cac/history/route.ts`
  - Admin UI: metrics dashboard at `app/admin/metrics/ltv-cac/page.tsx`
  - Admin CLI: `scripts/insert-marketing-spend.ts` for inserting monthly marketing spend entries
  - Unit tests: basic coverage for metrics API at `tests/unit/app/api/admin/metrics_ltv_cac.spec.ts`
  - Notes / Pending: run `npx prisma migrate` + `npx prisma generate`; address Prisma schema validation warning about `datasource.url` deprecation (tooling mismatch may require aligning Prisma CLI version); add integration tests for job persistence and CLI behavior; consider centralizing raw SQL aggregator into shared helper.
