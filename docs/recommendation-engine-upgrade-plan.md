# Recommendation Engine: Analysis & Upgrade Plan

**Purpose:** Analyse the current recommendation system and define a plan to align it with the new session-centric architecture (StructuredSession, phases, content readiness, curriculum graph) — **analysis and plan only; no code changes in this document.**

---

## 1. Current State Summary

### 1.1 Components

| Component | Location | Role |
|-----------|----------|------|
| **RecommendationEngine** | `lib/recommendations/engine.ts` | Multi-signal scoring over 6 content sources; outputs a **list** of up to N items (lesson, practice, notes, test) with type-balanced diversity. |
| **TopicRanker** | `lib/recommendations/topicRanker.ts` | Returns **one** “next topic” using CurriculumGraph, weak topics, curriculum-next, incomplete sessions, prerequisites; Redis-cached; feature-flagged. |
| **getNextAction** | `lib/homeEngine/getNextAction.ts` | Returns **one** next action by priority: P1 resume LearningSession → P2 DailyTask → P3 AttentionFlag → P4 low StudentTopicMastery → P5 next new topic. Rule-based, no scoring. |
| **Dashboard recommendations API** | `app/api/dashboard/recommendations/route.ts` | Calls engine (limit 15); on empty, uses **getFallbackRecommendations** (incomplete LearningSession, weak TestResult, next topic, first topic). |
| **Fallback** | Same route (inline) | Queries **LearningSession** (incomplete), **TestResult** (weak), **GeneratedTest** + topic, then **getOrderedTopicsForStudent** for “next in sequence” and “first topic”. |

### 1.2 Data Sources Used by Recommendation System

- **Engine candidates:** ContentCatalog, ChapterDef, Question, Note, TopicNote, GeneratedTest.
- **Engine signals:** User (board, grade, language, subjects), StudentLearningProfile (weakSubjects), TestResult + AttemptQuestions, **LearningSession** (incomplete, recency, activityType, meta), ContentRecommendation (shown/clicked/completed/ignored), completed content/topic sets.
- **TopicRanker:** User, StudentLearningProfile, **StudentTopicProgress**, **LearningSession** (incomplete, recency), **CurriculumGraph** (order + arePrerequisitesMet), getWeakTopicIds, computeMomentumScore.
- **getNextAction:** **LearningSession** (P1), DailyTask (P2), AttentionFlag (P3), **StudentTopicMastery** (P4), **getOrderedTopicsForStudent** (P5).
- **Fallback:** LearningSession, TestResult, GeneratedTest, TopicDef, getOrderedTopicsForStudent.

### 1.3 New System Architecture (Target)

- **StructuredSession** is the source of truth for “a learning session on a topic” with phases: OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE.
- **SessionEngine** (`lib/session/sessionEngine.ts`) starts/resumes/advances sessions; **getPhaseContent** resolves content per phase (TopicNote, Question, GeneratedTest, HomeworkAssignment).
- **ContentReadinessService** gates session start: topic must have notes + practice questions + test (READY or PARTIAL).
- **PhaseCompletionValidator** defines what “done” means per phase (e.g. explanation viewed, practice ≥1, test submitted, homework submitted).
- **LearningSession** is **bridged** from StructuredSession (create/touch/complete) so existing recommendation and home-engine logic still see “sessions” for recency and resume.
- **CurriculumGraph** provides global curriculum order and **arePrerequisitesMet**; used today by TopicRanker only.
- **getOrderedTopicsForStudent** returns ordered TopicDefs from Prisma (board/grade/subjects, chapter/topic order) — **separate** from CurriculumGraph; used by getNextAction P3/P4/P5 and fallback.

---

## 2. Gap Analysis

### 2.1 Session model: LearningSession vs StructuredSession

- **Current:** Resume signal and fallback use **LearningSession** (incomplete, activityRef, meta). When ENABLE_SESSION_ENGINE=1, the canonical in-progress session is **StructuredSession**; the bridge keeps LearningSession in sync.
- **Gap:** Recommendation engine does not know about **phase**. It can only say “resume notes” or “resume practice” (from activityType). It cannot say “resume at Practice phase” or “resume at Test phase,” and the UI cannot deep-link to the correct phase without loading the session first.
- **Impact:** For session-engine users, “resume” is correct at topic level but loses phase context; list recommendations and fallback do not expose sessionId or currentPhase.

### 2.2 Content readiness

- **Current:** Engine and TopicRanker do **not** filter by ContentReadinessService. A topic can be recommended even if it has no notes or no test.
- **Gap:** Student may click “Start” and hit “content not ready” or partial content.
- **Impact:** Wasted clicks and inconsistent UX with the session engine’s gating (which uses content readiness before starting a session).

### 2.3 Curriculum source duality

- **Current:** **TopicRanker** uses CurriculumGraph (order + prerequisites). **getNextAction** and **fallback** use **getOrderedTopicsForStudent** (Prisma order). **Engine** builds candidates from ChapterDef + topics and does not use CurriculumGraph.
- **Gap:** Two different notions of “curriculum order” and no prerequisite check in engine or getNextAction. Order can diverge if CurriculumGraph is built from a different source than TopicDef ordering.
- **Impact:** “Next topic” from TopicRanker can differ from “next topic” from getNextAction P5 or fallback; engine can suggest topics that violate prerequisites.

### 2.4 Resume semantics and APIs

- **Current:** getNextAction P1 returns sessionId (LearningSession) and actionType (notes/practice). Dashboard recommendations return a list with type and meta (topicId, chapterId, subjectId); no sessionId or phase.
- **Gap:** When ENABLE_SESSION_ENGINE=1, the natural “resume” target is StructuredSession + currentPhase. Today the UI must infer from activityType or load session separately.
- **Impact:** Extra round-trips and no single “resume at phase X” contract for the list or fallback.

### 2.5 Progress and mastery signals

- **Current:** **TopicRanker** uses StudentTopicProgress (mastery, practiceCount) and getWeakTopicIds (mastery &lt; 0.4, practiceCount &gt; 5). **getNextAction** uses StudentTopicMastery (accuracy) and AttentionFlag. **Engine** uses TestResult + weakSubjects and completed ContentRecommendation / completedTopicIds.
- **Gap:** Two progress/mastery concepts (StudentTopicProgress vs StudentTopicMastery). Session engine updates **StudentTopicProgress** on completeSession; TopicRanker and engine do not share a single definition of “weak” or “next.”
- **Impact:** Possible inconsistency between “practice this topic” (TopicRanker / getNextAction) and “here are 15 recommendations” (engine).

### 2.6 Engagement feedback

- **Current:** Engine uses ContentRecommendation (shown/clicked/completed/ignored) in scoring (POSITIVE_ENGAGEMENT_BOOST, NEGATIVE_ENGAGEMENT_PENALTY). Doc “recommendation-engine-optimization.md” had already identified missing feedback loop; part of that is now implemented.
- **Gap:** No feedback from **session completion** or **phase completion** into the recommendation engine (e.g. “completed EXPLANATION + PRACTICE” as a stronger signal than “clicked recommendation”).

### 2.7 Multiple “next” entry points

- **Current:** Dashboard loads both **getNextAction** (single next action) and **recommendations** (list). Separate endpoints: `/api/home/next-action`, `/api/dashboard/recommendations`, `/api/student/next-topic` (TopicRanker), `/api/dashboard/next-topic` (TopicRanker). Fallback only used when engine returns empty.
- **Gap:** No single contract that says “the one thing the student should do next” when session engine is on (resume session at phase X vs start session on topic Y). getNextAction is rule-based and does not consider content readiness or phase.

---

## 3. Upgrade Plan (No Code — Plan Only)

### 3.1 Phase 1: Align with session engine and content readiness

**Goals:** Use StructuredSession when enabled for resume; only recommend topics that are ready (or clearly partial); expose phase/sessionId where applicable.

1. **Resume signal (engine + fallback + getNextAction)**  
   - When ENABLE_SESSION_ENGINE=1: Prefer **StructuredSession** for “incomplete session” over LearningSession.  
   - For the chosen “resume” item, expose **sessionId** and **currentPhase** (OVERVIEW, EXPLANATION, PRACTICE, TEST, HOMEWORK) so the UI can open the session at the right phase.  
   - Keep using the LearningSession bridge for **recency** and **backward compatibility** (e.g. when session engine is off).  
   - Ensure fallback’s “incomplete session” branch uses the same rule: StructuredSession first when enabled, else LearningSession.

2. **Content readiness filtering**  
   - Before adding a topic to candidates (engine) or to “next topic” options (TopicRanker, getNextAction P5, fallback), filter by **ContentReadinessService.isTopicReady**.  
   - Only recommend topics in READY (or optionally PARTIAL with a clear “partial content” label).  
   - Document behaviour when most topics are not ready (e.g. show fewer items or a dedicated “complete your syllabus” message).

3. **Single source for “resume”**  
   - Introduce a small **resume resolver** (or extend existing helper): given studentId, return the single best “resume” session if any (StructuredSession when engine on, else LearningSession), with sessionId, topicId, and when applicable currentPhase.  
   - Use this in: engine (resume boost + candidate), getNextAction P1, fallback step 1, and optionally TopicRanker (incomplete-session boost).  
   - No duplicate logic for “find incomplete session” across engine, fallback, and getNextAction.

### 3.2 Phase 2: Unify curriculum and prerequisites

**Goals:** One curriculum ordering and prerequisite model for recommendations and next-action.

1. **Curriculum source**  
   - Decide single source of truth: either **CurriculumGraph** (already used by TopicRanker) or **getOrderedTopicsForStudent** (Prisma). Recommendation: use **CurriculumGraph** as the canonical order and prerequisite source; ensure it is built from the same TopicDef/ChapterDef data (or document the mapping).  
   - If keeping getOrderedTopicsForStudent for other reasons, ensure its order matches CurriculumGraph or deprecate one.

2. **Engine and getNextAction**  
   - In the **engine**, when building “next topic” or ordering candidates, use **CurriculumGraph** (order + arePrerequisitesMet). Filter out topics whose prerequisites are not met (same as TopicRanker).  
   - In **getNextAction** P5 (and P3/P4 allowedTopicIds), feed topic list from **CurriculumGraph** (or from getOrderedTopicsForStudent only if it is guaranteed to match).  
   - In **fallback**, “next topic in sequence” and “first topic” should use the same curriculum source and prerequisite check.

3. **TopicRanker**  
   - Already uses CurriculumGraph and arePrerequisitesMet; no change except ensuring cache invalidation when StructuredSession is completed (already have invalidateTopicRankerCache from session events).

### 3.3 Phase 3: Progress and mastery alignment

**Goals:** One consistent notion of “weak topic” and “progress” for both list recommendations and single next-action.

1. **Define canonical progress**  
   - Prefer **StudentTopicProgress** as the main progress store for “has started / mastery / practiceCount” if that is what the session engine and TopicRanker use.  
   - **StudentTopicMastery** (accuracy) and **AttentionFlag** can remain for getNextAction P3/P4 (low accuracy, unresolved flags).  
   - Document clearly: TopicRanker “weak” = f(StudentTopicProgress); getNextAction “low accuracy” = StudentTopicMastery; engine “low score” = TestResult. If desired, add a single “weak topic” API (e.g. getWeakTopicIds) used by both TopicRanker and engine.

2. **Session completion as signal**  
   - When a **StructuredSession** reaches COMPLETE, the engine (and TopicRanker) should treat that topic as “completed” for recency and resume (already implied by bridge completion).  
   - Optionally: feed **phase completion** (e.g. “completed PRACTICE”) into engagement or scoring so recommendations can favour “finish TEST” on the same topic over starting a new topic.

### 3.4 Phase 4: API and UX contract

**Goals:** Clear contract for “next best action” and “list” so the dashboard and clients can rely on one model.

1. **Next action contract**  
   - **getNextAction** (or a thin wrapper) becomes the single “next best action” when session engine is on:  
     - P1: Resume **StructuredSession** (sessionId, topicId, **currentPhase**) when engine on; else resume LearningSession (sessionId, topicId, activityType).  
     - P2–P5 unchanged in logic but use curriculum + content readiness from Phases 1–2.  
   - Response shape includes, when applicable: **sessionId**, **currentPhase**, **topicId**, **actionType**, **ruleId**, **reasonLabel**, and any existing fields (e.g. sessionId for resume).

2. **Recommendations list contract**  
   - Engine continues to return a list; ensure each item that is “resume” includes **sessionId** and **currentPhase** when session engine is on.  
   - Ensure at least the first item (or a dedicated “highlight” field) is aligned with getNextAction when it’s a resume, so the UI can show “Continue: Topic X – Phase Y” without a second call.

3. **Optional unified endpoint**  
   - Consider one dashboard endpoint that returns both **nextAction** and **recommendations** (e.g. `GET /api/dashboard/home` or extend existing dashboard payload) so the client gets a consistent snapshot and avoids ordering issues between “next” and “list.”

### 3.5 Phase 5: Observability and tuning

**Goals:** Traces and metrics aligned with the new behaviour; no functional change to scoring logic beyond above.

1. **Trace**  
   - Recommendation trace already exists; add **sessionId** and **currentPhase** (and “resume” flag) to trace when the recommended item is a resume.  
   - TopicRanker already logs; ensure session completion invalidates cache (already done via invalidateTopicRankerCache).

2. **Feature flags**  
   - Keep ENABLE_SESSION_ENGINE and ENABLE_TOPIC_RECOMMENDATION. Document that when session engine is on, resume and content readiness behave as in this plan.

3. **Scoring**  
   - No change to score weights in this plan. Phase 2 of “recommendation-engine-optimization.md” (engagement-based scoring) is already partially in place; any further tuning (e.g. phase-aware boosts) can be a later iteration.

---

## 4. Implementation Order (Summary)

| Phase | Focus | Deliverables (conceptual) |
|-------|--------|----------------------------|
| **1** | Session engine + content readiness | Resume from StructuredSession when enabled; sessionId + currentPhase on resume; content readiness filter on candidates and next-topic paths; single resume resolver. |
| **2** | Curriculum + prerequisites | Use CurriculumGraph (or single source) for order and prerequisites in engine, getNextAction P5, and fallback; align TopicRanker with same source. |
| **3** | Progress alignment | Document and use one weak-topic/progress notion where possible; optionally feed session/phase completion into signals. |
| **4** | API contract | getNextAction returns sessionId + currentPhase for resume; list recommendations include same for resume items; optional unified dashboard endpoint. |
| **5** | Observability | Trace includes sessionId/currentPhase for resume; cache invalidation and flags documented. |

---

## 5. Risks and Mitigations

- **StructuredSession not yet used everywhere:** Mitigate by feature flag and by keeping LearningSession bridge; fallback to LearningSession when session engine is off.  
- **Content readiness too strict:** Mitigate by allowing PARTIAL with clear labelling, and by improving hydration so more topics become READY.  
- **CurriculumGraph vs getOrderedTopicsForStudent divergence:** Mitigate by making CurriculumGraph the single source and either building it from the same Prisma data or documenting and testing the mapping.  
- **Breaking existing dashboard:** Mitigate by additive response fields (sessionId, currentPhase) and by keeping existing list shape; clients that ignore new fields continue to work.

---

## 6. Out of Scope for This Plan

- Changing score weights or adding new signals (e.g. phase-aware boost) beyond the above.  
- A/B tests or ML-based scoring.  
- Notes tab navigation or stub removal (already documented elsewhere).  
- Schema changes (e.g. new tables) unless required for a single resume resolver or curriculum source.

---

*Document version: 1.0. Analysis only; no code changes.*
