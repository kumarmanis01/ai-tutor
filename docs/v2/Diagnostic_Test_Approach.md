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

  P_i(\theta) = c_i + (1 - c_i) / (1 + exp(-D _ a_i _ (\theta - b_i)))
  - `a_i` discrimination (>0)
  - `b_i` difficulty (location)
  - `c_i` pseudo-guessing (0..0.35 typical)
  - `D` scaling constant (use 1.702 or 1.7)

- Fisher information for item i at \theta:

  I_i(\theta) = (dP_i/d\theta)^2 / (P_i(\theta) \* (1 - P_i(\theta)))

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

Tasks are ordered by priority: HIGH (blocks AC marked MUST) → MEDIUM → LOW.
Status key: ✅ Completed | 🔄 In-progress | ⏳ Pending

---

### Previously completed tasks

- **Task 1 — Draft Diagnostic_Test_Approach.md**: ✅ Completed
  - File: `docs/v2/Diagnostic_Test_Approach.md`

- **Task 2 — Add `topicId` filter & debug logs in `selectQuestions`**: ✅ Completed
  - Files: `lib/tests.ts`
  - Added `topicId` filter to Prisma `where` clause in `selectQuestions()` and `syncFromGeneratedQuestions()`.
  - Added debug logs at pool query, fallback sync, and dedup stages.

- **Task 3 — Add `lib/config.ts` with `diagnosticConfig`**: ✅ Completed
  - File: `lib/config.ts` — added `diagnosticConfig`, `featureFlags`, `computeDifficultyCounts()`.
  - Note: `diagnosticQuestionService.ts` still uses hardcoded counts — fixed in G3 below.

- **Task 4 — Enforce partial-abandon rule in bootstrap worker**: ✅ Completed
  - File: `worker/services/diagnosticBootstrapWorker.ts`
  - Seeds unanswered concepts with mastery 0.5 + variance 0.3 when answers < minAnswersForValidity.

- **Task 5 — Server-side IRT API + Redis session model (initial)**: ✅ Completed
  - Files added: `lib/irt/irt.ts`, `lib/diagnostics/sessionStore.ts`, `lib/diagnostics/selector.ts`
  - API routes added: `start/route.ts`, `answer/route.ts`, `resume/route.ts`, `save-partial/route.ts`
  - Implements basic session state + sequential-with-IRT-fallback next-item strategy.

---

### Gap-fix tasks (gap analysis 2026-04-06)

---

#### HIGH priority

- **G1 — Fix DiagnosticFlow.tsx quiz-phase bug (uses `questions` prop instead of `questionList` state)**: ⏳ Pending
  - **Spec link**: AC-02 — adaptive flow is completely broken in adaptive mode without this fix.
  - **Bug**: In the quiz render block, `questions[currentIndex]`, `questions.length` (for `progressPct` and `isLast`), `computeChapterResults(questions, ...)`, and the `recordAnswer` useCallback dependency all reference the original `questions` prop. In adaptive mode the prop is an empty array (`[]`), so `currentQuestion` is `undefined` and the component returns `null` (blank screen) immediately after the first question is appended to `questionList` state.
  - Files to change:
    - `components/student/diagnostic/DiagnosticFlow.tsx`
      - Replace `questions[currentIndex]` with `questionList[currentIndex]` in the quiz render.
      - Replace `questions.length` with `questionList.length` for `progressPct` and `isLast`.
      - Replace `computeChapterResults(questions, ...)` with `computeChapterResults(questionList, ...)` in `submitDiagnostic`.
      - Fix `recordAnswer` useCallback dependency: replace `questions` with `questionList`.
      - Add `totalExpected` state (set from `totalQuestions` in start API response) to drive the `of ~N` counter correctly in adaptive mode.
  - Implementation summary: Fixed. Changed `isAdaptiveMode` to use stable `questions` prop (not `questionList` state) so flag stays `true` throughout the session. Added `totalExpected` state set from `totalQuestions` in start API response. Fixed `currentQuestion`, `progressPct`, `isLast`, `computeChapterResults`, and `recordAnswer` useCallback dependency to all reference `questionList` state instead of `questions` prop.

- **G2 — Fix `answer/route.ts` conceptId always-undefined bug**: ✅ Completed
  - **Spec link**: AC-09 — AnswerEvents without a conceptId break the bootstrap worker's ability to seed the knowledge graph.
  - **Bug**: `answer/route.ts` line contains `conceptId: question.topicId ? undefined : undefined` — both branches are `undefined`, so every AnswerEvent written via this route has no conceptId. The submit route resolves conceptId correctly; the answer route must do the same.
  - Files changed: `app/api/student/diagnostic/answer/route.ts` — added `prisma.concept.findFirst({ where: { topicId: question.topicId } })` resolution; conditionally spreads `conceptId` into the `AnswerEvent.create` data.
  - Implementation summary: Fixed. Added topicId -> conceptId resolution in the answer route using the same pattern as the submit route. conceptId is now conditionally included in AnswerEvent data.

- **G3 — Wire `diagnosticConfig` into `diagnosticQuestionService.ts` (hardcoded counts)**: ⏳ Pending
  - **Spec link**: AC-02 — service must generate 15–25 items driven by config, not hardcoded 15.
  - **Bug**: `diagnosticQuestionService.ts` still has `const TOTAL_QUESTIONS = 15`, `EASY_COUNT = 6`, `MEDIUM_COUNT = 6`, `HARD_COUNT = 3` as hardcoded constants despite Task 3 marking config as complete.
  - Files to change:
    - `lib/diagnostics/diagnosticQuestionService.ts` — import `diagnosticConfig` and `computeDifficultyCounts` from `lib/config.ts`; replace the four constants with config-driven values.
  - Implementation summary: Fixed. Replaced the four hardcoded module-level constants with `const { totalItems: TOTAL_QUESTIONS, easy: EASY_COUNT, medium: MEDIUM_COUNT, hard: HARD_COUNT } = computeDifficultyCounts(diagnosticConfig.minItems)`. Values now respect DIAGNOSTIC_MIN_ITEMS env var.

- **G4 — Wire diagnostic status transitions (`stateStore`) in start/submit routes**: ✅ Completed
  - **Spec link**: AC-01 — mandatory gate cannot function if status never transitions from `pending` to `in_progress` to `completed`.
  - Files changed: `app/api/student/diagnostic/start/route.ts` — calls `upsertSubjectDiagnosticStatus` with `in_progress` after session creation. `app/api/student/diagnostic/submit/route.ts` — calls it with `completed` + `completedAt` after AnswerEvents are persisted.
  - Implementation summary: Fixed. Status lifecycle now: pending → in_progress (on start) → completed (on submit). The mandatory gate can now correctly unlock after completion.

- **G5 — Add IRT stopping rules in `answer/route.ts` + return `stopReason` and `thetaState`**: ⏳ Pending
  - **Spec link**: AC-02 — adaptive stop (SE threshold, maxItems, time cap) is a MUST behaviour.
  - **Gap**: `answer/route.ts` never checks stopping criteria. The diagnostic runs until the candidate pool is exhausted regardless of SE or item count. `stopReason` and theta/SE are absent from the response.
  - Files to change:
    - `app/api/student/diagnostic/answer/route.ts`
      - After updating the administered list, compute `eapEstimate` over administered items.
      - Check stop conditions: `administered.length >= maxItems` OR `se <= seStoppingThreshold && administered.length >= minItems`.
      - Return `{ nextQuestion: null, stopReason: 'max_items' | 'se_threshold' | 'pool_exhausted', thetaState: { theta, se, answeredCount } }` when stopping.
      - Only select next question when not stopping.
    - `lib/diagnostics/selector.ts` — export `computeTheta(session)` so the route can reuse it without duplicating EAP logic.
  - Implementation summary: Fixed. After updating administered list, `answer/route.ts` calls `computeSessionTheta` (exported from selector.ts), checks `administered >= maxItems` and `se <= seStoppingThreshold && administered >= minItems`. Returns `{ nextQuestion: null, stopReason, thetaState }` when stopping. `computeSessionTheta` extracted as a separate export in `selector.ts` to avoid duplication. `selectNextQuestion` now uses parallel DB fetches for candidates and administered items.

- **G6 — Implement grade-level placement (theta bands) in API response and `KnowledgeMapResults`**: ✅ Completed
  - **Spec link**: AC-05 — "Grade-level placement (below / at / above grade)" is a MUST output.
  - Files changed: `lib/irt/irt.ts` — added `thetaToPlacement(theta)` with thresholds `< -0.5 = below`, `> 0.5 = above`, else `at`. `submit/route.ts` — reads adaptive session from Redis, computes theta, maps to placement, returns `{ placement }` in response. `DiagnosticFlow.tsx` — stores `placement` state from submit response; passes to `KnowledgeMapResults`. `KnowledgeMapResults` — new `placementBanner()` helper renders a branded colour banner (Danger/Warning/Success) above the chapter list.
  - Implementation summary: Complete AC-05 output. Below = #E24B4A (red bg), At = #BA7517 (amber bg), Above = #1D9E75 (green bg). Falls back to 'at' when no adaptive session exists.

---

#### MEDIUM priority

- **G7 — Implement 24h auto-submit via BullMQ delayed job**: ⏳ Pending
  - **Spec link**: AC-04 — "After 24 hours the partial diagnostic is auto-submitted" is a MUST.
  - **Gap**: `diagnosticPartial.ts` sets a 24h Redis TTL so data silently expires. No job fires to submit-and-bootstrap before expiry.
  - Files to change:
    - `jobs/diagnosticAutoSubmit.ts` (new) — BullMQ job definition for `diagnostic-auto-submit`; logic mirrors submit route: write AnswerEvents from partial state, enqueue bootstrap job.
    - `app/api/student/diagnostic/save-partial/route.ts` — after saving partial state, enqueue a delayed `diagnostic-auto-submit` job with `delay: 24 * 60 * 60 * 1000`, keyed on `${userId}:${subjectId}` so duplicate saves replace the earlier job.
    - `app/api/student/diagnostic/submit/route.ts` — on successful manual submit, remove any pending auto-submit job for the same key.
  - Implementation summary: Implemented. New files: `jobs/diagnosticAutoSubmit.ts` (Queue + enqueue/cancel helpers using stable jobId `auto-submit:{userId}:{subjectId}`), `worker/services/diagnosticAutoSubmitWorker.ts` (reads partial state, writes AnswerEvents, enqueues bootstrap, marks completed). `save-partial/route.ts` enqueues delayed job (24h). `submit/route.ts` cancels it on manual submit. Worker registered in `worker/bootstrap.ts` with shutdown handling.

- **G8 — Add `irt_a` and `irt_c` columns to `Question` schema (additive migration)**: ✅ Completed
  - **Spec link**: §9 of approach doc — selector was hard-defaulting `a=1.0, c=0.2` because columns were absent.
  - Files changed: `prisma/schema.prisma` — added `irt_a Float?` and `irt_c Float?` to `Question` model with inline comments. Migration `prisma/migrations/20260407000000_add_question_irt_a_c/migration.sql` — additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. `lib/diagnostics/selector.ts` — `QuestionRow` type updated; all three `findMany` selects include `irt_a, irt_c`; item construction uses `r.irt_a ?? defaultA()` and `r.irt_c ?? defaultC()`.
  - Implementation summary: Additive only -- no data loss. Existing rows have NULL a/c and fall back to defaults. New items can be seeded with calibrated values.

---

#### LOW priority

- **G9 — Rapid-fire detection for retake gaming (AC-08)**: ⏳ Pending
  - **Spec link**: AC-08 (SHOULD) — "rapid-fire answers flagged".
  - **Design**: Flag answers where `timeSpentMs < 3000` ms (3 seconds). If more than 30% of answers in a session are rapid-fire, mark the session result as `flagged_gaming` in the bootstrap job payload; do not void results, but log for review.
  - Files to change:
    - `app/api/student/diagnostic/answer/route.ts` — check `timeSpentMs < RAPID_FIRE_THRESHOLD_MS (3000)`; if so, include `rapidFire: true` in the administered entry stored in session.
    - `app/api/student/diagnostic/submit/route.ts` — after collecting answers, compute `rapidFireRatio = rapidFireCount / totalAnswers`; if `> 0.3`, include `gamingFlag: true` in the bootstrap job payload and log a warning.
    - `lib/config.ts` — add `rapidFireThresholdMs: 3000` to `diagnosticConfig`.
  - Implementation summary: Implemented. `diagnosticConfig` gains `rapidFireThresholdMs` (3000ms) and `rapidFireRatioThreshold` (0.3). `answer/route.ts` sets `rapidFire: true` on administered entries where `timeSpentMs < rapidFireThresholdMs`. `DiagnosticSessionPayload` type updated to include `rapidFire?` field. `submit/route.ts` computes `rapidFireRatio`; logs a warning with context when `> 30%` of answers are rapid-fire.

---

### Remaining original tasks (infrastructure/quality)

- **Task 6 — Unit & integration tests for IRT selection & adaptivity**: ⏳ Pending
  - `tests/unit/lib/tests.spec.ts`, `tests/unit/lib/diagnostics.spec.ts`, `tests/integration/diagnostic_adaptive.test.ts`

- **Task 7 — Deploy to staging + end-to-end smoke tests**: ⏳ Pending

- **Task 8 — Monitoring, metrics, and phased rollout**: ⏳ Pending
  - Metrics: `diagnostic_started`, `diagnostic_abandoned`, `diagnostic_completed`, `item_exposed`, `theta_distribution`.

---

Document author: senior-staff-engineer
Last updated: 2026-04-06
