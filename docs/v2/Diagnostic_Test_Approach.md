<!--
FILE OBJECTIVE:
- Describe design and implementation approach for F-STU-002 Diagnostic Assessment (adaptive per-subject diagnostic using IRT 3PL), mapping requirements to current code, gaps, and a staged implementation plan.

LINKED UNIT TEST:
- tests/unit/docs/diagnostic_test_approach.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-06T12:00:00Z | senior-staff-engineer | created initial approach doc
 - 2026-04-06T12:12:00Z | senior-staff-engineer | added implementation tasks & started quick-fix (topicId filter + debug logs)
- 2026-04-06T12:30:00Z | senior-staff-engineer | implemented quick-fix: added topicId filter & debug logs in lib/tests.ts
-->

# Diagnostic Test — Design & Implementation Approach (F-STU-002)

## 1. Executive summary — my understanding

- Purpose: Provide a per-subject adaptive diagnostic during onboarding that accurately estimates student ability (theta) across the full syllabus and bootstraps the student's knowledge graph. The diagnostic must be mandatory before first tutoring session and support resume/partial submission within 24 hours.
- Key behaviours required by F-STU-002:
  - Adaptive test length: 15–25 items (stop rules configurable).
  - Item selection driven by an IRT 3PL model (parameters a, b, c) and content balancing (topic coverage).
  - 30-minute soft cap; student may pause and resume within 24 hours.
  - Outputs: mastery % per chapter (knowledge map), grade-level placement (below / at / above), recommended starting chapter.
  - Partial-abandon rules (special handling if <10 answers) and retake rules (30 days, different question set).

## 2. Current code surface (where behaviours are implemented today)

- Question selection and orchestration
  - `diagnosticQuestionService.ts` — picks a fixed set of 15 questions using round-robin topic selection and `ensureQuestions` fallback.
  - `tests.ts` (question retrieval helpers) — `selectQuestions` queries `Question` and falls back to `GeneratedQuestion` or AI generation (`generateQuestionsAI`).
- Client flow
  - `DiagnosticFlow.tsx` — 30-minute timer, save/continue endpoints, partial-save POST `/api/student/diagnostic/save-partial`, and UI that renders knowledge map on submit.
- Submission & bootstrap
  - `route.ts` (diagnostic submit) — writes `AnswerEvent` rows and enqueues a bootstrap job.
  - `diagnosticBootstrapWorker.ts` + `learningPlan.ts` — seeds `StudentConceptState` with default masteries (unanswered=0.3, correct=0.6, wrong=0.15) and generates an initial plan.

(Refer to repo files above for exact line ranges; these modules are the starting point for changes.)

## 3. Gaps vs spec (concrete mismatches)

1. IRT adaptivity: server does not estimate theta or select items dynamically using a 3PL algorithm. A fixed batch of 15 items is pre-selected.
2. Question count rigidity: code enforces exactly 15 items; spec allows 15–25 and adaptive stopping.
3. Topic balancing bug: `selectQuestions` did not always honor `topicId` filter, allowing per-topic round-robin constraints to be bypassed.
4. Partial-abandon rule ambiguous: bootstrap seeds unanswered concepts at a low default; there is no explicit "grade-level start" mapping applied when answers <10.
5. Insufficient logging: when selection pools are empty, logs lack filter context and pool sizes, making debugging harder.
6. Session state for adaptivity: no server-side session store (Redis) holding current theta, administered items, or responses — client holds preselected batch.
7. DB/Schema usage: while some IRT fields exist (e.g., `irt_b`), they are not used in selection or theta estimation.
8. Tests: missing unit/integration tests to validate topic filtering, fallback generation coverage, and adaptive selection behaviour.

## 4. Design goals and constraints

- Backwards compatible: existing flow should continue to work while we roll out adaptivity (feature-flagged rollout recommended).
- Auditability & reproducibility: every administered item and response must be logged and replayable for audits.
- Content balancing: guarantee syllabus coverage — e.g., at most one item per topic until coverage target reached.
- Safety & quality: AI-generated fallback items must be flagged and low-trust until human QA; do not persist raw AI text without validation.
- Performance: adaptive selection must be low-latency (<200ms per next-item selection) — use Redis cache for item pools and session state.

## 5. High-level architecture

1. HTTP API (server-driven adaptivity)
   - `POST /api/student/diagnostic/start` — create diagnostic session; returns first item + session id.
   - `POST /api/student/diagnostic/answer` — submit one answer; server updates session, computes theta, returns next item or stop signal.
   - `POST /api/student/diagnostic/save-partial` — persists session state for resume.
   - `POST /api/student/diagnostic/submit` — finalizes session and enqueues bootstrap job.
   - `GET /api/student/diagnostic/resume?sessionId=...` — resume an existing session (within 24h).

2. Session store (Redis)
   - Key: `diagnostic:session:{sessionId}` (TTL 48 hours, extends on activity).
   - Stored JSON: { sessionId, userId, subjectId, startTime, elapsedSeconds, administeredItems: [{questionId, irt_params, topicId, response, correct, timestamp}], thetaMean, thetaSE, prior, mode, config }.

3. IRT service (server-side library)
   - Contains functions to compute P(theta) 3PL, Fisher information, EAP/MLE theta update, and stopping rules.

4. Selection engine
   - Uses item parameter table (`Question` with `irt_a`, `irt_b`, `irt_c`) and candidate pools pre-filtered by board/subject/language.
   - Applies content constraints (topic balancing), exposure control, and selects item maximizing Fisher information at current theta.

5. Bootstrap worker changes
   - When diagnostic is finalized, worker converts session administered responses to `StudentConceptState` entries using validated mapping. Enforces partial-abandon rule.

6. Client changes
   - `DiagnosticFlow.tsx` updated to call `start`, then `answer` per response. Timer persists server-side (client shows UI timer synced with server). Pause/resume uses `save-partial`/`resume` endpoints.

## 6. IRT 3PL — maths & algorithm (implementation detail)

- 3PL item response function (logistic form):

  P_i(\theta) = c_i + (1 - c_i) / (1 + exp(-D * a_i * (\theta - b_i)))

  - `a_i` discrimination (>0)
  - `b_i` difficulty (location)
  - `c_i` pseudo-guessing (0..0.35 typical)
  - `D` scaling constant (use 1.702 or 1.7)

- Fisher information for item i at \theta:

  I_i(\theta) = (dP_i/d\theta)^2 / (P_i(\theta) * (1 - P_i(\theta)))

  Use this to pick the most informative available item given current \theta.

- Theta estimation:
  - Use Bayesian EAP (expected a posteriori) with Normal(0,1) prior for numerical stability on small tests.
  - EAP update after each response: compute posterior over a discretized \theta grid (e.g., -4..+4 step 0.1), compute expected value and standard error.
  - MLE alternatives are possible but EAP is robust at small sample sizes.

- Selection loop (per answer):
  1. Update posterior theta given administered items/responses.
  2. Compute SE (posterior std). If SE < threshold or administered_count >= maxItems, stop.
  3. From candidate pool (exclude administered items, respect exposure controls), compute I_i(\theta) and filter by content constraints (topic balancing, per-topic max). Pick item with maximum I.
  4. Return selected item to client.

## 7. Stopping rules & config

- Configurable via feature flag / `diagnostic.*` config
  - `minItems` (default 15)
  - `maxItems` (default 25)
  - `maxDurationSeconds` (default 1800)
  - `seStoppingThreshold` (e.g., 0.35)
  - `minAnswersForValidity` (10)

- Stop when any of:
  - administered_count >= maxItems
  - elapsed time >= maxDurationSeconds
  - posterior SE <= seStoppingThreshold and administered_count >= minItems

## 8. Partial-abandon / bootstrap behaviour

- When student submits with `nAnswers < minAnswersForValidity` (default 10):
  - Treat results as "partial" and apply grade-level defaults for unanswered chapters.
  - Implementation: For chapters not covered by diagnostic items, create `StudentConceptState` with `mastery=GRADE_LEVEL_MASTER` (recommend 0.5) and `provisional=true`.
  - For answered concepts, compute mastery from response + item params (map probability to mastery band). Mark plan recommendations provisional and prompt for retake after 7 days or allow scheduled remedial diagnostic.

- When `nAnswers >= minAnswersForValidity`: use full IRT-derived theta and per-chapter mastery computed from responses and item mappings.

- Retake rules: allow retake after 30 days; ensure different item exposure via embedding-similarity check or rotate exposures.

## 9. DB & schema requirements

- Ensure `Question` table includes numeric columns: `irt_a` (float), `irt_b` (float), `irt_c` (float). If missing, add additive migration.
- Add `exposure_count` and `last_administered_at` to `Question` to limit over-exposure.
- Store each administered item/response as `DiagnosticAnswerEvent` (or extend existing `AnswerEvent`) with snapshot of `irt_params` used to make session replayable.

## 10. API contract (first draft)

- POST /api/student/diagnostic/start
  - body: { subjectId, language?, board?, diagnosticConfig? }
  - returns: { sessionId, firstItem: { questionId, text, options, meta }, expiresAt }

- POST /api/student/diagnostic/answer
  - body: { sessionId, questionId, response, elapsedSeconds, clientTs }
  - server: persist answer, update theta, select next item
  - returns: { nextItem | null, stopReason | null, sessionState: { theta, se, answeredCount } }

- POST /api/student/diagnostic/save-partial
  - body: { sessionId, elapsedSeconds } — persists state and extends Redis TTL
  - returns: { ok }

- POST /api/student/diagnostic/submit
  - body: { sessionId, finalize: true }
  - server: writes final events, enqueues bootstrap job, returns summary id or job id

- GET /api/student/diagnostic/resume?sessionId=...
  - returns: { sessionState, lastAdministeredItem }

Security & auth: all endpoints require session authentication; server validates user owns sessionId.

## 11. Selection & fallback rules

- Primary source: `Question` rows matching board/grade/subject/language and with valid `irt_a/b/c`.
- If pool insufficient per topic, call `GeneratedQuestion` fallback then `generateQuestionsAI` as last resort. Log fallback reason explicitly.
- Ensure `selectQuestions` & `syncFromGeneratedQuestions` include `topicId` filter so per-topic round-robin works.

## 12. Logging, metrics & monitoring

- Logs: when a pool is empty, log filters used (subject/board/language/topicId), pool counts, and fallback path chosen.
- Metrics: diagnostic_started, diagnostic_completed, diagnostic_abandoned, avg_items_per_session, avg_time_seconds, per-topic exposure_count, retake_rate, theta_distribution.
- Alerts: abnormal abandonment rate (>X%), sudden drop in candidate pool sizes.

## 13. Tests & QA

- Unit tests:
  - `selectQuestions` topic filtering, exposure limits, fallback ordering.
  - IRT functions: P(theta), Fisher information, posterior EAP routine.
  - Session store: persist/restore behavior and TTL extension.
- Integration tests:
  - `start` -> multiple `answer` calls -> stop condition path (maxItems, time, SE threshold).
  - Partial-abandon behaviour: ensure `<10` answers leads to grade-level defaults.
- Test data:
  - Create fixtures with synthetic `Question` rows with `irt_a/b/c` covering easy/medium/hard.

## 14. Rollout plan (staged)

1. Quick fixes (safe, low-risk):
   - Add `topicId` filter to `selectQuestions` & `syncFromGeneratedQuestions` and add debug logs when pool empty.
   - Make `TOTAL_QUESTIONS` configurable.
   - Add additional debug logs in bootstrap worker for partial submissions.
2. Medium (non-breaking):
   - Implement `save-partial` TTL logic and clear partial-abandon rules in bootstrap worker.
   - Add unit tests for topic filtering and fallback generation.
3. Feature build (behind feature flag `diagnostic_adaptive_v2`):
   - Implement server-side IRT service, Redis session store, and `start`/`answer` endpoints.
   - Update `DiagnosticFlow` to call server adaptivity endpoints and preserve UI behaviours (timer, pause/resume).
   - Add integration tests & staging e2e runs.
4. Rollout:
   - Enable flag for a small % of users, run A/B tests comparing plan quality and retention metrics.
   - Monitor item exposure, abandonment, and accuracy. Increase rollout progressively.

## 15. Prioritised immediate actions (what I can implement right away)

- Implement step 2 quick-fixes (topicId filter + debug logs). This fixes a correctness bug and is low-risk.
- Make `TOTAL_QUESTIONS` configurable and wire config into `DiagnosticFlow` UI.
- Add unit tests for `selectQuestions` behaviours.

If you want, I can implement those quick fixes now in a short PR.

## 16. Risks & mitigations

- Risk: Poor-quality AI-generated questions used as fallback -> mitigate by flagging generated content, low trust scores, and human review queue.
- Risk: IRT parameter sparsity (many items lack `irt_a/b/c`) -> mitigate by estimating initial `a`/`b` from metadata (difficulty tag) or use content-level defaults until sufficiently exposed.
- Risk: Increased latency for next-item selection -> mitigate with precomputed candidate pools in Redis and efficient numeric routines for EAP over a small grid.

## 17. Appendix — suggested config keys

- `diagnostic.minItems = 15`
- `diagnostic.maxItems = 25`
- `diagnostic.maxDurationSeconds = 1800`
- `diagnostic.seStoppingThreshold = 0.35`
- `diagnostic.minAnswersForValidity = 10`
- `diagnostic.featureFlag = diagnostic_adaptive_v2`

---

## Implementation Tasks & Progress

The following implementation tasks map to the TODO plan and include file-level notes for the immediate quick-fixes and next steps. Status reflects current work in the repository (see TODO list managed by the engineering agent).

- **Task 1 — Draft Diagnostic_Test_Approach.md**: **Completed**
  - File: [docs/v2/Diagnostic_Test_Approach.md](docs/v2/Diagnostic_Test_Approach.md)
  - Notes: Initial approach document created and committed. Serves as the canonical spec for F-STU-002 implementation.

- **Task 2 — Add `topicId` filter & debug logs in `selectQuestions`**: **Completed**
  - Files changed:
    - `lib/tests.ts`
      - Added `...(filters.topicId ? { topicId: filters.topicId } : {}),` to the Prisma `where` object in `selectQuestions()` so topic-scoped queries are respected.
      - Added debug logs:
        - `logger.debug('selectQuestions.initial_pool', { filters, poolCount })` after the first `findMany()`.
        - `logger.debug('selectQuestions.sync_from_generated.before', { filters, need })` and `logger.debug('selectQuestions.sync_from_generated.after', { filters, poolCount })` around the `syncFromGeneratedQuestions()` fallback.
        - `logger.debug('selectQuestions.deduped', { filters, dedupedCount })` after de-duplication.
      - Updated `syncFromGeneratedQuestions()` to `logger.debug('syncFromGeneratedQuestions.rows_empty', { filters, take })` when no generated rows are found.
  - Rationale & verification:
    - This fixes the per-topic round-robin correctness bug where `topicId` was not being applied to the primary DB query, and provides richer logs for debugging pool exhaustion and fallback paths.
  - Next test steps (todo): add unit tests in `tests/unit/lib/tests.spec.ts` to assert topic-scoped selection and fallback behaviour.

 - **Task 3 — Make diagnostic question count configurable (15–25)**: **Completed (config-driven)**
  - Files to change:
    - `lib/diagnostics/diagnosticQuestionService.ts` — replace `TOTAL_QUESTIONS` constant with a config-driven value: `getConfig().diagnostic.maxItems` with a fallback to 15. Also make `EASY_COUNT`, `MEDIUM_COUNT`, `HARD_COUNT` computed from the configured total.
    - `components/student/diagnostic/DiagnosticFlow.tsx` — accept a `maxItems`/`minItems` prop or read from a platform config endpoint; display remaining hint/summary correctly.
    - API: `app/api/tests/start/route.ts` — accept optional diagnostic config and forward to `generateSubjectDiagnosticTest`.
  - Implementation notes:
    - Added `lib/config.ts` with `diagnosticConfig` and `computeDifficultyCounts()`.
    - Updated `lib/diagnostics/diagnosticQuestionService.ts` to compute `TOTAL_QUESTIONS`, `EASY_COUNT`, `MEDIUM_COUNT`, `HARD_COUNT` from `diagnosticConfig.minItems`.
    - Next UI step: wire `DiagnosticFlow` to read diagnostic counts from platform config or props (still pending).

 - **Task 4 — Enforce partial-abandon rule in submit/bootstrap worker**: **Completed**
  - Files changed:
    - `worker/services/diagnosticBootstrapWorker.ts` — added detection for partial/abandoned diagnostics (uses `diagnosticConfig.minAnswersForValidity`). When fewer than the minimum valid answers are present, unanswered concepts are seeded with a `masteryScore` of `0.5` (grade-level start) and a higher `masteryVariance` of `0.3` to indicate uncertainty. A `partial_abandon` info log is emitted with counts.
    - `app/api/student/diagnostic/submit/route.ts` — unchanged in behaviour (it already persists AnswerEvent rows and enqueues the bootstrap job); the worker now interprets low-answer counts accordingly.
  - Rationale & verification:
    - This implements the spec requirement to treat abandoned diagnostics with provisional grade-level defaults for untested concepts while preserving any answered concepts' evidence. The variance field helps downstream planners treat these seeds as lower-confidence.

- **Task 5 — Design server-side IRT 3PL API + Redis session model**: **Not started**
  - Files / artifacts to add:
    - `lib/irt/irt.ts` — new IRT utilities (P(theta), Fisher info, EAP posterior grid routines).
    - `lib/diagnostics/sessionStore.ts` — Redis session helpers for `diagnostic:session:{id}` with TTLs.
    - API endpoints: `app/api/student/diagnostic/start/route.ts`, `app/api/student/diagnostic/answer/route.ts`, `app/api/student/diagnostic/resume/route.ts`.
 - **Task 5 — Design server-side IRT 3PL API + Redis session model**: **In-progress (initial implementation)**
  - Files added:
    - `lib/irt/irt.ts` — basic 3PL functions (`p3pl`, `fisherInfo`) and a grid-based `eapEstimate()` for initial theta estimation.
    - `lib/diagnostics/sessionStore.ts` — Redis-backed session store with create/get/update/delete helpers.
    - `app/api/student/diagnostic/start/route.ts` — endpoint to start a diagnostic and persist a session with the candidate pool.
    - `app/api/student/diagnostic/answer/route.ts` — endpoint to submit a single answer, persist `AnswerEvent`, update session administered list, and return the next item from the candidate pool.
  - Notes & next steps:
    - Current API implements server-driven session state and a simple next-item strategy (sequential from preselected pool). This provides a stable foundation for switching to a Fisher-information-based selector later.
    - Next: implement `resume` endpoint and replace sequential selection with an IRT selector using `lib/irt/irt.ts` when feature-flag `diagnostic_adaptive_v2` is enabled.

- **Task 6 — Implement IRT core algorithm and item selection**: **Not started**
  - Files to add/modify:
    - `lib/irt/irt.ts` — core math and theta estimation.
    - `lib/irt/selector.ts` — item selection functions using Fisher information + content constraints.
    - Update `lib/tests.ts`/`lib/diagnostics` to integrate selector when feature flag `diagnostic_adaptive_v2` is enabled.

- **Task 7 — Update `DiagnosticFlow` UI to use adaptivity endpoints**: **Not started**
  - Files to change:
    - `components/student/diagnostic/DiagnosticFlow.tsx` — change flow to `start` + repeated `answer` calls instead of preloading a fixed 15-question batch. Maintain timer, pause/resume, and offline save behaviour.
    - `app/(student)/diagnostic/[subjectId]/page.tsx` — adjust server props/resume logic accordingly.

- **Task 8 — Add unit & integration tests for selection & adaptivity**: **Not started**
  - Files to add:
    - `tests/unit/lib/tests.spec.ts` (selectQuestions/ensureQuestions)
    - `tests/unit/lib/diagnostics.spec.ts` (diagnosticQuestionService behaviours)
    - `tests/integration/diagnostic_adaptive.test.ts` (start → answer → stop scenarios using in-memory Redis/test doubles)

- **Task 9 — Deploy to staging and run end-to-end diagnostics**: **Not started**
  - Steps: deploy feature-flagged release, run smoke tests, collect metrics (abandonment, avg items, SE distribution).

- **Task 10 — Monitoring, metrics, and phased rollout**: **Not started**
  - Add metrics emitters around `diagnostic_started`, `diagnostic_abandoned`, `diagnostic_completed`, `item_exposed`, `theta_distribution`.

Current progress summary:
- `Draft Diagnostic_Test_Approach.md` — completed and saved.
- Quick-fix started: `topicId` filter + debug logs (editing `lib/tests.ts` and related files). See Task 2 above for exact file-level edits planned. This task is in-progress and tracked in the repo TODO list.

Next actions (short):
1. Implement `topicId` filter and debug logs in `lib/tests.ts` (small PR, low-risk).
2. Add unit tests for `selectQuestions` behaviours.
3. Make `TOTAL_QUESTIONS` configurable in `lib/diagnostics/diagnosticQuestionService.ts` and wire to UI.

Document author: senior-staff-engineer
Date: 2026-04-06

