# Learning Funnel Analytics — Admin Console Design

**Role:** Senior Product Data Scientist  
**Goal:** Identify where students drop off during learning sessions and quantify conversion across stages.  
**Primary data sources:** `StructuredSession`, `StudentTopicProgress` (and `StructuredSession.meta` + `SessionEvent` where available).  

### Fit to current codebase (recent changes)
- **Practice/Test completion signals are already persisted** into `StructuredSession.meta` by:
  - `POST /api/session/[sessionId]/practice/submit` → `meta.practiceResult.score`
  - `POST /api/session/[sessionId]/test/submit` → `meta.testResult.score`
- **Session lifecycle events exist** via `SessionEvent` (`SESSION_STARTED`, `SESSION_OVERVIEW_VIEWED`, `QUESTION_ANSWERED`, `HOMEWORK_SUBMITTED`, `SESSION_COMPLETED`). These improve funnel accuracy (especially “resume” and “homework completed”).  
- **Recommendation traces are not impressions**: the system currently has observability traces (Redis `RecommendationTrace` and a DB `RecommendationTrace` model), but neither is a guaranteed “shown to user” event. Treat “Recommendation shown” as requiring explicit UI impression instrumentation.

---

## SECTION 1 — Metrics definition

### Funnel stages (canonical)
All metrics are computed for a filterable time window \([from,to]\) in UTC, segmented by board/grade/subject where possible.

1. **Recommendation shown**
   - **Definition (ideal)**: a recommendation impression rendered to the student (e.g. dashboard “Next action” card).
   - **Current measurability**: **not reliably measurable from `StructuredSession` + `StudentTopicProgress` alone**. This stage requires explicit impression instrumentation (see “Instrumentation requirement” below).

2. **Session started**
   - **Definition**: `StructuredSession.startedAt` exists and is within the time window.
   - **Optional refinement**: use `SessionEvent` with `eventType in ('SESSION_STARTED','SESSION_OVERVIEW_VIEWED')` to distinguish new vs resumed opens.

3. **Practice completed**
   - **Definition**: session has `meta.practiceResult` persisted (practice submit routes write `practiceResult.score`, `gradedAt`).
   - **Fallback**: `SessionEvent` count where `eventType='QUESTION_ANSWERED'` and `metadata.source='practice'` crosses a threshold \(e.g. ≥ 1\), if meta is missing.

4. **Test completed**
   - **Definition**: session has `meta.testResult` persisted (test submit route writes `testResult.score`, `gradedAt`).
   - **Fallback**: `SessionEvent` count where `eventType='QUESTION_ANSWERED'` and `metadata.source='test'` crosses a threshold.

5. **Homework completed**
   - **Definition (preferred)**: `SessionEvent.eventType='HOMEWORK_SUBMITTED'` for the session.
   - **Alternate**: if linking exists, `HomeworkAssignment.sessionId=session.id` with `status in (SUBMITTED,GRADED)` (requires reading HomeworkAssignment; not required for v1 if SessionEvent is present).
   - **Note**: `StructuredSession.state='COMPLETE'` indicates the session finished, but it is not guaranteed that it strictly implies homework completion unless session engine enforces it. Treat “homework completed” as an explicit event whenever possible.

### Core funnel KPIs
- **Stage counts** (per window):
  - **sessionsStarted**, **practiceCompletedSessions**, **testCompletedSessions**, **homeworkCompletedSessions**
- **Stage conversion rates**:
  - **practiceCompletionRate** \(= practiceCompleted / sessionsStarted\)
  - **testCompletionRate** \(= testCompleted / practiceCompleted\)
  - **homeworkCompletionRate** \(= homeworkCompleted / testCompleted\)
  - **end-to-endCompletionRate** \(= homeworkCompleted / sessionsStarted\)
- **Drop-off counts**:
  - `sessionsStarted - practiceCompleted`
  - `practiceCompleted - testCompleted`
  - `testCompleted - homeworkCompleted`

### Operational diagnostics (high value)
- **Latency to stage** (distribution): time from `startedAt` to practice/test/homework completion (median, p90/p95).
- **Resumption behavior**: % of sessions with ≥1 `SESSION_OVERVIEW_VIEWED` before completion.
- **Learning impact proxy (limits)**:
  - Without history, only current snapshot is available in `StudentTopicProgress`.
  - Track “topics with lastStudiedAt in window” and report current mastery distribution; avoid claiming causal delta without baseline.

### Instrumentation requirement (Recommendation shown)
To measure “Recommendation shown” as a true funnel top:
- Emit a **RecommendationImpression** event when the UI renders the recommendation.
- Minimal storage options:
  - Reuse `SessionEvent` with a new eventType `RECOMMENDATION_SHOWN` and metadata `{ studentId, ruleId, topicId, actionType }`, or
  - Create a small table `RecommendationImpression` (append-only).
  
Until this instrumentation exists, the Admin funnel should **start at “Session started”** and display a banner: “Recommendation shown not instrumented.”

---

## SECTION 2 — Aggregation logic

### Entity-level derived flags (per StructuredSession)
For each session in \([from,to]\):
- `started = startedAt in window`
- `practiceCompleted = meta.practiceResult exists`
- `testCompleted = meta.testResult exists`
- `homeworkCompleted = exists SessionEvent(sessionId, HOMEWORK_SUBMITTED)` (preferred)
- `completed = (state='COMPLETE' and completedAt not null)` (supporting metric)

### SQL/Prisma-friendly approach
Two-pass aggregation for performance:
1. **Fetch candidate sessions**: `StructuredSession` filtered by `startedAt` range (and optional join filters via `User.board/grade`).
2. **Compute stage completion**:
   - Practice/test: derived from `meta` JSON presence (read in app layer) OR precomputed flags (recommended for rollups).
   - Homework: via `SessionEvent` existence lookup (groupBy sessionId where eventType=HOMEWORK_SUBMITTED).

### Aggregation outputs
- **Window summary**: stage counts + conversion rates + latency stats.
- **Breakdowns**:
  - by board, grade, subject (topic → chapter → subject join), and “new vs resumed session start”
- **Drop-off cohorts**:
  - “Started but no practice within 24h”
  - “Practice done but no test within 24h”
  - “Test done but no homework within 72h”

### Rollup strategy (recommended)
Create daily aggregates for fast dashboards:
- `LearningFunnelDailyAggregate(dateUTC, board?, grade?, subjectId?, sessionsStarted, practiceCompleted, testCompleted, homeworkCompleted, medianLatencyPracticeSec, medianLatencyTestSec, medianLatencyHomeworkSec, updatedAt)`
- Populate via nightly job or incremental updater.

---

## SECTION 3 — Admin service design

### Service: `AdminLearningFunnelAnalyticsService`
**Location:** `lib/admin/learningFunnelAnalytics.ts` (recommended)

**Responsibilities**
- `getFunnelSummary({from,to, board?, grade?, subjectId?})`
  - returns stage counts, conversion rates, latency percentiles, and data-quality flags (e.g. % sessions missing meta)
- `getFunnelTimeseries({from,to, granularity:'day', board?, grade?, subjectId?})`
  - returns daily series for stages and rates
- `getDropoffBreakdown({from,to, stage, limit, board?, grade?, subjectId?})`
  - returns top topics / chapters / segments driving drop-off (e.g. many sessions start but few reach test)

**Design constraints**
- Read-only for analytics queries (writes only if rollup tables/jobs are adopted).
- Deterministic derivations; no AI inference.

---

## SECTION 4 — Admin API endpoints

All endpoints admin-only.

1. `GET /api/admin/learning-funnel/summary`
   - Query: `from`, `to`, optional `board`, `grade`, `subjectId`
   - Response: `{ stages: {...}, rates: {...}, latency: {...}, dataQuality: {...} }`

2. `GET /api/admin/learning-funnel/timeseries`
   - Query: `from`, `to`, `granularity=day`, optional segment filters
   - Response: `{ series: Array<{ date, sessionsStarted, practiceCompleted, testCompleted, homeworkCompleted, rates: {...} }> }`

3. `GET /api/admin/learning-funnel/dropoff`
   - Query: `from`, `to`, `stage=practice|test|homework`, optional segment filters, `limit`
   - Response: `{ topTopics: [...], topChapters: [...], topSegments: [...] }`

Optional (if “Recommendation shown” instrumentation is added):
- `GET /api/admin/learning-funnel/impressions`

---

## SECTION 5 — Admin dashboard UX

### Page: `/admin/learning-funnel`

**Top controls**
- Date range (default last 7 days)
- Board, Grade, Subject filters
- Toggle: “New sessions only” vs “Include resumes”

**Primary visualization**
- Funnel chart:
  - Recommendation shown (if instrumented)
  - Session started
  - Practice completed
  - Test completed
  - Homework completed

**Supporting panels**
- Trend line (daily) of stage counts and end-to-end completion rate
- Latency panel (median/p95 time-to-practice/test/homework)
- Drop-off drivers:
  - “Top topics where students drop at practice/test/homework”
  - “Top segments (board/grade) with highest drop-off”
- Data quality panel:
  - % sessions missing practice/test meta
  - event coverage for homework submitted

