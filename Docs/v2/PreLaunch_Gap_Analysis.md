AI HOME TUTOR PLATFORM  
Pre‑Launch Gap Analysis & Execution Plan  
v1 (What Exists) vs v2 Spec (What’s Required)

---

### 0. Framing

**Goal**: Identify only the gaps that block a **paying student** from having a **safe, functional, non‑embarrassing** experience with the AI Tutor and student product, and map them to a concrete **Week 1–3 execution plan** on the current v1 codebase.

**Legend**

- 🔴 **BLOCKER** — Cannot go live without this. Legal, safety, or core product failure.
- 🟠 **CRITICAL** — Severe UX degradation. Students will churn in first week.
- 🟡 **IMPORTANT** — Notable quality gap. Acceptable at launch only if mitigated.
- 🟢 **DEFER** — Real gap but genuinely post‑launch. Does not affect first 1K users.

---

### DOMAIN 1 — AI TUTOR ENGINE

#### 1.1 Teaching Engine & Session State Machine

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Per‑turn AI teaching loop | No dedicated AI loop in sessions. Content engine generates notes/questions in workers only. Sessions consume pre‑generated content. | `POST /api/tutor/turn` — full per‑turn Socratic dialogue engine backed by orchestrator and state machine. | 🔴 BLOCKER |
| 7‑stage pedagogical state machine | 5‑phase session shell (`OVERVIEW` / `EXPLANATION` / `PRACTICE` / `TEST` / `HOMEWORK`). No per‑turn stage transitions. No machine‑readable tags. | Hook → Prerequisite Bridge → Core Explanation → Worked Example → Guided Practice → Independent Practice → Consolidation. Tag‑driven transitions only. | 🔴 BLOCKER |
| Redis session state per turn | DB is source of truth (`StructuredSession`). Redis not used for per‑turn pedagogy. | Redis session state written synchronously on every turn. Full `RedisSessionState` schema. 24h TTL. | 🔴 BLOCKER |
| Socratic dialogue rules | AI behaves as chatbot/enhanced tutor. No hard contracts enforced. | One question per turn. Never direct answers to practice problems. Partial‑credit acknowledgement. “I don’t know” pivots to prerequisite probes. Enforced via `PEDAGOGICAL_RULES` prompt layer. | 🔴 BLOCKER |
| Machine‑readable tag system | Does not exist. | All 7 tags: `[QUESTION]`, `[VALIDATE]`, `[HINT_OFFER]`, `[STAGE_ADVANCE]`, `[PREREQ_FAIL]`, `[STRUGGLE_DETECTED]`, `[MASTERY_CONFIRMED]`. Parser strips tag before delivery to student. | 🔴 BLOCKER |
| 3‑tier hint system | No structured hint system. | Tier 1 (directional nudge) → Tier 2 (structural hint) → Tier 3 (worked scaffold). Explicit student request. 90s inactivity prompt. Hint counter visible. | 🟠 CRITICAL |
| Prerequisite remediation sub‑flow | No prerequisite‑triggered remediation. | Two failed exits at same stage → `[PREREQ_FAIL]` → short remediation loop on prerequisites → return to failed stage. | 🟠 CRITICAL |
| Misconception library (seeded) | No misconception library or detection. | Minimum 20 misconceptions per subject (CBSE 10 Maths + Science) with regex patterns and contrastive explanations. `StudentMisconception` table. | 🟠 CRITICAL |
| Frustration/fatigue signal scoring | Not implemented. | Weighted score over: consecutive errors, hints used, negative language, latency ratio. Threshold e.g. 0.60 → `FRUSTRATED` state. Response tone adaptation. Not visible to student. | 🟡 IMPORTANT |
| Session summary compression | Not implemented. | Every 10 turns: GPT‑4o-mini compresses all but last 8 turns into `sessionSummary`. Last 8 kept verbatim. | 🟡 IMPORTANT |
| Concurrent session prevention | Not implemented. | Redis key check on session start; second device sees “resume / view summary” but can’t run parallel full sessions. | 🟢 DEFER |
| 90‑minute session cap | Not implemented. | Hard 90‑min cap: AI ends session with summary + plan; further work starts a new session. | 🟢 DEFER |

#### 1.2 Prompt Assembly

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| 7‑layer prompt stack | Basic subject system prompts. No layering or token budget. | PERSONA → SAFETY → PEDAGOGICAL_RULES → STUDENT_PROFILE → SESSION_STATE → CURRICULUM_CONTEXT → RESPONSE_FORMAT. Priority‑ordered truncation, 16K total, 4K reserved for output. | 🔴 BLOCKER |
| PERSONA layer (Vidya) | Subject‑specific “you are a tutor” prompts; no named persona or graded tone. | Vidya persona: tone by grade band; emphasise coaching (not answering); Indian‑context analogies; accepts code‑switching. | 🔴 BLOCKER |
| PEDAGOGICAL_RULES layer | Absent as a fixed layer; only soft suggestions. | 7 non‑negotiable rules encoded as **never‑truncated** system prompt section. | 🔴 BLOCKER |
| STUDENT_PROFILE layer | Not assembled per turn. | Inject: name, grade, board, exam date proximity, teaching language, learning style, recent misconceptions, basic mastery summary, emotional state. | 🔴 BLOCKER |
| SESSION_STATE layer | Not implemented. | Current stage, stage attempt count, hints used, last 8 turns (summary or raw), `sessionSummary`, active misconception, frustration score. | 🔴 BLOCKER |
| Token budget management | Not implemented. | Truncation policy: drop RAG chunks first, then oldest summary sentences; never truncate PERSONA/SAFETY/PEDAGOGICAL_RULES. | 🟠 CRITICAL |
| Provider prefix caching | Not implemented. | Fixed layers identical across calls → rely on OpenAI prefix caching for 30–40% input token cost reduction. | 🟡 IMPORTANT |

#### 1.3 Knowledge Graph & IRT

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| `StudentConceptState` table | Only topic‑level (`StudentTopicMastery`, `StudentTopicProgress`). | Per‑student, per‑concept state: `masteryScore`, `masteryVariance`, `theta`, `stability`, `retention`, `nextReviewAt`, `attemptCount`, `lastInteraction`. | 🔴 BLOCKER |
| IRT theta update per answer | Heuristic difficulty bands only. | MAP estimation using 3PL logistic model per subject. Bounded `Δtheta`. | 🔴 BLOCKER |
| Knowledge graph bootstrap from diagnostic | Diagnostic outputs topic/chapter insights only. | On diagnostic completion → BullMQ job → `StudentConceptState` seeded for **all** concepts in subject (tested + untested). | 🔴 BLOCKER |
| Concept taxonomy fields | Taxonomy exists; `irt_b`, bloom, prereqs, commonly-confused likely incomplete. | Every concept for launch slice: `irt_b`, `bloomLevel`, `prerequisiteConceptIds[]`, `commonlyConfusedWithIds[]`, `description`. | 🔴 BLOCKER |
| Prerequisite graph edges | Not modelled. | `prerequisiteConceptIds[]` drives: learning plan unlock, pre‑session warnings, `PREREQ_FAIL` remediation targets. | 🟠 CRITICAL |
| Adaptive question selection by theta | Difficulty bands; not theta‑optimised. | Target difficulty `b* = theta`; select questions with `|irt_b - b*| < 0.3` and high Fisher Information. | 🟠 CRITICAL |
| Incremental graph update pipeline | Not implemented. | Answer event → IRT update → mastery recompute → prereq cascade → retention update → Postgres write → Redis cache invalidation. | 🟠 CRITICAL |
| SM‑18 spaced repetition | Not implemented. | For each concept: `R = e^(−t/S)`; if `R < 0.85` → due. Nightly scheduler populates revision queue and updates `nextReviewAt`. | 🟠 CRITICAL |

#### 1.4 RAG Pipeline

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Curriculum chunks with `concept_ids[]` | Ingestion + pgvector exist; tagging completeness unknown. | Every content chunk tagged with `conceptIds[]` for launch slice. | 🔴 BLOCKER |
| Per‑turn RAG retrieval | Used primarily in content engine (notes/questions). | Every teaching turn: embed concept context + summary → pgvector query → rerank by concept/board → top chunks injected into `CURRICULUM_CONTEXT`. | 🟠 CRITICAL |
| `doubt_kb` table + pgvector | Not implemented. | `doubt_kb` table with embeddings; ivfflat index; similarity search used for repeated doubts. | 🟠 CRITICAL |
| Explanation cache | Not implemented. | Redis `cache:exp:{conceptId}:{lang}:{modality}`; 7‑day TTL; served for explanation‑style calls. | 🟡 IMPORTANT |
| Groundedness checking | Not implemented. | Check factual claims against retrieved chunks; low‑groundedness responses logged to analytics. | 🟡 IMPORTANT |

#### 1.5 LLM Router & Failover

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Multi‑tier model routing | `callLLM.ts` routes models by `promptType` for content. | `CallRouter` service with tiers by `callType` (teach/practice/diagnostic/eval/embed); centralised. | 🟠 CRITICAL |
| Anthropic failover + circuit breaker | Not implemented. | Redis‑backed breaker: 3 failures / 30s → circuit open; re‑probe after 60s; failover to Anthropic models where configured. | 🟠 CRITICAL |
| `AITutorTurnLog` table | `AIContentLog` exists for content; no per‑turn tutor log. | New table: `sessionId`, `callType`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `latencyMs`, `tag`, `stage`, `safetyFlagged`, `cached`, `ragChunksUsed`, `frustrationScore`. | 🟠 CRITICAL |

#### 1.6 Safety Layer

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| PII redaction | Only profanity/offensive filters in some paths. | Redact Indian mobiles, emails, Aadhaar‑style patterns before any LLM call; continue with cleaned text. | 🔴 BLOCKER |
| Jailbreak/prompt injection detection | Not implemented. | Strip/neutralise known injection patterns; log `safety_event`; after 3 attempts, flag account for admin review. | 🔴 BLOCKER |
| Emotional distress detection + parent notification | Not implemented. | Detect distress keywords/sentiment; respond supportively; log `safety_event`; notify parent (email/SMS) within a defined SLA; flag for admin review. | 🔴 BLOCKER |
| Age‑appropriate output classifier | Not implemented. | Scan tutor output; block/regenerate unsafe NSFW/violent content; log safety event. | 🔴 BLOCKER |
| `safety_event` table | Not present. | Table: `id`, `triggerType`, `sessionId`, `turnId`, `studentId`, `severity`, `createdAt`, `resolvedAt`, `resolution`. | 🟠 CRITICAL |
| Jailbreak attempt counter | Not tracked. | Count of jailbreak attempts per student over last N days; threshold → soft suspension / review. | 🟡 IMPORTANT |

---

### DOMAIN 2 — STUDENT ACTOR

#### 2.1 Onboarding & Gating

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Parent OTP enforcement (global) | OTP routes exist; enforcement patchy. | `accountStatus = PENDING_PARENT_VERIFY` blocks **all** learning routes until verified; overlay/banner everywhere in student shell. | 🔴 BLOCKER |
| Profile completeness gate (global) | Some routes guarded; inconsistent. | Board + Grade + Medium + ≥1 subject mandatory before any learning features; overlay‑style gate to avoid redirect loops. | 🔴 BLOCKER |
| Diagnostic hard gate per subject | Some entrypoints enforce; not universal. | At all session entrypoints: `hasDiagnosticForSubject()`; if no completed diagnostic → redirect to diagnostic start/resume. | 🔴 BLOCKER |
| Grade immutability | Partially enforced on some APIs. | Server‑side: strip `grade` from all student‑facing profile updates; only admin/grade‑change requests can modify. | 🟠 CRITICAL |
| `BoardSubjectConfig` seed | Unknown completeness. | Core subjects flagged and seeded per board+grade; 6‑subject cap; locked core subjects. | 🟠 CRITICAL |
| `concept.description` | Likely incomplete/null for many concepts. | Non‑empty for launch slice; used in prompts and UIs. | 🔴 BLOCKER |

#### 2.2 Learning Plan

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| `LearningPlan` / `LearningPlanItem` | Not implemented. | Plan from diagnostic gaps + syllabus; weak‑first ordering; mandatory board topics locked; exam date drives duration. | 🟠 CRITICAL |
| “Today’s Plan” widget | Driven by `getNextAction`, not plan. | `TodaysLearningCard` reads from `LearningPlanItem` (`weekNumber = currentWeek`, `status = UPCOMING`) as primary CTA. | 🟠 CRITICAL |
| Weekly plan adjustment job | Not implemented. | Sunday nightly BullMQ job adjusting plan based on completion; behind → weak chapters sooner, ahead → enrichment. | 🟡 IMPORTANT |
| Exam date + weekly hours capture | Not implemented. | Profile setup step capturing exam date or “no exam” and weekly hours; drives plan horizon and urgency. | 🟠 CRITICAL |

#### 2.3 Session Flow

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Pre‑session prerequisites screen | Not implemented. | Pre‑session modal: topic, estimated duration, prerequisite mastery; unmet prereqs show amber warnings with “Study Prerequisite First” / “Continue Anyway”. | 🟠 CRITICAL |
| Interrupted session handling | Not implemented. | On entry when incomplete session < 24h: bottom sheet with “Resume / Restart / Skip” plus stage/time context. | 🟠 CRITICAL |
| Auto‑save & crash resilience | DB only; no strict “per turn” contract. | Redis write every turn; Postgres write every 5 turns; sessions recoverable after reload; no progress loss beyond last few seconds. | 🔴 BLOCKER (data loss) |
| Latency SLO | Baseline unknown. | Session load \< 3s; first AI message \< 5s. Pre‑generate Hook stage while pre‑session screen is shown. | 🟠 CRITICAL |

#### 2.4 Assessment, Revision, Readiness

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| 4‑gate question generation | Basic schema validation; no solvability/dup/reading‑level checks. | Gate 1: schema; Gate 2: independent solver check; Gate 3: semantic dedup vs 90 days; Gate 4: reading level band. | 🟠 CRITICAL |
| Semantic dedup for questions | Not implemented. | Embedding similarity threshold (e.g. 0.85) vs student’s last 90 days of questions. | 🟠 CRITICAL |
| Error‑typed feedback on wrong answers | Generic incorrect feedback. | Each wrong answer shows worked solution + error type label (sign, formula, reasoning, unit, etc.). | 🟠 CRITICAL |
| Timed chapter tests | Timing behaviour unknown/inconsistent. | Visible countdown; auto‑submit at 0; confirmation if unanswered questions remain on manual submit. | 🟡 IMPORTANT |
| Score \< 40% → revision plan | Not implemented. | Automatic insertion of revision items into `LearningPlanItem` for the next 24–48h. | 🟡 IMPORTANT |
| ExamReadinessScore | Not implemented. | At launch, a simplified readiness proxy (e.g. weighted chapter mastery average) is acceptable; full Weighted mastery × `BoardChapterWeight` with predicted score range can follow once the knowledge model is stable. | 🟡 IMPORTANT |
| SM‑18 revision cards | Not implemented. | 5‑question revision sessions per due concept; `nextReviewAt` scheduling; 20‑minute daily cap. | 🟠 CRITICAL |
| Question flagging & quarantine | Partial plumbing; not fully wired. | `QuestionFlag` table; 3 flags → `QUARANTINED` status; quarantined questions excluded from serving. | 🟡 IMPORTANT |

#### 2.5 Engagement & Retention

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Streak definition | Exists; rules may be loose (e.g. any activity). | “Active day” = full session completion (all 7 stages) OR ≥10 revision cards; enforced server‑side only. | 🟠 CRITICAL |
| Streak shield | Not implemented. | One shield per calendar month; auto‑activates on first missed day; resets monthly; surfaced clearly in UI. | 🟡 IMPORTANT |
| XP system & levels | Only basic mechanics. | `StudentXP`, `XPEvent`, `LevelConfig` with level 1–100; XP earns from sessions/tests; level‑up overlay. | 🟠 CRITICAL |
| Badge system | Not implemented. | `Badge`, `StudentBadge` models; event‑driven awarding; 5‑slot showcase; overlay on earn. | 🟡 IMPORTANT |
| Session completion summary | Minimal. | XP animation; stats (questions, duration, mastery delta, concepts); AI personalised insight; star rating; “Start next session” CTA. | 🟠 CRITICAL |
| Student dashboard | Streaks + weak/upcoming topics exist. | Dashboard shows readiness per subject, revision due today, XP this week, Today’s Plan — all within \< 2s. | 🟠 CRITICAL |
| Progress report screen | Not dedicated. | `/progress` page: 30‑day sessions chart, mastery bars, test history, heatmap, AI narrative; optional PDF. | 🟡 IMPORTANT |
| Exam crunch mode | Not implemented. | Special dashboard mode ≤ 14 days to exam: banner, countdown, focus CTA, minimal distractions. | 🟡 IMPORTANT |

#### 2.6 Subscriptions & Payments

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Freemium session caps | Free caps on `/api/chat`; not session‑level. | `FreeTierUsage` per subject; 3 AI tutor sessions/month/subject; enforced **before** session start; never mid‑session. | 🔴 BLOCKER |
| Freemium upgrade gate UI | Not implemented. | Full `FreemiumUpgradeGate` component: explains cap, shows remaining sessions, offers upgrade CTA. | 🟠 CRITICAL |
| Full INR subscription flow | Payments exist; not aligned with v2 pricing UX. | PlanSelector (Monthly/Quarterly/Annual, GST, savings), PaymentMethodSelector (UPI first), PaymentConfirmation (scroll‑to‑accept), Razorpay order + verify endpoints. | 🟠 CRITICAL |
| Referral programme | Not implemented. | Referral codes; referrer gets 1 month free; referred gets 20% off first month; fraud rules. Launch copy in `FreemiumUpgradeGate` must **not** reference referral rewards until this is implemented. | 🟢 DEFER |

---

### DOMAIN 3 — PARENT ACTOR

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Parent as distinct actor | Parent represented via fields on `User`. | Separate parent user type; can link up to 3 children; cannot access session chat/transcripts. | 🟠 CRITICAL |
| Structured consent record | OTP implies consent, no formal record. | First‑class consent record: purposes (data processing, AI interaction), timestamps, IP, withdrawal flow. | 🔴 BLOCKER |
| Parent progress dashboard | No dedicated parent dashboard. | Read‑only child view: sessions/time this week, streak, mastery cards per subject, readiness and countdown. | 🟠 CRITICAL |
| Weekly digest | Not implemented. | Weekly email summarising sessions, mastery change, readiness, AI insight; Sunday send. | 🟡 IMPORTANT |
| Milestone alerts | Not implemented. | Email/SMS on key milestones (mastery changes, streaks, readiness drops). | 🟡 IMPORTANT |
| Distress detection → parent notification | Not present. | Distress flagged in session triggers parent notification within defined SLA; integrated with `safety_event`. | 🔴 BLOCKER |
| Parent subscription management | Student‑centric subscription. | Parent‑centric subscription screen: plan, renewal date, invoices, cancel controls. | 🟡 IMPORTANT |

---

### DOMAIN 4 — ADMIN OPERATIONS

| Area | v1 State | v2 Requires | Severity |
| ---- | -------- | ----------- | -------- |
| Concept taxonomy completeness | Hierarchy exists; `irt_b`, bloom, prereqs, confusions may be missing. | Fully seeded taxonomy for CBSE Grade 10 Maths + Science before launch. | 🔴 BLOCKER |
| MVP content readiness | Ingestion pipeline exists; tagging completeness unknown. | For launch slice: all chunks ingested and tagged with `conceptIds[]`; ≥ 5 questions per concept; `irt_b` set. | 🔴 BLOCKER |
| `BoardChapterWeight` | Not present. | Per‑chapter weightings seeded; necessary for readiness computation. | 🟠 CRITICAL |
| Misconception library | Not implemented. | Seeded misconceptions (20+ per subject) reviewed by experts; validated against real answers; low false positives. | 🟠 CRITICAL |
| Prompt evaluation harness | Not implemented. | 20+ canonical test cases per major prompt layer; automated regression checks pre‑deploy. | 🟠 CRITICAL |
| AI tutor session sampling | Ad‑hoc; content logs only. | Random 5% session sampling weekly; quality checklist; metrics over tags + stage completion; manual review cadence. | 🟡 IMPORTANT |
| Per‑student AI feature flag | Not present. | `StudentFeatureFlag` table; `ENABLE_AI_TUTOR` global kill switch; staged rollout by cohort. | 🟠 CRITICAL |
| LLM cost per session | AIContentLog for content; not per session. | Using `AITutorTurnLog`, compute daily cost per session and alert if > target (e.g. ₹0.25). | 🟡 IMPORTANT |
| `safety_event` review queue | Not implemented. | Query/dashboard showing unresolved safety events by severity; distress events escalated within 15 minutes. Until automated alerting exists, distress events must trigger an immediate notification (email/SMS) to a defined on‑call alias that is tested before go‑live. | 🔴 BLOCKER |

---

### CONSOLIDATED PRIORITY LIST — BUILD ORDER

These are the **P0 items** that must be addressed before allowing **any paying students** on the AI Tutor.

#### Week 1 — Foundation & Kill Switches

1. **Taxonomy & Content Readiness (launch slice only)**
   - Seed `irt_b`, `bloomLevel`, `prerequisiteConceptIds[]`, `commonlyConfusedWithIds[]`, and `description` for **CBSE Grade 10 Maths + Science** concepts.
   - Verify that curriculum chunks for this slice are fully ingested with non‑null `conceptIds[]` in pgvector tables.
   - Seed `BoardChapterWeight` for these chapters.

2. **Redis & Infra Guardrails**
   - Verify Redis configuration:
     - Append‑only enabled (durability).
     - Appropriate eviction policy (e.g. `volatile-lru`) for session keys.

3. **Feature Flags & Kill Switches**
   - Introduce `StudentFeatureFlag` model (or reuse system settings) and a global `ENABLE_AI_TUTOR` / similar flag.
   - Wire AI tutor entrypoints (new session, `/api/tutor/turn`) to:
     - Check **global kill switch**.
     - Respect **per‑student flag** for staged rollout.

#### Week 2–3 — AI Tutor Core Loop (The Product)

4. **New Tutor Turn Endpoint**
   - Add `app/api/tutor/turn/route.ts` (or similar) that:
     - Authenticates student, checks feature flags.
     - Loads/initialises `RedisSessionState`.
     - Delegates to orchestrator (prompt assembly + LLM + state machine).
     - Streams response (SSE) while capturing machine tag and updating state.

5. **Upgrade `callLLM` for Tutor Calls**
   - Extend `lib/callLLM.ts` to support:
     - Dedicated `promptType` values for tutor turns (teach, hint, eval).
     - Typed error handling and retry logic.
     - Logging to a new `AITutorTurnLog` Prisma model.

6. **Prompt Assembly: `assembleSystemPrompt`**
   - New module (e.g. `lib/ai/tutor/promptAssembly.ts`) that:
     - Composes all 7 layers (PERSONA, SAFETY, PEDAGOGICAL_RULES, STUDENT_PROFILE, SESSION_STATE, CURRICULUM_CONTEXT, RESPONSE_FORMAT).
     - Implements token budget calculation and ordered truncation.
     - Is unit‑tested in isolation (no LLM call).

7. **Tag Parser & Monitoring**
   - Implement `parseTutorTag(response: string): TutorTag | null` in a dedicated util file.
   - Ensure last line of each AI response contains exactly one tag.
   - Log tag to `AITutorTurnLog.tag`, and create a simple metric for tag distribution (e.g. % of turns with `[QUESTION]`, `[STAGE_ADVANCE]`).

8. **Redis Session State Helpers**
   - Implement `getTutorSession(sessionId)`, `setTutorSession(sessionId, state)`, `updateTutorSession(sessionId, partial)` in `lib/redis/session.ts` or equivalent.
   - Handle:
     - Initial session bootstrapping (HOOK stage).
     - Incomplete turn recovery (e.g. LLM error after question was shown).

9. **Pedagogical State Machine Module**
   - Create `lib/ai/tutor/stateMachine.ts` containing:
     - Stage enum and transition table.
     - `transitionState(state, tag)` pure function (no I/O).
     - 30–40+ unit tests covering all valid/invalid transitions and edge cases (e.g. repeated `[PREREQ_FAIL]`).

10. **Chat Panel Integration**
   - Introduce `AITutorChatPanel` client component that:
     - Renders chat history from `RedisSessionState` (or server API).
     - Streams responses from `/api/tutor/turn`.
     - Hooks into hint button and inactivity timer UI (even if tier logic is basic at first).
   - Integrate into `SessionContainer` during PRACTICE/TEST stages, guarded by feature flag.

11. **Frustration & Emotional State Signals**
   - Implement scoring in orchestrator (e.g. `lib/ai/tutor/signals.ts`):
     - Inputs: consecutive wrong answers, hints used, latency changes, language sentiment.
     - Output: `frustrationScore` ∈ [0,1] and `emotionalState` enum.
   - Inject these values into `SESSION_STATE` and `STUDENT_PROFILE` layers for the LLM.

12. **Safety: PII Redaction & Jailbreak Guard**
   - New module `lib/ai/tutor/safety.ts` that:
     - Redacts obvious PII patterns from student messages before any prompt assembly.
     - Detects common jailbreak/injection strings.
   - If jailbreak/injection is detected:
     - **Do not call the LLM at all** for that turn.
     - Immediately return a safe redirect/refusal response to the student.
     - Log a `safety_event` with appropriate severity.

13. **Safety: Age‑Appropriate Output Filter**
   - Post‑LLM filter that:
     - Scans AI response for unsafe content.
     - If flagged, replaces with a safe, generic explanation and logs `safety_event`.

14. **Safety Events Plumbing**
   - Add `SafetyEvent` (or `safety_event`) model in Prisma.
   - Wire PII/Jailbreak/Distress/UnsafeContent detections to insert events.
   - Add a minimal `/api/admin/safety-events` or SQL view for ops to query unresolved events.

15. **Distress Detection & Parent Notification**
   - Extend safety module to:
     - Detect distress (keywords + sentiment).
     - Trigger:
       - Supportive AI reply to student.
       - `safety_event` with type `distress`.
       - A background job (BullMQ) that sends email/SMS to parent for severe events (once templates are agreed).

#### Week 3 — Misconceptions & Minimal Knowledge Model

16. **`StudentConceptState` & Answer Events**
   - Add initial `StudentConceptState` and `AnswerEvent` Prisma models with minimal fields:
     - `StudentConceptState`: `studentId`, `conceptId`, `masteryScore`, `nextReviewAt`, `lastInteraction`, `attemptCount`.
     - `AnswerEvent`: link to student, concept(s), correctness, questionId, source (diagnostic/session/test).
   - Use simple mastery update heuristic first; leave full IRT for Week 4+.

17. **Diagnostic → Concept Bootstrap (MVP)**
   - After a diagnostic attempt completes:
     - Map chapter/topic to a subset of concepts (even if coarse).
     - Seed/adjust `StudentConceptState` for those concepts with baseline mastery.
   - Implement as a worker job triggered from existing diagnostic completion path.

18. **Misconception Library (Slice)**
   - Add `Misconception` and `StudentMisconception` models for launch subjects.
   - Seed at least a dozen misconceptions per subject for the launch slice.
   - Implement `matchMisconception(answer, conceptId)` using regex patterns and integrate into orchestrator:
     - On wrong answer → try misconception match → if found, set `activeMisconceptionId` and inject correction fragment into prompt.

19. **Basic RAG Hook for Tutor**
   - For the launch slice:
     - Ensure each chunk is tagged with `conceptIds[]`.
     - Implement per‑turn RAG retrieval that:
       - Queries pgvector with concept + a short query string.
       - Injects the **top 4 chunks after reranking** into `CURRICULUM_CONTEXT`.
   - Log chunk IDs used into `AITutorTurnLog` for observability.

20. **Freemium Session Cap Enforcement (Server‑Side)**
   - Add `FreeTierUsage` (or equivalent) table if not already present.
   - On session start (entry into tutor engine):
     - Check free cap per subject.
     - If exhausted → block new session, show `FreemiumUpgradeGate` (UI) instead of starting session.

---
### EXTENDED EXECUTION PLAN — WEEKS 4–8 (CODE‑MAPPED TICKETS)

Below are the remaining items from the original list (Weeks 4–8), expressed as **implementation tickets** with pointers into this codebase. They are still P0 for launch but can follow Weeks 1–3 once the core loop is stable.

#### Week 4 — Full Knowledge Model, IRT & Revision

- **T21. Extend `StudentConceptState` to full v2 schema**
  - **Files**: `prisma/schema.prisma`
  - Add fields: `masteryVariance`, `theta`, `stability`, `retention` in addition to the MVP fields from item 16.
  - Run `npx prisma migrate dev` and update any code paths that read/write `StudentConceptState`.

- **T22. Introduce `AnswerEvent` and IRT update worker**
  - **Files**: `prisma/schema.prisma`, `worker/services/irtWorker.ts` (new), `lib/ai/tutor/irt.ts` (new); wiring in:
    - `app/api/tests/submit/route.ts`
    - Tutor answer handling in `/api/tutor/turn`
  - Persist per‑answer events, then have a BullMQ worker consume them and update `StudentConceptState.theta` + `masteryScore` using MAP 3PL logic.

- **T23. SM‑18 spaced repetition scheduler & revision queue**
  - **Files**: `lib/ai/tutor/spacedRepetition.ts` (new), `worker/services/revisionSchedulerWorker.ts` (new), `prisma/schema.prisma` (ensure `stability`, `retention`, `nextReviewAt`).
  - Nightly job:
    - Compute `R = e^(−t/S)` for concepts.
    - Set `nextReviewAt` and populate a small revision queue.
  - Expose due concepts via `app/api/student/revisions/due-today/route.ts` and surface on the dashboard.

#### Week 5 — RAG, Doubt KB, Misconceptions

- **T24. Ensure curriculum chunks are tagged with `conceptIds[]` for launch slice**
  - **Files**: ingestion workers (`worker/services/syllabusWorker.ts`, `worker/services/notesWorker.ts`), `Docs/AI Content Engine Architecture.md`.
  - For CBSE 10 Maths/Science, backfill `conceptIds[]` on existing chunks and lock in tagging for future runs.

- **T25. Per‑turn RAG retrieval in tutor orchestrator**
  - **Files**: `lib/ai/tutor/orchestrator.ts` (new/extended), `lib/ai/tutor/rag.ts` (new).
  - Implement a helper that:
    - Embeds a short query from current concept + brief history.
    - Queries pgvector for chunks filtered by board/subject/concept.
    - Returns the **top 4 chunks after reranking** to inject into `CURRICULUM_CONTEXT`.
  - Log chunk IDs in `AITutorTurnLog`.

- **T26. `doubt_kb` table & retrieval**
  - **Files**: `prisma/schema.prisma`, `worker/services/doubtKbWorker.ts` (new).
  - Add `DoubtKb` model with text + embedding fields.
  - When the same doubt recurs (or is escalated), persist a curated explanation; have orchestrator consult this store before defaulting to fresh RAG+LLM.
  - On write, run a similarity search at threshold ≈ 0.88; if a near-duplicate exists, update its metadata (e.g. `timesServed`, `alternatePhrasings[]`) instead of inserting a new row. This keeps the KB compact and avoids embedding explosion over time.

- **T27. Misconception library seeding and detector integration**
  - **Files**: `prisma/schema.prisma`, `lib/ai/tutor/misconceptionDetector.ts` (new), `prisma/seeds/misconceptions-math10.ts`, `prisma/seeds/misconceptions-science10.ts`.
  - Seed at least 20 misconceptions per subject for the launch slice.
  - In tutor orchestrator, on wrong answer:
    - Call `matchMisconception`.
    - If match: create `StudentMisconception`, set `activeMisconceptionId` in Redis state, inject correction fragment + contrastive example into prompt.

- **T28. Explanation cache for expensive explanation stages**
  - **Files**: `lib/redis/cache.ts` (new), `lib/ai/tutor/orchestrator.ts`.
  - Add Redis helpers for `cache:exp:{conceptId}:{lang}:{modality}` with 7‑day TTL.
  - For Core Explanation / Worked Example stages, check cache before LLM; write to cache on miss.

#### Week 6 — Student Gating, Learning Plan & Freemium UX

- **T29. Global profile completeness guard**
  - **Files**: `lib/student/profileGuard.ts`, `app/(student)/layout.tsx`.
  - Wire a single `isProfileComplete` check into the student layout and render `ProfileCompletionGate` overlay on all student routes until complete.

- **T30. Global parent OTP enforcement**
  - **Files**: `app/api/auth/parent/send-otp/route.ts`, `app/api/auth/parent/verify-otp/route.ts`, `app/(student)/layout.tsx`, `prisma/schema.prisma` (confirm `accountStatus`/`parentVerified`).
  - Ensure `accountStatus = PENDING_PARENT_VERIFY` blocks all learning experiences in the student layout (full-page banner with CTA to verify).

- **T31. Diagnostic hard gate on all session entrypoints**
  - **Files**: `app/(student)/session/[topicId]/page.tsx`, any other “start session” pages that deep‑link into sessions, `lib/student/diagnostic.ts`.
  - Use `hasDiagnosticForSubject` at server load time to redirect to diagnostic start/resume when needed, so no path bypasses the gate.

- **T32. Grade immutability — final server‑side strip**
  - **Files**: `app/api/user/onboarding/route.ts`, `app/api/student/profile/route.ts`.
  - Remove `grade` from allowed update payloads (even if present in body); keep UI read‑only; require grade‑change request flow instead.

- **T33. Learning plan models & generator**
  - **Files**: `prisma/schema.prisma`, `app/api/student/learning-plan/generate/route.ts` (new), `lib/ai/learningPlan.ts`, `worker/services/learningPlanWorker.ts`.
  - Implement `LearningPlan` + `LearningPlanItem` as per v2 and generate per‑subject plans from diagnostic + exam date + weekly hours.
  - **Dependency**: must run after at least the MVP `StudentConceptState` bootstrap (item 17) so it can use `masteryScore` for weak‑first ordering. If mastery is missing/at prior, still generate but log a warning that diagnostic data is incomplete.

- **T34. “Today’s Plan” widget wired to `LearningPlanItem`**
  - **Files**: `components/student/TodaysLearningCard.tsx`, `app/(student)/dashboard/page.tsx`, `app/api/student/learning-plan/today/route.ts` (new).
  - Have the dashboard CTA read from the first UPCOMING `LearningPlanItem` for today (with sensible fallback to `getNextAction` if plan missing).

- **T35. ExamReadinessScore computation & surfacing**
  - **Files**: `prisma/schema.prisma` (add `ExamReadinessScore`), `lib/ai/readinessScore.ts`, `worker/services/readinessWorker.ts`, `app/api/student/readiness/[subjectId]/route.ts`, dashboard components.
  - Compute readiness from `StudentConceptState` × `BoardChapterWeight` and display:
    - Subject score ring on dashboard.
    - Chapter breakdown on a per‑subject readiness page.

- **T36. Prompt evaluation harness**
  - **Files**: `tests/ai/tutor/*.test.ts`, `package.json` (`"test:ai-tutor"` script), `Docs/AI_PIPELINE_RULES.md`.
  - Encode 20+ scenarios (including adversarial prompts) and assert:
    - No direct answers to practice questions.
    - Tags are present and valid.
    - Safety rules (PII, jailbreak, age‑appropriateness) are respected in mock mode.
  - Wire this harness into CI/CD as a required gate for any change touching `lib/ai/tutor/promptAssembly.ts`, `lib/ai/prompts/**`, or other tutor prompt files. Failing eval should block merges to `main` and deploys.

#### Week 7 — Structured Consent & Parent Baseline

- **T37. Structured consent record (DPDP‑style)**
  - **Files**: `prisma/schema.prisma` (new `Consent` model), `app/api/parent/consent/route.ts` (new), student/parent onboarding flows.
  - Capture consent scopes (data processing, AI tutoring, etc.) with timestamps and IP; expose a simple “view consent” section in parent settings and a withdrawal endpoint.

- **T38. Parent as distinct actor + routing**
  - **Files**: `prisma/schema.prisma` (role field on `User` or separate `ParentProfile`), `lib/auth.ts`, new `app/(parent)/**` routes.
  - Ensure parents sign in to a separate shell and never see tutor transcripts; implement child switching via a `ParentChild` relation or equivalent.

- **T39. Parent read‑only progress dashboard**
  - **Files**: `app/(parent)/dashboard/page.tsx` (new), `app/api/parent/progress/route.ts` (new).
  - API aggregates sessions/time this week, streak, top subjects with mastery %, readiness + exam countdown for each linked child; UI presents it in simple language.

#### Week 8 — Controlled Rollout, Cost Guardrails & Final Safety

- **T40. Multi‑tier LLM router & circuit breaker**
  - **Files**: `lib/ai/tutor/modelRouter.ts` (new), `lib/callLLM.ts`, Redis helpers.
  - Factor model selection into its own module keyed by callType; implement Redis‑backed circuit breaker and, if configured, Anthropic failover.

- **T41. Staged rollout & kill switch wiring**
  - **Files**: `prisma/schema.prisma` (`StudentFeatureFlag`), `lib/features.ts` (new), tutor entrypoints (new `/api/tutor/turn`, session start logic).
  - Roll AI Tutor out to a small cohort (e.g. 5% of CBSE 10) by student flag; ensure flipping `ENABLE_AI_TUTOR=false` reverts everyone to the current v1 session flow.

- **T42. Daily tutor cost metric & alert process**
  - **Files**: `worker/services/reportingWorker.ts` (new), `AITutorTurnLog` consumer, ops docs.
  - Compute daily aggregate `costUsd / sessions` and log results; define a manual alert playbook when exceeding target range (e.g. ₹0.25/session), even if initial alerts are run via queries/scripts.

- **T43. Distress copy review & final safety QA**
  - **Files**: Safety prompt templates (`lib/ai/prompts/safety.ts` or equivalent), `Docs/AI_PIPELINE_RULES.md`.
  - Have qualified reviewers sign off on:
    - Distress responses.
    - Parent notification copy.
    - Edge‑case safety behaviours (jailbreak attempts, inappropriate content).

---

### ONE NON‑NEGOTIABLE PEDAGOGICAL RULE

> **The AI must never give a direct answer to a practice problem.**

This is the core product differentiator. If students discover they can simply type “What’s the answer?” and consistently get final numeric/text answers:

- The product collapses into a **homework cheating tool**.
- Parents and teachers will lose trust quickly.
- Students who genuinely want to learn will lose the sense that struggling is part of the design.

Therefore:

- The **PEDAGOGICAL_RULES** layer **must** encode this as Rule #2, clearly and unambiguously.
- It must be:
  - Tested against **dozens of adversarial inputs** pre‑launch.
  - Sampled in weekly session quality reviews.
  - Monitored via metrics (e.g. percentage of practice responses that end with `[QUESTION]` or `[HINT_OFFER]` vs direct answers).

Everything else can be iterated post‑launch. **This rule cannot be walked back once students learn to exploit it.**

---

### Summary

- This document captures the **essential v2 gaps** relative to current v1 and their **severity** for launch.
- Weeks **1–3** of the execution plan focus exclusively on:
  - Establishing a **safe**, **feature‑flagged**, **kill‑switch protected** AI Tutor core loop.
  - Implementing the **pedagogical state machine**, **prompt layering**, and **safety systems**.
  - Wiring a **minimal knowledge model** and **misconception/RAG hooks** sufficient for a credible launch slice.

All teams (product, engineering, safety, content) should treat this file as the **pre‑launch contract** for the AI Tutor experience. Any change in priorities should be reflected here first.

