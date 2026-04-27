git reset --hard; git fetch origin; git pull; chmod +x scripts/de

Actionable Tickets (Jira-style)

ADM-001 — Ingestion Idempotency & Chunk Versioning (Priority: High, Est: 3–5d)
Description: Prove and harden idempotent ingest; ensure re-running ingestion replaces/version-bumps chunks (no duplicates), log run outcomes.
Files / Targets: ingest-curriculum.ts, route.ts, schema.prisma (CurriculumChunk model), route.ts
Acceptance criteria: Re-running ingest on same file+metadata produces no duplicate CurriculumChunk rows; changed content increments version and updates contentHash; IngestRunLog records correct chunksCreated/chunksUpdated/errors.
Test tasks: add unit test tests/unit/scripts/ingest-curriculum.test.ts (idempotency + version bump), integration test that runs ingest twice and asserts DB state; add CI gate.

ADM-002 — Misconception Prevalence Job (Priority: High, Est: 2–3d)
Description: Add scheduled monthly job to compute and persist Misconception.prevalenceRate. Wire alerts for >30% prevalence.
Files / Targets: misconceptionPrevalenceWorker.ts (added), schema.prisma (Misconception.prevalenceRate), scheduling config (worker cron / job runner).
Acceptance criteria: Worker runs monthly, updates prevalenceRate for all misconceptions, and produces a report/alert for any >0.30.
Test tasks: misconceptionPrevalenceWorker.test.ts (exists), add integration smoke test that runs worker against test DB.

ADM-003 — DoubtKb Deduplication & Index Tuning (Priority: High, Est: 3–5d)
Description: Ensure DoubtKb write-dedup (similarity threshold), ivfflat/index tuning, and monitoring of cache-hit ratio. Prevent KB bloat.
Files / Targets: doubtKb.ts, prisma/migrations/*add_doubt_kb*, plan for worker/services/doubtKbWorker.ts (if missing, scaffold).
Acceptance criteria: On write, near-duplicates (cosine >= threshold) update existing row (timesServed/alternatePhrasings) instead of inserting; retrieval uses pgvector index tuned for production.
Test tasks: unit tests for dedup logic (tests/unit/lib/ai/tutor/doubtKb.test.ts), performance test for retrieval latency at scale.

ADM-004 — Guardrail Enforcement Audit + Fixes (Priority: High, Est: 4–6d)
Description: Audit session orchestrator to ensure the full guardrail stack (intentClassifier → promptRewriter → hallucinationDetector → safeResponses) runs on every AI response and that low_groundedness and safety triggers write AnalyticsEvent. Fix any missing invocations.
Files / Targets: turn.ts (or [lib/session/sessionEngine.ts] if used), index.ts, hallucinationDetector.ts, route.ts
Acceptance criteria: Every AI turn passes through guardrail pipeline; hallucination/safety events create AnalyticsEvent rows; unit/integration tests assert guardrail invocation and analytics writes.
Test tasks: update orchestrator.test.ts to assert guardrail calls and AnalyticsEvent enqueue; add unit tests for orchestrator fallback/error paths.

ADM-005 — LLM Cost Logging Coverage & Alerts (Priority: Medium, Est: 2–4d)
Description: Ensure all LLM wrappers and embedding functions log token counts, model, call_type, cost_usd, cache_hit to analytics. Wire anomaly alerting (1.5x rolling 7-day).
Files / Targets: [lib/ai/embeddings.ts or getEmbeddingsBatch usage](lib/ai/embeddings.ts or lib/ai/embeddings), wrappers that call LLMs (search getEmbeddingsBatch, ai), costReportingWorker.ts, client.ts
Acceptance criteria: All AI entry points emit AnalyticsEvent with required fields; cost alerting works and is tested.
Test tasks: unit tests for each LLM wrapper ensuring analytics.enqueue called; e2e test to simulate cost spike and assert alert path (email/logging stubbed).

ADM-006 — Misconception Library Seeding + Admin Review UI (Priority: Medium, Est: 3–5d)
Description: Provide seeded misconceptions for launch (20 per subject) and minimal admin UI/SQL runbook to review/edit quarantined misconceptions.
Files / Targets: prisma/seeds/misconceptions-*.ts (create), [app/admin/pages or app/admin/misconceptions UI](app/admin/page.tsx or app/admin/*), schema.prisma (Misconception model)
Acceptance criteria: Seed scripts exist & documented; admin can list/edit misconceptions (with audit log).
Test tasks: seed script unit test or smoke-run; UI component tests (components).

ADM-007 — AuditLog Immutability & Archival (Priority: Medium, Est: 2–3d)Description: Enforce DB-level immutability for AuditLog (deny UPDATE/DELETE for non-superuser) and add archival job to push year-old logs to Cloudflare R2.
Files / Targets: schema.prisma (AuditLog), new SQL migration (triggers/roles), worker for archival (worker/services/auditArchivalWorker.ts).
Acceptance criteria: Attempts to update/delete audit rows fail; archival worker archives logs older than 1 year to R2 and leaves read-only reference.
Test tasks: integration test asserting UPDATE fails; unit test for archival worker (mock R2).

ADM-008 — Question Bank Quarantine Flow & Admin Review (Priority: Medium, Est: 3–4d)
Description: Harden quarantine triggers, admin review flows, and re-instate/reject actions with audit logs. Add health report job for questions-per-concept.
Files / Targets: app/api/student/question/[questionId]/flag/route.ts, questionsWorker.ts, route.ts, admin UI pages for review.
Acceptance criteria: Questions hit quarantine after 3 flags; admin actions change status with auditLog entries; weekly health report emits counts and alerts for concepts with <5 questions.
Test tasks: audit.test.ts covers quarantine + admin actions (exists); add health-report unit test.

ADM-009 — Analytics Event Consistency & Retention Policy (Priority: Medium, Est: 2–3d)
Description: Validate AnalyticsEvent schema usage across producers; ensure retention job prunes appropriately and indexed queries support daily reports.
Files / Targets: route.ts, client.ts, retention.ts
Acceptance criteria: Analytics producers use consistent eventType/metadata fields; retention job documented and tested; indexes exist for eventType/createdAt.
Test tasks: unit test for client.ts, retention job unit test (prune semantics).

ADM-010 — CI Gates & Test Coverage for Critical Flows (Priority: Low→Medium, Est: 1–2d)
Description: Ensure CI enforces tests for ingestion idempotency, guardrail pipeline, DoubtKb dedup, and misconception prevalence. Update package.json scripts and jest.config.cjs if needed.
Files / Targets: package.json, jest.config.cjs, CI config (GitHub Actions / CI scripts).
Acceptance criteria: New tests run in CI; critical coverage thresholds enforced for modules changed.
Test tasks: update CI job to run added unit/integration tests; add coverage assertions for changed modules.
ploy-and-run.sh; ./scripts/deploy-and-run.sh;



Next Pass

Summary of findings and recommended next steps.

- **ADM-001: Ingest idempotency**: Implemented (see ingest-curriculum.ts, schema.prisma `CurriculumChunk`, and `IngestRunLog`). Unit tests exist: ingest-curriculum.test.ts. Gap: no integration test exercising a full DB run (re-run ingest and assert rows/version/hash). Next: add an integration test `tests/integration/scripts/ingest-curriculum.integration.test.ts` and add CI job to run it.

- **ADM-002: Misconception prevalence worker**: Implemented (misconceptionPrevalenceWorker.ts) and wired to scheduler (scheduler.ts). Unit tests present (misconceptionPrevalenceWorker.test.ts). Good.

- **ADM-003: DoubtKb dedup & index tuning**: Implemented in doubtKb.ts (pgvector queries, dedup thresholds) and migrations include IVFFLAT index (`prisma/migrations/*add_doubtkb_ivfflat_index*`). Unit tests for dedup exist (doubtKb.test.ts). Recommendation: smoke-run migration in staging and add a small integration/infra test to assert IVFFLAT index exists and retrieval latency under expected load.

- **ADM-004: Guardrail enforcement audit + fixes**: Orchestrator uses the guardrail pipeline (turn.ts imports `classifyIntent`, `processPrompt`, `checkForHallucinations`, `getSafeResponseForIntent`) and writes analytics for hallucination/safety events. Unit/integration tests cover orchestrator paths. Status: implemented; recommend targeted tests asserting AnalyticsEvent rows are created (if not already) for hallucination + safety events.

- **ADM-005: LLM cost logging coverage & alerts**: callLLM.ts and embeddings.ts emit `aITutorTurnLog` / `aIContentLog` and `analyticsEvent` with token/cost metadata. costReportingWorker.ts exists with tests. Status: largely implemented. Recommendation: review that `cost_usd` is correctly computed for embedding calls (currently set to 0 in some places) and add unit tests for analytics event fields and a cost-alert smoke test simulating a spike.

- **ADM-006: Misconception library seeding + admin UI**: Seed files exist (`prisma/seeds/misconceptions_cbse_grade10_*.ts`) and tests reference them. Admin UI docs and pages exist. Status: implemented.

- **ADM-007: AuditLog immutability & archival**: Migration present (`prisma/migrations/*auditlog_immutability_and_archival*`). Worker migration for archival is present in migrations listing. Recommendation: inspect/apply migration in a test DB and add integration test asserting UPDATE/DELETE on `AuditLog` fail for non-superuser, and unit test for archival worker mocking R2.

- **ADM-008: Question bank quarantine flow & admin review**: Implemented (route.ts) — auto-quarantine at 3 flags, audit log created. Recommendation: add or ensure weekly health-report job tests exist (search found related tests).

- **ADM-009: Analytics event consistency & retention**: `callLLM`, `embeddings`, guardrails and orchestrator emit `analyticsEvent` and logs. Retention job and indexes exist in migrations. Recommendation: add a unit test asserting standardized `ai_call` metadata fields and add retention job test if missing.

- **ADM-010: CI gates & tests for critical flows**: Unit tests exist for many flows; integration tests are present for some workers. Gaps: missing integration test for ingest idempotency and possibly missing CI enforcement to require those specific integration tests and coverage thresholds. Recommendation: add the ingest integration test and update CI to run the new integration tests and the coverage gate for the affected modules.

Concrete next actions I can take (pick one or more):
- Add the ingest integration test that runs ingest-curriculum.ts twice against a test DB and asserts no duplicate `CurriculumChunk` rows and version/hash behavior.
- Add CI changes to run the new integration test and enforce coverage for changed modules.
- Add an integration/infra smoke test asserting the DoubtKb IVFFLAT index exists and a simple query returns results.
- Inspect Prisma migration SQL for the `auditlog_immutability_and_archival` migration and write the archival worker unit test (mocking R2).

Which of the above should I implement first?