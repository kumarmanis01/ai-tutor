AI HOME TUTOR PLATFORM
Pre‑Launch Gap Analysis & Execution Plan
v1 (What Exists) vs v2 Spec (What's Required)

---

### 0. Framing

**Goal**: Identify only the gaps that block a **paying student** from having a **safe, functional, non‑embarrassing** experience with the AI Tutor and student product, and map them to a concrete **Week 1–8 execution plan** on the current v1 codebase.

**Legend**

- 🔴 **BLOCKER** — Cannot go live without this. Legal, safety, or core product failure.
- 🟠 **CRITICAL** — Severe UX degradation. Students will churn in first week.
- 🟡 **IMPORTANT** — Notable quality gap. Acceptable at launch only if mitigated.
- 🟢 **DEFER** — Real gap but genuinely post‑launch. Does not affect first 1K users.

**Role Tags** (assigned per ticket in the execution plan)

- 🗄️ **DB** — Prisma schema, migrations, seed data, SQL
- ⚙️ **BE** — API routes, service layer, business logic, middleware
- 🔁 **WORKER** — BullMQ workers, scheduled jobs, background processing
- 🧠 **AI** — Prompt assembly, LLM orchestration, RAG, IRT, state machine, pure AI logic
- 🔴 **SAFETY** — PII, jailbreak detection, distress detection, output filtering
- 🎨 **FE** — React components, Tailwind, client state, SSE streaming
- 🔧 **INFRA** — Redis config, CI/CD, feature flags, cost monitoring, deployment
- 📋 **CONTENT** — Seed data requiring domain/subject matter expertise
- 👤 **HUMAN** — Requires a human reviewer (counsellor, subject expert, legal)

---

### DOMAIN 1 — AI TUTOR ENGINE

#### 1.1 Teaching Engine & Session State Machine

| Area                               | v1 State                                                                                                                                        | v2 Requires                                                                                                                                                                                    | Severity     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Per‑turn AI teaching loop          | No dedicated AI loop in sessions. Content engine generates notes/questions in workers only. Sessions consume pre‑generated content.             | `POST /api/tutor/turn` — full per‑turn Socratic dialogue engine backed by orchestrator and state machine.                                                                                      | 🔴 BLOCKER   |
| 7‑stage pedagogical state machine  | 5‑phase session shell (`OVERVIEW` / `EXPLANATION` / `PRACTICE` / `TEST` / `HOMEWORK`). No per‑turn stage transitions. No machine‑readable tags. | Hook → Prerequisite Bridge → Core Explanation → Worked Example → Guided Practice → Independent Practice → Consolidation. Tag‑driven transitions only.                                          | 🔴 BLOCKER   |
| Redis session state per turn       | DB is source of truth (`StructuredSession`). Redis not used for per‑turn pedagogy.                                                              | Redis session state written synchronously on every turn. Full `RedisSessionState` schema. 24h TTL.                                                                                             | 🔴 BLOCKER   |
| Socratic dialogue rules            | AI behaves as chatbot/enhanced tutor. No hard contracts enforced.                                                                               | One question per turn. Never direct answers to practice problems. Partial‑credit acknowledgement. "I don't know" pivots to prerequisite probes. Enforced via `PEDAGOGICAL_RULES` prompt layer. | 🔴 BLOCKER   |
| Machine‑readable tag system        | Does not exist.                                                                                                                                 | All 7 tags: `[QUESTION]`, `[VALIDATE]`, `[HINT_OFFER]`, `[STAGE_ADVANCE]`, `[PREREQ_FAIL]`, `[STRUGGLE_DETECTED]`, `[MASTERY_CONFIRMED]`. Parser strips tag before delivery to student.        | 🔴 BLOCKER   |
| 3‑tier hint system                 | No structured hint system.                                                                                                                      | Tier 1 (directional nudge) → Tier 2 (structural hint) → Tier 3 (worked scaffold). Explicit student request. 90s inactivity prompt. Hint counter visible.                                       | 🟠 CRITICAL  |
| Prerequisite remediation sub‑flow  | No prerequisite‑triggered remediation.                                                                                                          | Two failed exits at same stage → `[PREREQ_FAIL]` → short remediation loop on prerequisites → return to failed stage.                                                                           | 🟠 CRITICAL  |
| Misconception library (seeded)     | No misconception library or detection.                                                                                                          | Minimum 20 misconceptions per subject (CBSE 10 Maths + Science) with regex patterns and contrastive explanations. `StudentMisconception` table.                                                | 🟠 CRITICAL  |
| Frustration/fatigue signal scoring | Not implemented.                                                                                                                                | Weighted score over: consecutive errors, hints used, negative language, latency ratio. Threshold e.g. 0.60 → `FRUSTRATED` state. Response tone adaptation. Not visible to student.             | 🟡 IMPORTANT |
| Session summary compression        | Not implemented.                                                                                                                                | Every 10 turns: GPT‑4o-mini compresses all but last 8 turns into `sessionSummary`. Last 8 kept verbatim.                                                                                       | 🟡 IMPORTANT |
| Incomplete turn recovery           | Not implemented.                                                                                                                                | Redis state tracks `lastTurnStartedAt` + `lastTurnCompleted`. On session load, if `lastTurnCompleted = false` → roll back partial turn before resuming.                                        | 🔴 BLOCKER   |
| Concurrent session prevention      | Not implemented.                                                                                                                                | Redis key check on session start; second device sees "resume / view summary" but can't run parallel full sessions.                                                                             | 🟢 DEFER     |
| 90‑minute session cap              | Not implemented.                                                                                                                                | Hard 90‑min cap: AI ends session with summary + plan; further work starts a new session.                                                                                                       | 🟢 DEFER     |

#### 1.2 Prompt Assembly

| Area                    | v1 State                                                                     | v2 Requires                                                                                                                                                                    | Severity     |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 7‑layer prompt stack    | Basic subject system prompts. No layering or token budget.                   | PERSONA → SAFETY → PEDAGOGICAL_RULES → STUDENT_PROFILE → SESSION_STATE → CURRICULUM_CONTEXT → RESPONSE_FORMAT. Priority‑ordered truncation, 16K total, 4K reserved for output. | 🔴 BLOCKER   |
| PERSONA layer (Vidya)   | Subject‑specific "you are a tutor" prompts; no named persona or graded tone. | Vidya persona: tone by grade band; emphasise coaching (not answering); Indian‑context analogies; accepts code‑switching.                                                       | 🔴 BLOCKER   |
| PEDAGOGICAL_RULES layer | Absent as a fixed layer; only soft suggestions.                              | 7 non‑negotiable rules encoded as **never‑truncated** system prompt section.                                                                                                   | 🔴 BLOCKER   |
| STUDENT_PROFILE layer   | Not assembled per turn.                                                      | Inject: name, grade, board, exam date proximity, teaching language, learning style, recent misconceptions, basic mastery summary, emotional state.                             | 🔴 BLOCKER   |
| SESSION_STATE layer     | Not implemented.                                                             | Current stage, stage attempt count, hints used, last 8 turns (summary or raw), `sessionSummary`, active misconception, frustration score.                                      | 🔴 BLOCKER   |
| Token budget management | Not implemented.                                                             | Truncation policy: drop RAG chunks first, then oldest summary sentences; never truncate PERSONA/SAFETY/PEDAGOGICAL_RULES. 16K total throughout — do not use 12K figure.        | 🟠 CRITICAL  |
| Provider prefix caching | Not implemented.                                                             | Fixed layers identical across calls → rely on OpenAI prefix caching for 30–40% input token cost reduction.                                                                     | 🟡 IMPORTANT |

#### 1.3 Knowledge Graph & IRT

| Area                                      | v1 State                                                                                                       | v2 Requires                                                                                                                                                                   | Severity    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------- | ----------- |
| `StudentConceptState` table               | Only topic‑level (`StudentTopicMastery`, `StudentTopicProgress`).                                              | Per‑student, per‑concept state: `masteryScore`, `masteryVariance`, `theta`, `stability`, `retention`, `nextReviewAt`, `attemptCount`, `lastInteraction`.                      | 🔴 BLOCKER  |
| IRT theta update per answer               | Heuristic difficulty bands only.                                                                               | MAP estimation using 3PL logistic model per subject. Bounded `Δtheta ≤ 0.5`.                                                                                                  | 🔴 BLOCKER  |
| Knowledge graph bootstrap from diagnostic | Diagnostic outputs topic/chapter insights only.                                                                | On diagnostic completion → BullMQ job → `StudentConceptState` seeded for **all** concepts in subject (tested + untested).                                                     | 🔴 BLOCKER  |
| Concept taxonomy fields                   | Taxonomy exists; `irt_b`, bloom, prereqs, commonly-confused likely incomplete.                                 | Every concept for launch slice: `irt_b`, `bloomLevel`, `prerequisiteConceptIds[]`, `commonlyConfusedWithIds[]`, `description`.                                                | 🔴 BLOCKER  |
| `irt_b` on question bank                  | Questions exist but likely have no `irt_b` estimates. Without these, theta-based adaptive selection is random. | Manually assign `irt_b` for launch slice: recall = `-1.5 to -0.5`, single-step = `-0.5 to 0.5`, multi-step = `0.5 to 2.0`.                                                    | 🔴 BLOCKER  |
| Prerequisite graph edges                  | Not modelled.                                                                                                  | `prerequisiteConceptIds[]` drives: learning plan unlock, pre‑session warnings, `PREREQ_FAIL` remediation targets.                                                             | 🟠 CRITICAL |
| Adaptive question selection by theta      | Difficulty bands; not theta‑optimised.                                                                         | Target difficulty `b* = theta`; select questions with `                                                                                                                       | irt_b - b\* | < 0.3` and high Fisher Information. | 🟠 CRITICAL |
| Incremental graph update pipeline         | Not implemented.                                                                                               | Answer event → IRT update → mastery recompute → prereq cascade → retention update → Postgres write → Redis cache invalidation. All async via BullMQ, non-blocking to session. | 🟠 CRITICAL |
| SM‑18 spaced repetition                   | Not implemented.                                                                                               | For each concept: `R = e^(−t/S)`; if `R < 0.85` → due. Nightly scheduler populates revision queue and updates `nextReviewAt`.                                                 | 🟠 CRITICAL |

#### 1.4 RAG Pipeline

| Area                                   | v1 State                                                  | v2 Requires                                                                                                                                                                   | Severity     |
| -------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Curriculum chunks with `concept_ids[]` | Ingestion + pgvector exist; tagging completeness unknown. | Every content chunk tagged with `conceptIds[]` for launch slice. Verify with `SELECT COUNT(*) FROM chunks WHERE concept_ids IS NULL`.                                         | 🔴 BLOCKER   |
| Per‑turn RAG retrieval                 | Used primarily in content engine (notes/questions).       | Every teaching turn: embed concept context + summary → pgvector query → rerank by concept/board → top 4 chunks after reranking injected into `CURRICULUM_CONTEXT`.            | 🟠 CRITICAL  |
| `doubt_kb` table + pgvector            | Not implemented.                                          | `doubt_kb` table with embeddings; ivfflat index; similarity search used for repeated doubts. Basic doubt routing in Week 3; full pgvector cache in Week 5.                    | 🟠 CRITICAL  |
| `doubt_kb` write deduplication         | Not applicable.                                           | On write, run similarity search at threshold 0.88. If near-duplicate exists, update `timesServed` + `alternatePhrasings[]` instead of inserting. Prevents KB bloat over time. | 🟠 CRITICAL  |
| Explanation cache                      | Not implemented.                                          | Redis `cache:exp:{conceptId}:{lang}:{modality}`; 7‑day TTL; served for explanation‑style calls. Cache key must include `contentVersion` to invalidate on chunk updates.       | 🟡 IMPORTANT |
| Groundedness checking                  | Not implemented.                                          | Check factual claims against retrieved chunks; low‑groundedness responses logged to analytics.                                                                                | 🟡 IMPORTANT |

#### 1.5 LLM Router & Failover

| Area                                 | v1 State                                                  | v2 Requires                                                                                                                                                                         | Severity    |
| ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Multi‑tier model routing             | `callLLM.ts` routes models by `promptType` for content.   | `CallRouter` service with tiers by `callType` (teach/practice/diagnostic/eval/embed); centralised, not embedded in handlers.                                                        | 🟠 CRITICAL |
| Anthropic failover + circuit breaker | Not implemented.                                          | Redis‑backed breaker (not in-memory — PM2 cluster has multiple processes): 3 failures / 30s → circuit open; re‑probe after 60s; failover to Anthropic models.                       | 🟠 CRITICAL |
| `AITutorTurnLog` table               | `AIContentLog` exists for content; no per‑turn tutor log. | New table: `sessionId`, `callType`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `latencyMs`, `tag`, `stage`, `safetyFlagged`, `cached`, `ragChunksUsed`, `frustrationScore`. | 🟠 CRITICAL |

#### 1.6 Safety Layer

| Area                                               | v1 State                                        | v2 Requires                                                                                                                                                                                                     | Severity     |
| -------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| PII redaction                                      | Only profanity/offensive filters in some paths. | Redact Indian mobiles `\b[6-9]\d{9}\b`, emails, Aadhaar-style `\b\d{4}\s?\d{4}\s?\d{4}\b` before any LLM call. Regex pre-compiled at module load, not in hot path.                                              | 🔴 BLOCKER   |
| Jailbreak/prompt injection detection               | Not implemented.                                | Detect and immediately return safe refusal — do NOT call LLM, do NOT rewrite-and-continue. Log `safety_event`. Account flagged after 3 attempts.                                                                | 🔴 BLOCKER   |
| Emotional distress detection + parent notification | Not implemented.                                | Detect distress keywords/sentiment. Respond supportively. Log `safety_event`. Notify parent (email/SMS) within defined SLA. `ENABLE_DISTRESS_DETECTION` flag must be off until T43 (copy review) is signed off. | 🔴 BLOCKER   |
| Age‑appropriate output classifier                  | Not implemented.                                | Scan tutor output before delivery; block/regenerate unsafe NSFW/violent content; log safety event.                                                                                                              | 🔴 BLOCKER   |
| `safety_event` table                               | Not present.                                    | Table: `id`, `triggerType`, `sessionId`, `turnId`, `studentId`, `severity`, `createdAt`, `resolvedAt`, `resolution`.                                                                                            | 🟠 CRITICAL  |
| Distress notification when no parent linked        | Not applicable.                                 | If no verified parent mobile: silently skip notification, log event with `severity = CRITICAL` for admin review. Never fail the student-facing response.                                                        | 🟠 CRITICAL  |
| Jailbreak attempt counter                          | Not tracked.                                    | Count jailbreak attempts per student over last N days; threshold → soft suspension / admin review queue.                                                                                                        | 🟡 IMPORTANT |

---

### DOMAIN 2 — STUDENT ACTOR

#### 2.1 Onboarding & Gating

| Area                               | v1 State                                  | v2 Requires                                                                                                                                                                                                    | Severity    |
| ---------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Parent OTP enforcement (global)    | OTP routes exist; enforcement patchy.     | `accountStatus = PENDING_PARENT_VERIFY` blocks **all** learning routes until verified; overlay/banner everywhere in student shell.                                                                             | 🔴 BLOCKER  |
| Profile completeness gate (global) | Some routes guarded; inconsistent.        | Board + Grade + Medium + ≥1 subject mandatory before any learning features; overlay‑style gate to avoid redirect loops.                                                                                        | 🔴 BLOCKER  |
| Diagnostic hard gate per subject   | Some entrypoints enforce; not universal.  | At all session entrypoints: `hasDiagnosticForSubject()`; if no completed diagnostic → redirect to diagnostic start/resume.                                                                                     | 🔴 BLOCKER  |
| Grade immutability                 | Partially enforced on some APIs.          | Server‑side: strip `grade` from all student‑facing profile updates in `PATCH /api/student/profile` unconditionally; only admin/grade‑change requests can modify.                                               | 🟠 CRITICAL |
| `BoardSubjectConfig` seed          | Unknown completeness.                     | Core subjects flagged and seeded per board+grade; 6‑subject cap; locked core subjects. Must be seeded before onboarding subject picker is usable — without it the picker renders empty.                        | 🟠 CRITICAL |
| `concept.description`              | Likely incomplete/null for many concepts. | Non‑empty for **every** concept in launch slice. Null = broken prompt on every call. Verify with `SELECT COUNT(*) FROM concepts WHERE description IS NULL AND subjectId IN (...)` before any AI tutor testing. | 🔴 BLOCKER  |

#### 2.2 Learning Plan

| Area                                | v1 State                             | v2 Requires                                                                                                          | Severity     |
| ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| `LearningPlan` / `LearningPlanItem` | Not implemented.                     | Plan from diagnostic gaps + syllabus; weak‑first ordering; mandatory board topics locked; exam date drives duration. | 🟠 CRITICAL  |
| "Today's Plan" widget               | Driven by `getNextAction`, not plan. | `TodaysLearningCard` reads from `LearningPlanItem` (`weekNumber = currentWeek`, `status = UPCOMING`) as primary CTA. | 🟠 CRITICAL  |
| Weekly plan adjustment job          | Not implemented.                     | Sunday nightly BullMQ job adjusting plan based on completion; behind → weak chapters sooner, ahead → enrichment.     | 🟡 IMPORTANT |
| Exam date + weekly hours capture    | Not implemented.                     | Profile setup step capturing exam date or "no exam" and weekly hours; drives plan horizon and urgency.               | 🟠 CRITICAL  |

#### 2.3 Session Flow

| Area                             | v1 State                                | v2 Requires                                                                                                                                                                                                          | Severity    |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Pre‑session prerequisites screen | Not implemented.                        | Pre‑session modal: topic, estimated duration, prerequisite mastery; unmet prereqs show amber warnings with "Study Prerequisite First" / "Continue Anyway".                                                           | 🟠 CRITICAL |
| Interrupted session handling     | Not implemented.                        | On entry when incomplete session < 24h: bottom sheet with "Resume / Restart / Skip" plus stage/time context.                                                                                                         | 🟠 CRITICAL |
| Auto‑save & crash resilience     | DB only; no strict "per turn" contract. | Redis write every turn; Postgres write every 5 turns; sessions recoverable after reload; no progress loss beyond last few seconds.                                                                                   | 🔴 BLOCKER  |
| Hook stage pre-generation        | Not implemented.                        | While student reads pre-session screen, trigger background Hook prompt assembly and prefetch first AI message into Redis `session:{id}:hook_prefetch`. Without this, first-message latency will regularly exceed 5s. | 🟠 CRITICAL |
| Latency SLO                      | Baseline unknown.                       | Session load < 3s; first AI message < 5s on 4G. Hook prefetch is primary mitigation.                                                                                                                                 | 🟠 CRITICAL |

#### 2.4 Assessment, Revision, Readiness

| Area                                  | v1 State                                                          | v2 Requires                                                                                                                                                                                                             | Severity     |
| ------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 4‑gate question generation            | Basic schema validation; no solvability/dup/reading‑level checks. | Gate 1: schema; Gate 2: independent LLM solver check; Gate 3: cosine similarity vs student's last 90 days (threshold 0.85); Gate 4: Flesch-Kincaid ±1 grade level.                                                      | 🟠 CRITICAL  |
| Semantic dedup for questions          | Not implemented.                                                  | Embedding similarity threshold 0.85 vs student's last 90 days of questions. Reject + regenerate on hit.                                                                                                                 | 🟠 CRITICAL  |
| Error‑typed feedback on wrong answers | Generic incorrect feedback.                                       | Each wrong answer shows worked solution + specific error type label (sign error, formula confusion, unit error, procedural error, reasoning gap). Not generic "incorrect".                                              | 🟠 CRITICAL  |
| Timed chapter tests                   | Timing behaviour unknown/inconsistent.                            | Visible countdown; auto‑submit at 0; confirmation dialog showing unanswered count on manual submit.                                                                                                                     | 🟡 IMPORTANT |
| Score < 40% → revision plan insertion | Not implemented.                                                  | Automatic BullMQ job inserts targeted revision `LearningPlanItem` within 24–48h of test submission.                                                                                                                     | 🟡 IMPORTANT |
| ExamReadinessScore                    | Not implemented.                                                  | At launch: simplified readiness proxy (weighted chapter mastery average). Full formula (mastery × `BoardChapterWeight` + mock exam recency + retention) after Week 4 knowledge model is stable. Severity: 🟡 IMPORTANT. | 🟡 IMPORTANT |
| SM‑18 revision cards                  | Not implemented.                                                  | 5‑question revision sessions per due concept; `nextReviewAt` scheduling; score > 80% → stability increases; score ≤ 80% → re-teach inserted; 20‑minute daily cap.                                                       | 🟠 CRITICAL  |
| Question flagging & quarantine        | Partial plumbing; not fully wired.                                | `QuestionFlag` table; 3 flags → `QUARANTINED` status; quarantined questions excluded from all serving queries.                                                                                                          | 🟡 IMPORTANT |

#### 2.5 Engagement & Retention

| Area                                   | v1 State                                        | v2 Requires                                                                                                                                                                | Severity     |
| -------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Streak definition                      | Exists; rules may be loose (e.g. any activity). | "Active day" = full session (all 7 stages) OR ≥10 revision cards. Server‑side enforcement only. Not a login or partial session.                                            | 🟠 CRITICAL  |
| Streak shield                          | Not implemented.                                | One shield per calendar month; auto‑activates on first missed day; resets 1st of month; student notified on use.                                                           | 🟡 IMPORTANT |
| XP system & levels                     | Only basic mechanics.                           | `StudentXP`, `XPEvent`, `LevelConfig` with level 1–100, `(N-1)² × 50` XP thresholds. XP never decrements. Level‑up full-screen overlay (cannot be suppressed).             | 🟠 CRITICAL  |
| Badge system                           | Not implemented.                                | `Badge`, `StudentBadge` models; event‑driven awarding; 5‑slot showcase on profile; overlay on earn.                                                                        | 🟡 IMPORTANT |
| Session completion summary             | Minimal.                                        | XP animation → stats row (questions, duration, mastery delta) → AI personalised insight (GPT-4o-mini, session-specific) → 5-star rating → "Start next session" CTA.        | 🟠 CRITICAL  |
| Session completion screen ticket       | Missing from v1.                                | Explicit component: `SessionCompletionScreen`. Includes `XPAnimation`, `SessionStatsRow`, `AIInsightCard`, `SessionRatingWidget`. Blocks XP system but not core AI loop.   | 🟠 CRITICAL  |
| Student dashboard                      | Streaks + weak/upcoming topics exist.           | Dashboard shows: readiness per subject, revision cards due today, XP this week, Today's Plan — all within < 2s.                                                            | 🟠 CRITICAL  |
| Streak break message — copy constraint | Not verified.                                   | Break message must NOT use: "broke", "missed", "failed", "lost". Must use forward-looking tone: "Start a new streak today — your best is still ahead."                     | 🟡 IMPORTANT |
| Progress report screen                 | Not dedicated.                                  | `/progress` page: 30‑day sessions chart, mastery bars per chapter, test score history, study heatmap, AI narrative insight at top. PDF download optional. Never paywalled. | 🟡 IMPORTANT |
| Exam crunch mode                       | Not implemented.                                | Dashboard mode auto-activates ≤ 14 days to exam: banner, countdown, focus CTA, non-essential UI minimised. Auto-deactivates post-exam.                                     | 🟡 IMPORTANT |

#### 2.6 Subscriptions & Payments

| Area                       | v1 State                                                  | v2 Requires                                                                                                                                                                                                        | Severity    |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Freemium session caps      | Free caps on `/api/chat`; not session‑level for AI tutor. | `FreeTierUsage` per subject per student per month; 3 AI tutor sessions/month/subject; cap checked server‑side **before** session start; never interrupts in-progress session.                                      | 🔴 BLOCKER  |
| Freemium upgrade gate UI   | Not implemented.                                          | Full `FreemiumUpgradeGate` component: explains cap, shows sessions remaining, plan options, upgrade CTA. Must NOT reference referral programme (deferred).                                                         | 🟠 CRITICAL |
| Full INR subscription flow | Payments exist; not aligned with v2 pricing UX.           | `PlanSelector` (Monthly/Quarterly/Annual + INR + GST breakdown), `PaymentMethodSelector` (UPI first), `PaymentConfirmation` (scroll-to-accept terms with IntersectionObserver), Razorpay order + verify endpoints. | 🟠 CRITICAL |
| Referral programme         | Not implemented.                                          | Referral codes; referrer: 1 month free on friend's first payment; referred: 20% off first month; same-device/IP fraud detection. Launch copy must NOT reference referral until implemented.                        | 🟢 DEFER    |

---

### DOMAIN 3 — PARENT ACTOR

| Area                                     | v1 State                                 | v2 Requires                                                                                                                        | Severity     |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Parent as distinct actor                 | Parent represented via fields on `User`. | Separate parent user type (`ParentProfile` or role field); can link up to 3 children; cannot access session chat/transcripts.      | 🟠 CRITICAL  |
| Structured consent record                | OTP implies consent, no formal record.   | First‑class `Consent` model: purposes (data processing, AI interaction), timestamps, IP, withdrawal endpoint. DPDP Act compliance. | 🔴 BLOCKER   |
| Parent progress dashboard                | No dedicated parent dashboard.           | Read‑only child view: sessions/time this week, streak, mastery cards per subject, readiness score, exam countdown.                 | 🟠 CRITICAL  |
| Weekly digest                            | Not implemented.                         | Weekly auto-email: sessions completed, mastery change, readiness, AI narrative insight. Sunday 18:00 IST send via BullMQ.          | 🟡 IMPORTANT |
| Milestone alerts                         | Not implemented.                         | Email/SMS on: chapter mastered, streak milestone, readiness drops >10 pts in a week.                                               | 🟡 IMPORTANT |
| Distress detection → parent notification | Not present.                             | Distress flagged in session → parent email/SMS within SLA; integrated with `safety_event`. Gated on T43 sign-off.                  | 🔴 BLOCKER   |
| Parent subscription management           | Student‑centric subscription.            | Parent‑centric screen: active plan, renewal date, invoices list, cancel CTA. Separate from student profile.                        | 🟡 IMPORTANT |

---

### DOMAIN 4 — ADMIN OPERATIONS

| Area                          | v1 State                                                              | v2 Requires                                                                                                                                                                                                             | Severity     |
| ----------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Concept taxonomy completeness | Hierarchy exists; `irt_b`, bloom, prereqs, confusions may be missing. | Fully seeded taxonomy for CBSE Grade 10 Maths + Science before launch.                                                                                                                                                  | 🔴 BLOCKER   |
| MVP content readiness         | Ingestion pipeline exists; tagging completeness unknown.              | For launch slice: all chunks ingested and tagged with `conceptIds[]`; ≥ 5 questions per concept; `irt_b` manually assigned.                                                                                             | 🔴 BLOCKER   |
| `BoardChapterWeight`          | Not present.                                                          | Per‑chapter mark weightings seeded for CBSE Grade 10 Maths + Science; necessary for readiness score formula.                                                                                                            | 🟠 CRITICAL  |
| Misconception library         | Not implemented.                                                      | Seeded misconceptions (20+ per subject) with regex patterns, contrastive explanations. Expert-reviewed and validated. Low false positive rate verified before launch.                                                   | 🟠 CRITICAL  |
| Prompt evaluation harness     | Not implemented.                                                      | 20+ canonical test cases per major prompt layer; automated regression checks; wired into CI/CD as a required gate on any change to `lib/ai/tutor/promptAssembly.ts` or `lib/ai/prompts/**`. Failing eval blocks deploy. | 🟠 CRITICAL  |
| AI tutor session sampling     | Ad‑hoc; content logs only.                                            | Random 5% of sessions reviewed weekly; quality checklist defined; minimum bar: % of sessions reaching CONSOLIDATION stage.                                                                                              | 🟡 IMPORTANT |
| Per‑student AI feature flag   | Not present.                                                          | `StudentFeatureFlag` table; `ENABLE_AI_TUTOR` global kill switch; staged rollout by cohort (5% → 20% → 50% → 100%).                                                                                                     | 🟠 CRITICAL  |
| LLM cost per session          | AIContentLog for content; not per session.                            | Using `AITutorTurnLog.costUsd`, compute daily `cost/session` aggregate; alert if > ₹0.25/session.                                                                                                                       | 🟡 IMPORTANT |
| `safety_event` review queue   | Not implemented.                                                      | Admin query/view returning unresolved events by severity. Distress events must trigger immediate on-call notification (tested before go-live). On-call alias defined and owned by founder before launch.                | 🔴 BLOCKER   |

---

### DOMAIN 5 — FRONTEND COMPONENTS

> **Coverage note**: Domains 1–4 specify _what_ must exist and _why_. This domain specifies the _component contract_ — layout, states, mobile behaviour, and interaction rules — for every screen that must be built or significantly changed. Without this, a frontend engineer has no contract to build against.

#### 5.1 Component Inventory & States

Every component listed below must handle four states unless marked otherwise. Missing any state = broken experience on production:

- **Loading** — skeleton or spinner; max 2s before fallback shown
- **Empty** — user has no data yet; always includes a CTA, never a blank screen
- **Error** — network/server error; retry option; never exposes raw error messages
- **Populated** — the happy path

---

**`AITutorChatPanel`** — _Core session interaction surface_

| Attribute           | Spec                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route               | Embedded in `app/(student)/session/[sessionId]/page.tsx`                                                                                                                                         |
| Replaces            | Existing PRACTICE + TEST phase UI                                                                                                                                                                |
| Layout              | Full-height flex column: top = chat history (scrollable), bottom = input bar (sticky, never obscured by keyboard)                                                                                |
| Mobile              | Input bar uses `position: sticky; bottom: 0` with `env(safe-area-inset-bottom)` padding for iOS. Keyboard-aware scroll — chat history scrolls up when keyboard opens. Min touch target: 44×44px. |
| Chat history        | Alternating AI (left-aligned, light grey bubble) / Student (right-aligned, brand-coloured bubble). AI bubble max-width: 85% on mobile.                                                           |
| AI typing indicator | Three animated dots while SSE stream is open but first token not yet received. Immediately replaced by streaming text on first token.                                                            |
| Streaming           | `EventSource` or `fetch` + `ReadableStream`. Text appended character-by-character. Cursor blink at end of in-progress message.                                                                   |
| Machine tags        | Stripped from display. `[QUESTION]`, `[STAGE_ADVANCE]` etc. never shown to student.                                                                                                              |
| Hint bar            | Below input: "Hints: 0/3" counter. Tap "Get a Hint" to request. Button disabled after Tier 3 hint delivered. Entire hint bar hidden during EXPLANATION stages.                                   |
| Inactivity timer    | After 90s of no student input: subtle pulsing prompt appears above input bar — "Still working on it? Want a hint?" — with Yes/No. Auto-dismisses if student starts typing.                       |
| Error state         | If SSE connection drops: inline banner "Connection lost — reconnecting…" with spinner. On reconnect: re-deliver last AI message. Never lose student's typed-but-not-sent text.                   |
| Feature flag        | Entire component renders only if `isAITutorEnabled`. Otherwise renders existing session UI unchanged.                                                                                            |

---

**`PreSessionScreen`** — _Gateway before session starts_

| Attribute           | Spec                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route               | `app/(student)/session/pre/[conceptId]/page.tsx`                                                                                                                                      |
| Layout              | Centred card (max-width 480px), vertically centred on desktop, full-screen on mobile                                                                                                  |
| Content             | Topic name (large), subject badge, estimated duration chip, prerequisite status row                                                                                                   |
| Prerequisite status | Each prerequisite shown as a pill: green (mastered ≥70%), amber (partial 40–69%), red (not started <40%). If any red/amber: amber warning banner "Some prerequisites are incomplete." |
| CTAs                | Primary: "Start Session". Secondary (if unmet prereqs): "Study Prerequisites First" (navigates to lowest-mastery prerequisite).                                                       |
| Hook prefetch       | On mount: fire `POST /api/tutor/session/prefetch` to trigger Hook stage pre-generation in background. User sees CTAs immediately.                                                     |
| Loading             | CTAs visible immediately from static data. Prerequisite pills load async — show skeleton pills until resolved. Never block CTAs on prereq load.                                       |
| Mobile              | Full-screen. Large tap targets. No horizontal scroll.                                                                                                                                 |

---

**`InterruptedSessionSheet`** — _Bottom sheet on session resume_

| Attribute | Spec                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger   | Appears automatically when navigating to a session that has an incomplete Redis state < 24h old                                                                            |
| Layout    | Bottom sheet (slides up). Not a modal — student can see context beneath.                                                                                                   |
| Content   | "You were in stage N of 7, about X minutes in." Three options as large tappable rows: "Resume from where I left off", "Restart topic", "Skip this topic (defer to later)". |
| Dismiss   | Tapping outside sheet does nothing — student must choose an option.                                                                                                        |
| Mobile    | Sheet height: auto up to 60vh. Drag handle visible. Snap points: open / closed.                                                                                            |

---

**`SessionCompletionScreen`** — _Post-session summary_

| Attribute     | Spec                                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route         | Replaces session UI after CONSOLIDATION stage `[STAGE_ADVANCE]` with no next stage                                                                                         |
| Layout        | Full-screen, scrollable. Celebration top → stats → insight → rating → CTA                                                                                                  |
| XP animation  | Lottie or CSS: XP counter ticks up from previous total to new total. If level-up: full-screen level-up card appears first (blocks summary until dismissed or 3s timeout).  |
| Stats row     | 4 chips: "X concepts", "Y questions", "Z% correct", "N minutes".                                                                                                           |
| Mastery delta | Per-concept: before/after mastery bar. Green if improved. Show only concepts touched in this session (max 5).                                                              |
| AI insight    | GPT-4o-mini generated. Specific to this session ("You've improved significantly on quadratic formula substitution today…"). Loading skeleton for up to 3s while generated. |
| Star rating   | 5-star tap widget. Optional. After tap: brief thank-you micro-animation. Submits via `POST /api/student/session/[id]/rating`.                                              |
| CTA           | "Start Next Session" (primary, navigates to next `LearningPlanItem`). "Back to Dashboard" (secondary).                                                                     |
| Mobile        | Fully scrollable. XP animation auto-plays. No pinch-zoom on completion screen.                                                                                             |

---

**`StudentDashboard`** — _Primary screen after login_

| Attribute            | Spec                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route                | `app/(student)/dashboard/page.tsx`                                                                                                                                              |
| Layout               | Single-column on mobile. Two-column on desktop (left: Today's Plan + CTA; right: readiness + revision cards).                                                                   |
| Load strategy        | Server component with streaming. Render shell + CTA immediately from session cache. Stream readiness cards, revision queue, XP as they resolve. Total time to interactive < 2s. |
| `TodaysLearningCard` | Top of page. Topic name, subject, estimated duration. Single large "Continue Learning" CTA. Fallback to `getNextAction` if no `LearningPlanItem` for today.                     |
| Streak widget        | Fire emoji + count. "X day streak". Tap opens streak history (mini calendar).                                                                                                   |
| Revision due         | "N cards due today" chip. Tapping opens inline revision queue. If 0 due: "You're all caught up today ✓" in green.                                                               |
| XP widget            | "XP this week: NNN". Progress bar to next level. Level badge.                                                                                                                   |
| Readiness            | One card per subject. Score ring (0–100), colour: red <40, amber 40–70, green >70. Tap navigates to subject detail.                                                             |
| Exam crunch mode     | Auto-activates when `daysToExam ≤ 14`. Dashboard switches layout: countdown timer prominent top-center, non-revision widgets hidden, primary CTA changes to "Study for Exam".   |
| Empty state          | New student with no data: onboarding checklist card instead of all widgets. Steps: "Complete profile", "Take diagnostic", "Start first session".                                |
| Error state          | Each widget fails independently — a broken readiness card doesn't blank the whole dashboard. Each widget shows its own "Couldn't load — tap to retry" state.                    |

---

**`DiagnosticFlow`** — _Adaptive baseline test_

| Attribute        | Spec                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route            | `app/(student)/diagnostic/[subjectId]/page.tsx`                                                                                                                            |
| Layout           | Full-screen, distraction-free. No nav bar during active test. Progress bar at top showing question N of estimated total (range: 15–25).                                    |
| Question render  | Question text, then answer options (MCQ) or text input (short answer). One question visible at a time.                                                                     |
| Navigation       | No back button within active diagnostic — student can only go forward.                                                                                                     |
| Timer            | Soft 30-minute timer shown in corner. At 28 minutes: gentle warning "2 minutes remaining". At 30 minutes: auto-save and submit partial.                                    |
| Pause/resume     | "Save and continue later" button. State saved to Redis with 24h TTL. On resume: exactly where left off.                                                                    |
| Abandon recovery | If < 10 questions answered and session expires: submit partial; system assumes grade-level prior for unanswered concepts. UI shows "Partial diagnostic submitted" message. |
| Results screen   | Visual knowledge map (not score). Colour-coded chapters: red/amber/green. "Here's where to start" recommended chapter highlighted. CTA: "Start Learning".                  |
| Mobile           | Large tap targets for MCQ options (min 52px height). Text input uses numeric keyboard for math answers.                                                                    |

---

**`FreemiumUpgradeGate`** — _Session cap enforcement surface_

| Attribute    | Spec                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger      | Shown instead of session start when `FreeTierUsage.count >= 3` for that subject this month. Never mid-session.                                                            |
| Layout       | Full-card overlay (not toast). Cannot be dismissed without choosing an option.                                                                                            |
| Content      | "You've used all 3 free sessions for [Subject] this month." Session counter ("3 of 3 used"). Plan preview: Monthly ₹399, Quarterly ₹267 (10% off), Annual ₹891 (25% off). |
| CTAs         | "Upgrade Now" (primary). "Remind me later" (secondary — closes and shows a sticky upgrade banner on dashboard).                                                           |
| Copy         | Must NOT reference referral programme until that feature is live.                                                                                                         |
| Reset notice | "Your free sessions reset on [1st of next month]."                                                                                                                        |

---

**`ProfileCompletionGate`** — _Blocking overlay for incomplete profile_

| Attribute    | Spec                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Trigger      | Rendered in student layout when `isProfileComplete = false`. Overlays all routes in `app/(student)/**`.                             |
| Layout       | Full-screen overlay (not modal). Cannot be bypassed via URL.                                                                        |
| Content      | Checklist: Board (✓/✗), Grade (✓/✗), Medium of instruction (✓/✗), At least one subject (✓/✗). Progress bar showing N of 4 complete. |
| CTA          | "Complete your profile" button → navigates to `/profile/setup`.                                                                     |
| Cannot close | No X button. No click-outside dismiss. Gate lifted only when server-side `isProfileComplete` returns true.                          |

---

**`ParentOTPGate`** — _Age-gate enforcement overlay_

| Attribute | Spec                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Trigger   | Rendered in student layout when `accountStatus = PENDING_PARENT_VERIFY`. Only for students under 13.                 |
| Layout    | Full-screen overlay. Priority over `ProfileCompletionGate` (check parent gate first).                                |
| Content   | Explanation of why parent verification is needed. Mobile number input for parent. "Send OTP" → OTP input → "Verify". |
| Success   | Overlay disappears immediately on successful verification. No page reload needed (update client state).              |
| Resend    | "Resend OTP" available after 30s. Max 3 resend attempts per session before "contact support" message.                |

---

**`ParentDashboard`** — _Read-only parent progress view_

| Attribute             | Spec                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Route                 | `app/(parent)/dashboard/page.tsx`                                                                                              |
| Layout                | Simple. One card per linked child. Tap child card to expand/navigate to child detail.                                          |
| Child summary card    | Name, grade, board. Sessions this week. Current streak. Readiness score per subject (colour ring). Exam date countdown if set. |
| Child detail          | Sessions list (last 7 days). Chapter mastery bars per subject. Readiness score breakdown. Recent test scores.                  |
| Language              | Simplified language — written for low-digital-literacy parent. No jargon.                                                      |
| Empty state           | No linked children: "Link your child's account to start monitoring their progress." with CTA.                                  |
| Read-only enforcement | No edit controls visible. Cannot navigate to any student-facing route. Separate session/auth.                                  |

---

#### 5.2 Shared UI Patterns

These apply globally across the student shell. Any engineer touching FE must follow these:

| Pattern                  | Rule                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Mobile-first breakpoints | Default styles target 360px. `sm:` = 640px. `md:` = 768px. `lg:` = 1024px. Never desktop-first.                        |
| Minimum touch targets    | 44×44px on all interactive elements. Use Tailwind `min-h-[44px] min-w-[44px]`.                                         |
| Loading skeletons        | All async data shows a skeleton (not spinner) that matches the populated layout's shape. Max 2s skeleton.              |
| Error states             | Every async widget handles error independently. Never propagate a single error to blank a full page.                   |
| Empty states             | Every list/feed has an empty state with a specific CTA. Never render an empty `<div>`.                                 |
| Overlay vs redirect      | Use overlay-style gates (not full redirects) for profile/parent guards to avoid redirect loops and preserve URL state. |
| Celebration animations   | Level-up, badge earn, streak milestones use CSS or Lottie animations. Cannot be auto-skipped (minimum 1.5s display).   |
| Streak break copy        | Must not use "broke", "missed", "failed", "lost". Forward-looking only.                                                |
| Dark mode                | All components must support `dark:` Tailwind variants. Test on dark mode before shipping.                              |

---

### DOMAIN 6 — UX FLOWS

> **Coverage note**: This domain specifies the complete interaction flows — screen sequences, decision points, back-navigation behaviour, and micro-interactions. Engineers use this to know what comes before and after each screen.

#### 6.1 Student Onboarding Flow

```
Registration (OTP/Google/Email)
  │
  ├─ age < 13 ─────────────────────────────────────────────────────────┐
  │                                                                     │
  │                                                            ParentOTPGate (blocking)
  │                                                                     │
  │                                                            Parent verifies OTP
  │                                                                     │
  └─ age ≥ 13 ──────────────────────────────────────────────────────────┘
         │
         ▼
  Profile Setup (Board → Grade → Medium → Subjects)
  [ProfileCompletionGate shown until all 4 complete]
         │
         ▼
  Subject Diagnostic (one per selected subject — sequential, not parallel)
  [DiagnosticGate blocks session start per-subject until complete]
         │
         ▼
  Exam Date + Weekly Hours capture
  (can be skipped with "No upcoming exam" — plan horizon set to 6 months)
         │
         ▼
  Knowledge Map Results Screen
  (visual only — no score number shown)
         │
         ▼
  StudentDashboard (first time — onboarding checklist card visible)
```

**Back navigation**: Destructive actions (leaving a diagnostic mid-way) require a confirmation bottom sheet: "Save and leave?" / "Abandon (progress lost)". Never hard-navigate away from an active diagnostic without confirmation.

---

#### 6.2 Learning Session Flow

```
StudentDashboard
  │
  "Continue Learning" / "Today's Plan" CTA
  │
  ▼
PreSessionScreen
  ├─ Hook prefetch fires on mount (background)
  ├─ Prereq check loads async (skeletons during load)
  │
  ├─ Incomplete session detected? ──── Yes ──► InterruptedSessionSheet
  │                                              ├─ Resume ──────────────┐
  │                                              ├─ Restart              │
  │                                              └─ Skip ──► Dashboard   │
  │                                                                       │
  └─ No incomplete session                                                │
         │                                                                │
         "Start Session" CTA ◄──────────────────────────────────────────┘
         │
         ▼
  AITutorChatPanel (active session)
  [7 stages: Hook → Prereq Bridge → Core Explanation
             → Worked Example → Guided Practice
             → Independent Practice → Consolidation]
         │
         ├─ Student interrupts with doubt ──► AI resolves ──► resume stage
         ├─ 90s inactivity ──► hint prompt
         ├─ [PREREQ_FAIL] fired ──► remediation sub-flow ──► return to stage
         ├─ [STRUGGLE_DETECTED] ──► AI reduces difficulty, offers options
         │
         ▼
  CONSOLIDATION stage complete → [STAGE_ADVANCE] with no next stage
         │
         ▼
  SessionCompletionScreen
  [XP animation → level-up check → stats → AI insight → rating → CTA]
         │
         ▼
  StudentDashboard (updated state)
```

**Session crash/network drop recovery**:

- Redis state auto-saves every turn.
- On reconnect: reload last known state from Redis.
- If `lastTurnCompleted = false`: roll back partial turn, re-display last complete AI message.
- Student sees: "Connection restored — continuing from where you left off."
- Never show the student a blank chat or force a restart due to a connectivity issue.

---

#### 6.3 Freemium Cap Flow

```
Student taps "Start Session" or "Continue Learning"
         │
         ▼
  Server-side cap check: FreeTierUsage.count for (studentId, subjectId, month)
         │
  ├─ count < 3 ──────────────────────────────────────────────────────────► Normal session flow
  │
  └─ count >= 3
         │
         ▼
  FreemiumUpgradeGate (full card — not toast, not modal)
         │
  ├─ "Upgrade Now" ──────────────────────────────────────────────────────► Subscription Purchase Flow
  │
  └─ "Remind me later"
         │
         ▼
  Dashboard (sticky upgrade banner in header, dismissible after 24h)
```

**Subscription Purchase Flow**:

```
PlanSelector (Monthly / Quarterly / Annual)
  │
  ▼
PaymentMethodSelector (UPI → Cards → Net Banking → EMI)
  │
  ▼
PaymentConfirmation
  [Amount, plan, renewal date, GST, cancellation terms all visible]
  [Confirm button requires scroll-to-bottom: enabled via IntersectionObserver]
  │
  ▼
Razorpay checkout (existing integration)
  │
  ├─ Success ──► access unlocked ──► receipt SMS + email ──► Dashboard
  │                                  (all 3 free sessions still count this month)
  │
  └─ Failure ──► retry up to 3x ──► "Payment failed" screen with support contact
```

---

#### 6.4 Parent Onboarding & Monitoring Flow

```
Parent registers (mobile OTP)
  │
  ▼
Child linking
  ├─ Student age < 13: auto-prompted during student registration
  └─ Student age ≥ 13: student sends invite from their profile settings
         │
  Parent receives SMS with deep link
         │
         ▼
  ParentDashboard
  [Read-only. Cannot navigate to student session screens.]
         │
  Weekly digest email ──► "View full report" deep link ──► ParentDashboard
```

---

#### 6.5 Empty States — Complete Map

Every screen below must have an empty state. This is exhaustive:

| Screen                               | Empty State Content                                | CTA                           |
| ------------------------------------ | -------------------------------------------------- | ----------------------------- |
| StudentDashboard (new user)          | Onboarding checklist card                          | "Complete your profile"       |
| StudentDashboard (no revision due)   | "You're all caught up today ✓"                     | None (positive reinforcement) |
| DiagnosticResults                    | N/A — results always present after completion      | —                             |
| LearningPlan (not generated yet)     | "Set your exam date to generate your plan"         | "Set exam date"               |
| RevisionQueue (nothing due)          | "No revision due today" with green tick            | "Browse subjects"             |
| ProgressReport (no sessions yet)     | "Complete your first session to see your progress" | "Start a session"             |
| ParentDashboard (no linked children) | "Link your child's account"                        | "Link child"                  |
| BadgeShowcase (no badges yet)        | "Complete sessions to earn badges"                 | "Start a session"             |

---

#### 6.6 Micro-Interactions & Animation Specs

| Interaction              | Behaviour                                                                                | Duration       |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------------- |
| XP counter tick-up       | Counter animates from old value to new value (easeOut)                                   | 800ms          |
| Level-up overlay         | Full-screen, blocks until dismissed or 3s timeout. Cannot be auto-skipped.               | Min 1.5s       |
| Badge earn overlay       | Slides up from bottom, auto-dismisses after 2.5s                                         | 2.5s           |
| Streak milestone         | Confetti burst + counter enlarges                                                        | 1.5s           |
| Chat message appear      | Fade-in from slightly below (translateY 8px → 0)                                         | 150ms          |
| SSE streaming text       | Text appended in chunks. Cursor blink (500ms interval) while stream open.                | Continuous     |
| Hint counter change      | Number scales up briefly (1.1x) on increment                                             | 200ms          |
| Session stage transition | Subtle divider line + stage label appears briefly in chat (e.g. "Moving to Practice...") | 400ms fade     |
| Prerequisite pill load   | Skeleton → pill with fade                                                                | 200ms per pill |
| Plan CTA pulse           | Gentle pulse animation on "Continue Learning" if no interaction for 5s                   | Loop until tap |

---

### DOMAIN 7 — API ↔ FRONTEND CONTRACTS

> **Coverage note**: These are the request/response shapes that frontend components depend on. Every API route must return exactly these shapes — no additions, no omissions — or the frontend breaks silently. Backend engineers must treat these as a binding contract. Frontend engineers must validate against these shapes using Zod on the client.

---

#### 7.1 `POST /api/tutor/turn`

**Request**

```typescript
{
  sessionId: string; // UUID
  studentMessage: string; // max 2000 chars, trimmed
  turnNumber: number; // client-tracked, validated server-side
}
```

**Response** — SSE stream. Each event is one of:

```typescript
// Token chunk (during streaming)
event: token;
data: {
  chunk: string;
}

// Turn complete (after full response generated)
event: complete;
data: {
  tag: 'QUESTION' |
    'VALIDATE' |
    'HINT_OFFER' |
    'STAGE_ADVANCE' |
    'PREREQ_FAIL' |
    'STRUGGLE_DETECTED' |
    'MASTERY_CONFIRMED';
  stage: TutorStage;
  hintsRemaining: number; // 0–3
  turnNumber: number;
  sessionComplete: boolean; // true when CONSOLIDATION stage ends
}

// Error
event: error;
data: {
  code: 'RATE_LIMITED' |
    'SESSION_NOT_FOUND' |
    'AI_UNAVAILABLE' |
    'SAFETY_BLOCK' |
    'FEATURE_DISABLED';
  message: string; // human-readable, safe to display
  retryable: boolean;
}
```

**HTTP error codes**: 401 (unauth), 403 (feature flag off or cap hit), 429 (rate limited), 503 (AI provider down)

---

#### 7.2 `POST /api/tutor/session/start`

**Request**

```typescript
{
  conceptId: string
  source: 'learning_plan' | 'browse' | 'surprise_me' | 'revision'
  resumeMode?: 'resume' | 'restart'  // only if incomplete session exists
}
```

**Response**

```typescript
{
  sessionId: string
  isResuming: boolean
  resumeContext?: {
    stage: TutorStage
    stageAttempt: number
    minutesElapsed: number
    lastAIMessage: string         // for display in InterruptedSessionSheet
  }
  concept: {
    id: string
    name: string
    description: string
    estimatedMinutes: number
    prerequisites: Array<{
      id: string
      name: string
      masteryScore: number        // 0.0–1.0
      masteryLabel: 'mastered' | 'partial' | 'not_started'
    }>
  }
  freeTierUsage?: {              // only for free tier students
    used: number
    limit: number
    resetsAt: string             // ISO date
  }
}
```

---

#### 7.3 `POST /api/tutor/session/prefetch`

**Request**

```typescript
{
  conceptId: string;
}
```

**Response**

```typescript
{
  prefetchId: string; // used by turn endpoint to retrieve cached Hook
  estimatedReadyMs: number; // how long until Hook message is ready
}
```

_Note: Frontend fires this on `PreSessionScreen` mount. Silent — no UI dependency on response._

---

#### 7.4 `GET /api/student/dashboard`

**Request**: None (authenticated, user from session)

**Response**

```typescript
{
  student: {
    name: string
    grade: number
    board: string
    streakDays: number
    longestStreak: number
    xpThisWeek: number
    currentLevel: number
    xpToNextLevel: number
    daysToExam: number | null     // null if no exam date set
    isCrunchMode: boolean         // true if daysToExam <= 14
  }
  todaysPlan: {
    conceptId: string
    conceptName: string
    subjectName: string
    estimatedMinutes: number
    hasIncompleteSession: boolean
  } | null
  revisionDueToday: {
    count: number
    concepts: Array<{ id: string; name: string; retentionPct: number }>
  }
  subjectReadiness: Array<{
    subjectId: string
    subjectName: string
    readinessScore: number       // 0–100
    readinessLabel: 'critical' | 'needs_work' | 'on_track' | 'ready'
  }>
  recentSessions: Array<{
    sessionId: string
    conceptName: string
    completedAt: string
    correctPct: number
  }>
}
```

---

#### 7.5 `GET /api/student/learning-plan/today`

**Response**

```typescript
{
  item: {
    id: string
    weekNumber: number
    conceptId: string
    conceptName: string
    chapterName: string
    subjectName: string
    estimatedMinutes: number
    status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED'
    isManuallyOrdered: boolean
  } | null                       // null = no plan item for today
  fallback: boolean              // true if using getNextAction fallback
}
```

---

#### 7.6 `POST /api/student/session/[sessionId]/complete`

**Request**

```typescript
{
  rating?: number                // 1–5, optional
  ratingText?: string            // optional free text, max 500 chars
}
```

**Response**

```typescript
{
  summary: {
    sessionId: string
    conceptsCompleted: Array<{ id: string; name: string }>
    questionsAttempted: number
    questionsCorrect: number
    correctPct: number
    durationMinutes: number
    masteryDelta: Array<{
      conceptId: string
      conceptName: string
      before: number             // 0.0–1.0
      after: number
    }>
    xpEarned: number
    levelBefore: number
    levelAfter: number
    leveledUp: boolean
    badgesEarned: Array<{ id: string; name: string; iconUrl: string }>
  }
  aiInsight: string              // GPT-4o-mini generated, session-specific
  nextSession: {
    conceptId: string
    conceptName: string
    estimatedMinutes: number
  } | null
}
```

---

#### 7.7 `GET /api/student/revisions/due-today`

**Response**

```typescript
{
  dueCount: number;
  dailyCapMinutes: number; // always 20
  estimatedMinutes: number;
  concepts: Array<{
    id: string;
    name: string;
    subjectName: string;
    retentionPct: number; // predicted memory retention 0–100
    stability: number; // SM-18 stability S
    lastReviewedAt: string; // ISO date
  }>;
}
```

---

#### 7.8 `GET /api/student/readiness/[subjectId]`

**Response**

```typescript
{
  subjectId: string;
  subjectName: string;
  overallScore: number; // 0–100
  predictedScoreMin: number; // null until full formula live
  predictedScoreMax: number; // null until full formula live
  isCrunchMode: boolean;
  chapters: Array<{
    chapterId: string;
    chapterName: string;
    masteryScore: number; // 0.0–1.0
    boardWeightPct: number; // % of marks in board exam
    contribution: number; // masteryScore × boardWeightPct
    status: 'critical' | 'needs_work' | 'on_track' | 'mastered';
  }>;
  lastUpdatedAt: string; // ISO datetime
}
```

---

#### 7.9 `POST /api/student/subscription/order`

**Request**

```typescript
{
  planId: 'monthly' | 'quarterly' | 'annual'
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'emi'
  emiMonths?: 3 | 6 | 12        // only for emi + annual plan
}
```

**Response**

```typescript
{
  orderId: string; // Razorpay order ID
  amount: number; // in paise (₹399 = 39900)
  currency: 'INR';
  planLabel: string; // "Monthly – ₹399/month"
  gstAmount: number; // in paise
  totalAmount: number; // amount + gstAmount
  renewalDate: string; // ISO date (first renewal)
  razorpayKeyId: string; // public key for checkout
}
```

---

#### 7.10 `GET /api/parent/progress`

**Response**

```typescript
{
  children: Array<{
    studentId: string;
    name: string;
    grade: number;
    board: string;
    streakDays: number;
    sessionsThisWeek: number;
    studyTimeThisWeekMinutes: number;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      readinessScore: number;
      daysToExam: number | null;
      recentMasteryChange: number; // positive or negative delta over last 7 days
    }>;
    recentAlerts: Array<{
      type: 'readiness_drop' | 'streak_break' | 'milestone';
      message: string;
      occurredAt: string;
    }>;
  }>;
}
```

---

### ACTION PLAN — MASTER TABLE

All 43 tickets across Weeks 1–8. Every ticket has: ID, title, week, role(s), severity, and file targets. Use this table for sprint planning and role assignment.

| ID   | Title                                       | Week | Role(s)                   | Severity  | Key Files / Targets                                                                                |
| ---- | ------------------------------------------- | ---- | ------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| T1   | Taxonomy & Content Readiness                | 1    | [DB] [CONTENT]            | BLOCKER   | `prisma/seeds/`, Neon console, question_bank rows                                                  |
| T2   | Redis & Infra Guardrails                    | 1    | [INFRA]                   | BLOCKER   | Redis config (`redis.conf`), PM2 ecosystem file                                                    |
| T3   | Feature Flags & Kill Switches               | 1    | [INFRA] [DB]              | BLOCKER   | `prisma/schema.prisma` (`StudentFeatureFlag`), `.env`                                              |
| T4   | New Tutor Turn Endpoint                     | 2    | [BE] [DB]                 | BLOCKER   | `app/api/tutor/turn/route.ts` (new)                                                                |
| T5   | Upgrade `callLLM` for Tutor                 | 2    | [AI] [DB]                 | BLOCKER   | `lib/callLLM.ts`, `AITutorTurnLog` Prisma model                                                    |
| T6   | Prompt Assembly: `assembleSystemPrompt`     | 2    | [AI]                      | BLOCKER   | `lib/ai/tutor/promptAssembly.ts` (new)                                                             |
| T7   | Tag Parser & Monitoring                     | 2    | [AI]                      | BLOCKER   | `lib/ai/tutor/tagParser.ts` (new)                                                                  |
| T8   | Redis Session State Helpers                 | 2    | [BE]                      | BLOCKER   | `lib/redis/tutorSession.ts` (new)                                                                  |
| T9   | Pedagogical State Machine                   | 2    | [AI]                      | BLOCKER   | `lib/ai/tutor/stateMachine.ts` (new), `tests/ai/tutor/stateMachine.test.ts`                        |
| T10  | Chat Panel Integration                      | 2    | [FE]                      | CRITICAL  | `components/student/session/AITutorChatPanel.tsx` (new)                                            |
| T10b | Session Completion Screen                   | 2    | [FE]                      | CRITICAL  | `components/student/session/SessionCompletionScreen.tsx` (new)                                     |
| T11  | Frustration & Emotional Signals             | 2    | [AI]                      | IMPORTANT | `lib/ai/tutor/signals.ts` (new)                                                                    |
| T12  | Safety: PII Redaction & Jailbreak           | 2    | [SAFETY]                  | BLOCKER   | `lib/ai/tutor/inputSafety.ts` (new)                                                                |
| T13  | Safety: Age-Appropriate Output Filter       | 2    | [SAFETY]                  | BLOCKER   | `lib/ai/tutor/outputSafety.ts` (new)                                                               |
| T14  | Safety Events Plumbing                      | 2    | [DB] [BE]                 | CRITICAL  | `prisma/schema.prisma` (`SafetyEvent`), `app/api/admin/safety-events/route.ts`                     |
| T15  | Distress Detection & Parent Notification    | 2    | [SAFETY] [WORKER] [HUMAN] | BLOCKER   | `lib/ai/tutor/distress.ts`, `worker/services/notificationWorker.ts` — GATED on T43                 |
| T16  | `StudentConceptState` & AnswerEvent (MVP)   | 3    | [DB]                      | BLOCKER   | `prisma/schema.prisma` (2 new models)                                                              |
| T17  | Diagnostic → Concept Bootstrap              | 3    | [WORKER]                  | BLOCKER   | `worker/services/diagnosticBootstrapWorker.ts` (new)                                               |
| T18  | Misconception Library (Slice)               | 3    | [CONTENT] [AI] [DB]       | CRITICAL  | `prisma/seeds/misconceptions-*.ts`, `lib/ai/tutor/misconceptionDetector.ts` (new)                  |
| T19  | Basic RAG Hook for Tutor                    | 3    | [AI]                      | CRITICAL  | `lib/ai/tutor/rag.ts` (new), orchestrator wiring                                                   |
| T20  | Freemium Session Cap (Server-Side)          | 3    | [BE] [DB]                 | BLOCKER   | `prisma/schema.prisma` (`FreeTierUsage`), `app/api/tutor/session/start/route.ts`                   |
| T21  | Extend `StudentConceptState` to full schema | 4    | [DB]                      | BLOCKER   | `prisma/schema.prisma` (additive fields)                                                           |
| T22  | AnswerEvent + IRT Update Worker             | 4    | [DB] [WORKER] [AI]        | BLOCKER   | `lib/ai/tutor/irt.ts` (new), `worker/services/irtWorker.ts` (new)                                  |
| T23  | SM-18 Spaced Repetition Scheduler           | 4    | [WORKER] [DB] [FE]        | CRITICAL  | `worker/services/revisionSchedulerWorker.ts` (new), `app/api/student/revisions/due-today/route.ts` |
| T24  | Backfill `conceptIds[]` on Chunks           | 5    | [CONTENT] [INFRA]         | BLOCKER   | Ingestion workers, Neon direct SQL backfill                                                        |
| T25  | Per-Turn RAG Retrieval                      | 5    | [AI]                      | CRITICAL  | `lib/ai/tutor/rag.ts` (extend), orchestrator                                                       |
| T26  | `doubt_kb` Table & Retrieval                | 5    | [DB] [BE]                 | CRITICAL  | `prisma/schema.prisma` (`DoubtKb`), `worker/services/doubtKbWorker.ts` (new)                       |
| T27  | Misconception Seeding + Detector            | 5    | [CONTENT] [AI] [DB]       | CRITICAL  | `prisma/seeds/misconceptions-math10.ts`, `prisma/seeds/misconceptions-science10.ts`                |
| T28  | Explanation Cache                           | 5    | [BE] [INFRA]              | IMPORTANT | `lib/redis/cache.ts` (new), orchestrator wiring                                                    |
| T29  | Global Profile Completeness Guard           | 6    | [BE] [FE]                 | BLOCKER   | `lib/student/profileGuard.ts` (new), `app/(student)/layout.tsx`                                    |
| T30  | Global Parent OTP Enforcement               | 6    | [BE] [FE]                 | BLOCKER   | `app/(student)/layout.tsx`, auth middleware                                                        |
| T31  | Diagnostic Hard Gate on All Entrypoints     | 6    | [BE] [FE]                 | BLOCKER   | All `app/(student)/session/**` pages, `lib/student/diagnostic.ts`                                  |
| T32  | Grade Immutability — Server-Side Strip      | 6    | [BE]                      | CRITICAL  | `app/api/user/onboarding/route.ts`, `app/api/student/profile/route.ts`                             |
| T33  | Learning Plan Models & Generator            | 6    | [DB] [BE] [WORKER]        | CRITICAL  | `prisma/schema.prisma` (`LearningPlan`, `LearningPlanItem`), `lib/ai/learningPlan.ts` (new)        |
| T34  | "Today's Plan" Widget                       | 6    | [FE] [BE]                 | CRITICAL  | `components/student/TodaysLearningCard.tsx`, `app/api/student/learning-plan/today/route.ts`        |
| T35  | ExamReadinessScore Computation              | 6    | [WORKER] [BE] [FE]        | IMPORTANT | `lib/ai/readinessScore.ts` (new), `worker/services/readinessWorker.ts` (new)                       |
| T36  | Prompt Evaluation Harness + CI Gate         | 6    | [AI] [INFRA]              | CRITICAL  | `tests/ai/tutor/*.test.ts`, CI pipeline config                                                     |
| T37  | Structured Consent Record (DPDP)            | 7    | [DB] [BE] [HUMAN]         | BLOCKER   | `prisma/schema.prisma` (`Consent`), `app/api/parent/consent/route.ts` (new)                        |
| T38  | Parent as Distinct Actor + Routing          | 7    | [DB] [BE] [FE]            | CRITICAL  | `prisma/schema.prisma` (`ParentProfile`), `app/(parent)/**` (new route group)                      |
| T39  | Parent Read-Only Progress Dashboard         | 7    | [BE] [FE]                 | CRITICAL  | `app/(parent)/dashboard/page.tsx` (new), `app/api/parent/progress/route.ts` (new)                  |
| T40  | Multi-Tier LLM Router + Circuit Breaker     | 8    | [AI] [INFRA]              | CRITICAL  | `lib/ai/tutor/modelRouter.ts` (new), Redis circuit breaker                                         |
| T41  | Staged Rollout + Kill Switch Wiring         | 8    | [INFRA] [DB]              | CRITICAL  | `lib/features.ts` (new), tutor entrypoints                                                         |
| T42  | Daily Cost Metric + Alert Process           | 8    | [INFRA] [WORKER]          | IMPORTANT | `worker/services/reportingWorker.ts` (new), `AITutorTurnLog` queries                               |
| T43  | Distress Copy Review + Final Safety QA      | 8    | [HUMAN] [SAFETY]          | BLOCKER   | Safety prompt templates, `lib/ai/prompts/safety.ts` — GATES T15                                    |

**Role filter guide** — filter this table by the `Role(s)` column to extract your personal ticket list:

- Backend engineer: filter `[BE]`
- AI/ML engineer: filter `[AI]`
- Frontend engineer: filter `[FE]`
- Worker/infra engineer: filter `[WORKER]` or `[INFRA]`
- DBA / data engineer: filter `[DB]`
- Safety engineer: filter `[SAFETY]`
- Content/curriculum team: filter `[CONTENT]`
- Human sign-off required: filter `[HUMAN]` — T15, T37, T43

**Critical dependencies (cannot start until predecessor is done)**:

- T4 (Turn Endpoint) requires T8 (Redis Helpers) and T6 (Prompt Assembly)
- T10 (Chat Panel) requires T4 (Turn Endpoint)
- T15 (Distress) is BLOCKED until T43 (counsellor sign-off) — enforce with `ENABLE_DISTRESS_DETECTION=false`
- T22 (IRT Worker) requires T16 (`StudentConceptState` schema)
- T33 (Learning Plan) requires T17 (Concept Bootstrap)
- T35 (Readiness Score) requires T21 (full `StudentConceptState`)

---

### CONSOLIDATED PRIORITY LIST — BUILD ORDER

#### Week 1 — Foundation & Kill Switches

1. **Taxonomy & Content Readiness (launch slice only)** 🗄️ [DB] | 📋 [CONTENT]
   - Seed `irt_b`, `bloomLevel`, `prerequisiteConceptIds[]`, `commonlyConfusedWithIds[]`, and `description` for **CBSE Grade 10 Maths + Science** concepts.
   - Verify that curriculum chunks for this slice are fully ingested with non‑null `conceptIds[]` in pgvector tables. Verify: `SELECT COUNT(*) FROM "Concept" WHERE "description" IS NULL AND "subjectId" IN (...)`; for chunks: `SELECT COUNT(*) FROM "CurriculumChunk" WHERE cardinality("conceptIds") = 0`.
   - Seed `BoardChapterWeight` for these chapters.
   - Seed `BoardSubjectConfig` for CBSE + ICSE Grade 6–12. Mark `isCore = true` for mandatory subjects. This unblocks the subject picker in onboarding — without it the picker renders empty.
   - Manually assign `irt_b` to all seeded questions in the launch slice.
   - **Implementation:** Schema: `Concept`, `BoardChapterWeight`, `BoardSubjectConfig`, `CurriculumChunk` + `Question.irt_b` in `prisma/schema.prisma`. Run `npx prisma migrate dev` then `npx ts-node scripts/seed-taxonomy-launch-slice.ts`. Verify with `npx ts-node scripts/verify-taxonomy-launch-slice.ts`.

2. **Redis & Infra Guardrails** 🔧 [INFRA]
   - Verify Redis: `appendonly yes`, eviction policy `volatile-lru`.
   - Test Redis failover does not clear session keys unexpectedly.
   - **Decision (pre‑market):** Redis Cloud may run with `Data persistence = None` (free plan). Treat Redis as **non‑durable cache** only; session state must be recoverable from Postgres. **Upgrade to paid durability** (AOF / provider durability option) is **PENDING** before market launch.

3. **Feature Flags & Kill Switches** 🔧 [INFRA] | 🗄️ [DB]
   - Introduce `StudentFeatureFlag` model and global `ENABLE_AI_TUTOR` env var.
   - `ENABLE_DISTRESS_DETECTION` flag defaults to `false` — must not be enabled until T43 copy review signed off.
   - Wire AI tutor entrypoints to check both flags.
   - **Implementation:** `prisma/schema.prisma` adds `StudentFeatureFlag` (unique `studentId+key`). Migration: `npx prisma migrate dev --name add_student_feature_flag`. Helper: `lib/features/aiTutor.ts` (`isAiTutorGloballyEnabled`, `isAiTutorEnabledForStudent`, `isDistressDetectionEnabled`).

---

#### Week 2–3 — AI Tutor Core Loop

4. **New Tutor Turn Endpoint** ⚙️ [BE] | 🗄️ [DB]
   - `app/api/tutor/turn/route.ts`: auth check → feature flag check → freemium cap check → load Redis state → orchestrator → SSE stream → error handling.
   - Returns SSE event shapes from Domain 7 Section 7.1 exactly.

5. **Upgrade `callLLM` for Tutor Calls** 🧠 [AI] | 🗄️ [DB]
   - Dedicated `promptType` values for tutor turns. Typed error codes. Log to `AITutorTurnLog`.

6. **Prompt Assembly: `assembleSystemPrompt`** 🧠 [AI]
   - `lib/ai/tutor/promptAssembly.ts`. All 7 layers. Token budget 16K total, 4K reserved. Priority-ordered truncation. Unit-tested in isolation.

7. **Tag Parser & Monitoring** 🧠 [AI]
   - `parseTutorTag(response: string): TutorTag | null`. Default to `[QUESTION]` on no valid tag. Log tag distribution metric.

8. **Redis Session State Helpers** ⚙️ [BE]
   - `getTutorSession`, `setTutorSession`, `updateTutorSession`, `deleteTutorSession`.
   - `markTurnStarted`, `markTurnCompleted`, `hasIncompleteTurn` for incomplete turn recovery.
   - Key: `session:tutor:{sessionId}`. TTL: 86400s refreshed on every write.

9. **Pedagogical State Machine Module** 🧠 [AI]
   - `lib/ai/tutor/stateMachine.ts`. `applyTagTransition` pure reducer. 40+ unit tests covering all transitions and edge cases.

10. **Chat Panel Integration** 🎨 [FE]
    - `AITutorChatPanel` as specified in Domain 5 Section 5.1. SSE streaming, hint counter, inactivity timer. Feature-flag guarded. Replaces PRACTICE/TEST phase UI.

10b. **Session Completion Screen** 🎨 [FE] - `SessionCompletionScreen` component as specified in Domain 5 Section 5.1. XP animation, mastery delta, AI insight skeleton, star rating, next session CTA.

11. **Frustration & Emotional State Signals** 🧠 [AI]
    - `lib/ai/tutor/signals.ts`. Weighted formula. Output: `frustrationScore` + `emotionalState` enum. Injected into SESSION_STATE and STUDENT_PROFILE layers.

12. **Safety: PII Redaction & Jailbreak Guard** 🔴 [SAFETY]
    - `lib/ai/tutor/inputSafety.ts`. Pre-compiled regex patterns. On jailbreak: do NOT call LLM — return safe refusal immediately. Log `safety_event`.

13. **Safety: Age‑Appropriate Output Filter** 🔴 [SAFETY]
    - Post-LLM filter. Block/regenerate on unsafe content. Log `safety_event`.

14. **Safety Events Plumbing** 🗄️ [DB] | ⚙️ [BE]
    - `SafetyEvent` Prisma model. Wire all safety detections to insert events. Admin SQL view for unresolved events. On-call alias defined and tested.

15. **Distress Detection & Parent Notification** 🔴 [SAFETY] | 🔁 [WORKER] | 👤 [HUMAN]
    - Gated behind `ENABLE_DISTRESS_DETECTION = false`. Detect distress keywords + sentiment. Background BullMQ job for parent notification. Check `parent.mobile IS NOT NULL AND parent.verified = true` — silent skip if absent. **T43 counsellor sign-off must complete before this flag is enabled.**

---

#### Week 3 — Misconceptions & Minimal Knowledge Model

16. **`StudentConceptState` & Answer Events (MVP fields)** 🗄️ [DB]
    - MVP fields only: `studentId`, `conceptId`, `masteryScore`, `nextReviewAt`, `lastInteraction`, `attemptCount`.
    - `AnswerEvent` minimum: `studentId`, `sessionId`, `conceptId`, `isCorrect`, `studentAnswer` (raw text), `questionId`, `source`. These minimum fields are required for misconception detection to fire correctly.

17. **Diagnostic → Concept Bootstrap (MVP)** 🔁 [WORKER]
    - BullMQ job triggered on diagnostic completion. Map chapter/topic to concepts. Seed `StudentConceptState` with baseline mastery.

18. **Misconception Library (Slice)** 📋 [CONTENT] | 🧠 [AI] | 🗄️ [DB]
    - `Misconception` and `StudentMisconception` models. Seed 20+ misconceptions per subject. Expert-reviewed before enabling on production. `matchMisconception` integration in orchestrator.

19. **Basic RAG Hook for Tutor** 🧠 [AI]
    - For launch slice: per-turn retrieval, top 4 chunks after reranking into `CURRICULUM_CONTEXT`. Log chunk IDs to `AITutorTurnLog`.

20. **Freemium Session Cap Enforcement (Server‑Side)** ⚙️ [BE] | 🗄️ [DB]
    - `FreeTierUsage` table. Cap check before session start (never mid-session). Block + surface `FreemiumUpgradeGate` on hit. Returns `freeTierUsage` in `POST /api/tutor/session/start` response.

---

#### Week 4 — Full Knowledge Model, IRT & Revision

- **T21. Extend `StudentConceptState` to full v2 schema** 🗄️ [DB]
  - Add: `masteryVariance`, `theta`, `stability`, `retention`. Additive only. Update all read/write paths.

- **T22. `AnswerEvent` + IRT update worker** 🗄️ [DB] | 🔁 [WORKER] | 🧠 [AI]
  - `irtWorker.ts`: consume answer events, compute MAP 3PL theta update (bounded `|Δtheta| ≤ 0.5`), update `StudentConceptState`. Non-blocking — session continues immediately. Files: `lib/ai/tutor/irt.ts`, `worker/services/irtWorker.ts`.

- **T23. SM‑18 spaced repetition scheduler & revision queue** 🔁 [WORKER] | 🗄️ [DB] | 🎨 [FE]
  - Nightly BullMQ job: compute `R = e^(-t/S)`, update `nextReviewAt`. API: `GET /api/student/revisions/due-today` per Domain 7 Section 7.7. Surface on dashboard revision widget.

---

#### Week 5 — RAG, Doubt KB, Misconceptions

- **T24. Backfill `conceptIds[]` on curriculum chunks** 📋 [CONTENT] | 🔧 [INFRA]
  - For CBSE 10 Maths/Science: backfill all existing chunks. Lock in tagging for future ingestion runs.

- **T25. Per‑turn RAG retrieval in tutor orchestrator** 🧠 [AI]
  - `lib/ai/tutor/rag.ts`. Embed concept + brief history → pgvector query → top 4 after reranking → inject into `CURRICULUM_CONTEXT`. Log chunk IDs.

- **T26. `doubt_kb` table & retrieval** 🗄️ [DB] | ⚙️ [BE]
  - `DoubtKb` Prisma model. On write: similarity search at 0.88 threshold — update existing if near-duplicate, insert only if novel. Retrieval threshold: 0.92 for cache hit.

- **T27. Misconception library seeding and detector integration** 📋 [CONTENT] | 🧠 [AI] | 🗄️ [DB]
  - 20+ misconceptions per subject seeded and expert-reviewed. `misconceptionDetector.ts`. On wrong answer: match → set `activeMisconceptionId` in Redis state → inject correction fragment into prompt.

- **T28. Explanation cache** ⚙️ [BE] | 🔧 [INFRA]
  - Redis key `cache:exp:{conceptId}:{lang}:{modality}`. 7-day TTL. Key includes `contentVersion` to invalidate on chunk updates. Cache hit < 500ms.

---

#### Week 6 — Student Gating, Learning Plan & Freemium UX

- **T29. Global profile completeness guard** ⚙️ [BE] | 🎨 [FE]
  - `lib/student/profileGuard.ts`. Wire into `app/(student)/layout.tsx`. Render `ProfileCompletionGate` overlay (Domain 5 spec) until `isProfileComplete` returns true.

- **T30. Global parent OTP enforcement** ⚙️ [BE] | 🎨 [FE]
  - Wire `accountStatus = PENDING_PARENT_VERIFY` check into student layout. Full-screen `ParentOTPGate` overlay (Domain 5 spec). Priority over `ProfileCompletionGate`.

- **T31. Diagnostic hard gate on all session entrypoints** ⚙️ [BE] | 🎨 [FE]
  - `hasDiagnosticForSubject()` at server load time on all session entry routes. Redirect to diagnostic start if not complete.

- **T32. Grade immutability — server‑side strip** ⚙️ [BE]
  - Strip `grade` from `PATCH /api/student/profile` and `POST /api/user/onboarding` unconditionally. UI read-only.

- **T33. Learning plan models & generator** 🗄️ [DB] | ⚙️ [BE] | 🔁 [WORKER]
  - `LearningPlan` + `LearningPlanItem` models. Generator reads `StudentConceptState.masteryScore` for weak-first ordering. Dependency: item 17 must be complete.

- **T34. "Today's Plan" widget** 🎨 [FE] | ⚙️ [BE]
  - `TodaysLearningCard`. API: `GET /api/student/learning-plan/today` per Domain 7 Section 7.5. Fallback to `getNextAction` if no plan item for today.

- **T35. ExamReadinessScore computation & surfacing** 🔁 [WORKER] | ⚙️ [BE] | 🎨 [FE]
  - Simplified proxy at launch (weighted chapter mastery average). API: `GET /api/student/readiness/[subjectId]` per Domain 7 Section 7.8. Dashboard readiness rings + subject detail page.

- **T36. Prompt evaluation harness** 🧠 [AI] | 🔧 [INFRA]
  - `tests/ai/tutor/*.test.ts`. 20+ scenarios including adversarial inputs. Assert no direct answers, valid tags, safety rules. Wire into CI/CD as required gate — failing eval blocks deploy to `main`.

---

#### Week 7 — Structured Consent & Parent Baseline

- **T37. Structured consent record (DPDP‑style)** 🗄️ [DB] | ⚙️ [BE] | 👤 [HUMAN]
  - `Consent` Prisma model: scopes, timestamps, IP, withdrawal endpoint. Legal review of consent copy required.

- **T38. Parent as distinct actor + routing** 🗄️ [DB] | ⚙️ [BE] | 🎨 [FE]
  - `ParentProfile` model or `role` field on `User`. Separate `app/(parent)/**` shell. `ParentChild` relation. Parents cannot access student session transcripts.

- **T39. Parent read‑only progress dashboard** ⚙️ [BE] | 🎨 [FE]
  - API: `GET /api/parent/progress` per Domain 7 Section 7.10. UI: `ParentDashboard` as specified in Domain 5 Section 5.1.

---

#### Week 8 — Controlled Rollout, Cost Guardrails & Final Safety

- **T40. Multi‑tier LLM router & circuit breaker** 🧠 [AI] | 🔧 [INFRA]
  - `lib/ai/tutor/modelRouter.ts`. Redis-backed circuit breaker (not in-memory). Anthropic failover. Tier 1: GPT-4o. Tier 2/3: GPT-4o-mini.

- **T41. Staged rollout & kill switch wiring** 🔧 [INFRA] | 🗄️ [DB]
  - Enable AI Tutor for 5% CBSE Grade 10 cohort via `StudentFeatureFlag`. `ENABLE_AI_TUTOR=false` reverts everyone to v1 session flow immediately.

- **T42. Daily tutor cost metric & alert process** 🔧 [INFRA] | 🔁 [WORKER]
  - `reportingWorker.ts`. Daily `costUsd / sessions` aggregate from `AITutorTurnLog`. Manual alert playbook when > ₹0.25/session. On-call alias receives alert.

- **T43. Distress copy review & final safety QA** 👤 [HUMAN] | 🔴 [SAFETY]
  - Counsellor signs off on: distress response copy, parent notification copy, edge-case safety behaviours. **Only after sign-off**: set `ENABLE_DISTRESS_DETECTION=true`. This is a hard gate — T15 is not complete until T43 is done.

---

### ONE NON‑NEGOTIABLE PEDAGOGICAL RULE

> **The AI must never give a direct answer to a practice problem.**

This is the core product differentiator. If students discover they can simply type "What's the answer?" and get it:

- The product becomes a **homework cheating tool**.
- Parents and teachers lose trust immediately.
- Students who want to learn lose the sense that struggle is part of the design.

Therefore:

- `PEDAGOGICAL_RULES` layer **encodes this as Rule #2**, clearly and unambiguously.
- Tested against **50+ adversarial inputs** pre-launch (not 20).
- Wired into T36 prompt eval harness — failing this assertion blocks deploy.
- Sampled in weekly session quality reviews post-launch.
- Monitored: alert if % of practice-stage turns ending with `[QUESTION]` or `[HINT_OFFER]` drops below threshold for a day.

Everything else can be iterated post-launch. **This rule cannot be walked back once students learn to exploit it.**

---

### Summary

- This document captures the **essential v2 gaps** relative to current v1 and their **severity** for launch, across 7 domains: AI Engine, Student, Parent, Admin, Frontend Components, UX Flows, and API Contracts.
- Every ticket in the execution plan carries a **role tag** to prevent engineers working outside their domain.
- Weeks **1–3** establish a safe, feature-flagged, kill-switch-protected AI Tutor core loop.
- Weeks **4–6** build the knowledge model, assessment, and student UX.
- Weeks **7–8** complete parent actor, controlled rollout, and final safety sign-offs.

All teams (product, engineering, safety, content) treat this file as the **pre-launch contract**. Any change in priorities must be reflected here first.
