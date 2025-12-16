# Copilot Engine Checklist

This checklist maps the AI Content Engine guardrails to concrete code locations so reviewers and automated audits can verify compliance quickly.

Follow-up: run the automated audit script to mark each item ✅/🟡/❌ with line-level links.

## Mandatory Architectural Rules

- [ ] **Job-based execution only:** All long-running or AI operations must use `ExecutionJob` and `submitJob()`.
  - See: [Docs/AI_Execution_pipeline.md](Docs/AI_Execution_pipeline.md) and [lib/execution-pipeline/submitJob.ts](lib/execution-pipeline/submitJob.ts)
- [ ] **No direct LLM calls from UI/API routes:** UI and API routes must not call LLMs synchronously.
  - Check: [eslint-rules/no-callLLM-in-api-or-ui.cjs](eslint-rules/no-callLLM-in-api-or-ui.cjs)
- [ ] **Enums for statuses and types:** Use Prisma enums (JobStatus, JobType, ContentStatus, Language).
  - Check: [prisma/schema.prisma](prisma/schema.prisma)
- [ ] **Soft deletes only:** No hard deletes for AI content or jobs; use `deletedAt`/`isActive`.
  - Check: `prisma/schema.prisma`

## Execution & Worker Safety

- [ ] **No per-job pause/resume:** Jobs are atomic; no pause/resume APIs allowed.
  - See: [Docs/COPILOT_GUARDRAILS.md](Docs/COPILOT_GUARDRAILS.md)
- [ ] **No streaming or progress tracking:** Jobs must be status-driven (`queued|running|failed|completed`).
  - See: [Docs/COPILOT_GUARDRAILS.md](Docs/COPILOT_GUARDRAILS.md)
- [ ] **Leasing & locking for workers:** Workers must lease jobs atomically (FOR UPDATE SKIP LOCKED) and set `lockedAt`/`lockedBy`.
  - See: [Docs/AI_Execution_pipeline.md](Docs/AI_Execution_pipeline.md) and `prisma/schema.prisma` (ExecutionJob model)

## Runtime Guards & Validation

- [ ] **ID-first hierarchy (no string filters):** Reject string-based filter query params and require ID params.
  - Runtime guard: [lib/guards/noStringFilters.ts](lib/guards/noStringFilters.ts)
  - Applied to: `app/api/hierarchy/route.ts` and related routes
- [ ] **submitJob() as canonical entrypoint:** All API job requests must call `submitJob()` which enforces idempotency and validation.
  - See: [lib/execution-pipeline/submitJob.ts](lib/execution-pipeline/submitJob.ts)

## Observability & Auditability

- [ ] **Audit logs for admin actions:** All admin actions must create audit logs including actor/action/entity/timestamp.
  - Check: `components/Admin/*`, `lib/logger.ts`, and `prisma` models for AuditLog/AuditTrail
- [ ] **Failure is a first-class state:** Explicit retry workflows only; no silent retries.
  - See: [Docs/COPILOT_GUARDRAILS.md](Docs/COPILOT_GUARDRAILS.md)

## Static Analysis & CI

- [ ] **ESLint rules enforce guardrails:** Local rules in `eslint-rules/` must be part of CI lint runs.
  - Check: `eslint.config.mjs` and `eslint-rules/*.cjs`
- [ ] **Prisma schema enforcement:** `schema.prisma` top comment and enums must be present.
  - Check: [prisma/schema.prisma](prisma/schema.prisma)

## Quick file checklist (likely targets for automated audit)

- `Docs/COPILOT_GUARDRAILS.md` — core guardrails (authoritative)
- `Docs/AI_Execution_pipeline.md` — execution flow and leasing
- `lib/execution-pipeline/submitJob.ts` — canonical job submit implementation
- `lib/guards/noStringFilters.ts` — runtime guard for ID-first
- `app/api/admin/content-engine/jobs/route.ts` — admin job POST route
- `app/api/hierarchy/route.ts` — hierarchy API (ID-first)
- `prisma/schema.prisma` — enums and ExecutionJob model
- `eslint-rules/` — local eslint rules to prevent bad patterns

---

If you want, I can now run an automated audit that marks each checklist item with ✅/🟡/❌ and file links. Proceed?
