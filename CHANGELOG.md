# Changelog

## Unreleased

- chore(dead-code-pruning): SAFE_DELETE pass — 865 lines removed across 14 symbols/9 files (branch: prune/dead-code-cleanup → claude/sharp-hawking-xQH3y)
  - **Deleted files**: `PendingContenet.tsx` (typo-filename stub), `SafetyEventTable.tsx` + its two orphaned hooks (`useAdminSafetyEvents`, `usePatchSafetyEventResolved`), `ProfileCompletionGate.tsx` (null stub), `TestHome.tsx` (dev scratchpad), `LoadingSpinner.tsx` (prohibited by skeleton-mandate in CLAUDE.md), `lib/onboarding.ts` (replaced by routing-based `OnboardingGateShell`)
  - **Type-only removals**: `AccountStatus` (hand-rolled duplicate of Prisma enum), `AiErrorCode`, `AuditEventKey`, `GrammarQuestionType`, `MailSubjectKey` — all zero-ref type aliases
  - **Comment block**: 285-line superseded NextAuth config in `lib/auth.ts`
  - **Rationale documented in triage**: `triage/dead-code-2026-05-24.md` (14 SAFE_DELETE, 26 SPECULATIVE kept, 7 RISKY deferred)
  - **Preserved**: all SPECULATIVE (distress detection, ConsentGate, V1 hooks pending Task 32) and all RISKY (freeTierUsage prop, seed-mocks queue, image-caption/save-chats routes, billing contract types)

- chore(hardening): post-pruning surface-area lockdown
  - ESLint: upgraded `@typescript-eslint/no-unused-vars` from warn → **error**; added explicit `no-unreachable: error`
  - tsconfig: added `noUnusedLocals: true` and `noUnusedParameters: true`; resolved all 118 new compiler errors (unused `req` params in 30+ route handlers, unused `_`-prefixed locals, orphaned `Prisma` imports)
  - BullMQ: added `KNOWN_QUEUE_NAMES` startup assertion in `worker/bootstrap.ts` — throws if `WORKER_TYPE` is not a registered queue constant; prevents silent worker misconfiguration
  - `@internal` JSDoc: added to `hashPrompt`, `redactedPreview`, `buildPromptRequestBody` (test-only exports in `lib/callLLM.ts`) and `requiresParentOTPGate` (auth-layer-only gate in `lib/student/accountStatus.ts`)
  - No OpenAPI spec exists in the repo; no spec update required
  - Bundle analysis: no browser environment available — deferred; chunk delta visible in next production deploy

- refactor(student-topbar): merge focus into combined topbar stats contract
  - Removed standalone `GET /api/student/topbar-focus`
  - `GET /api/student/topbar-stats` now returns both momentum stats and the focus payload consumed by the student top bar
  - Updated student top bar client state to use the combined response in one SWR request
  - Added table-driven integration coverage for `resume_session`, `spaced_revision`, and `inactive_return` focus mappings

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
