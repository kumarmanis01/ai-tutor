# Spinzy Daily Learning Habit System — Technical Documentation

Comprehensive documentation for the Daily Learning Habit feature: purpose, product design, architecture, data model, streak logic, frontend, data flow, edge cases, performance, and future work. Audience: product managers, backend engineers, frontend engineers, and future maintainers.

---

## SECTION 1 — Feature Overview

### Purpose

The **Daily Learning Habit System** encourages consistent study behavior by:

1. **Daily goal** — One completed session per calendar day (in the student’s timezone) counts as “goal met.”
2. **Streak** — Consecutive days with at least one completed session are tracked and displayed (current and longest).
3. **Weekly calendar** — The last seven days are shown with a simple completed/not-completed view (● / ○).
4. **Learning points** — Each completed session awards a fixed number of points (e.g. 25), stored on the user and used for engagement/rewards.

The system does **not** change the recommendation engine (P0–P5 rules) or session flow. Completion is observed via a domain event; engagement is updated in an idempotent, event-driven way. The dashboard surfaces the habit UI at the top so “Start Today’s Session” is the primary CTA when the goal is not yet met.

### Scope

- **In scope:** Daily goal state, streak computation, weekly activity, learning points, idempotent recording, timezone-aware “today” and “this week,” read API and dashboard UI.
- **Out of scope:** Gamification (badges, levels), configurable daily goals (e.g. “2 sessions”), changes to curriculum or recommendation logic.

---

## SECTION 2 — Product Design

### Daily goal

- **Definition:** “Today” is the current calendar date in the student’s stored timezone (or UTC if not set). The goal is **complete 1 session** on that date.
- **States:**
  - **NOT_STARTED** — No completed session today.
  - **IN_PROGRESS** — Reserved for future use (e.g. session started but not completed today); currently the backend only returns NOT_STARTED or COMPLETED.
  - **COMPLETED** — At least one session completed today; optional `completedAt` (ISO) for the latest completion.
- **UI:** A card titled “Today’s Learning Goal” with “Complete 1 session,” a “Start Today’s Session” button when not completed, and “Done for today.” when completed. The button links to the recommended topic when available (`/session/[topicId]`), otherwise to the dashboard.

### Streak logic (product)

- **Definition:** A **streak** is the number of **consecutive calendar days** (in the student’s timezone) on which the student completed at least one session.
- **Current streak:** Consecutive days ending on “today” if today has a completion, or ending on the most recent completed day otherwise.
- **Longest streak:** Maximum run of consecutive days with ≥1 completion within the window considered (e.g. last 365 days); combined with a stored “longest ever” from the cache table so the value never decreases.
- **UI:** “N Day Streak” and “Keep it going tomorrow.” Shown only when current > 0; no badge or heavy gamification.

### Weekly calendar

- **Definition:** The **last 7 calendar days** (student timezone), each marked as having at least one completed session or not.
- **UI:** Seven columns (Mon–Sun). Each day shows ● (at least one session completed) or ○ (no session). Days are mapped to weekday by local date so the same calendar day is consistent across timezones.

### Learning points

- **Definition:** Each completed session awards a fixed number of **learning points** (e.g. 25). Points are added to `User.points` (existing field; may be shared with other rewards, e.g. referrals).
- **When:** Awarded once per session at completion time, inside the same transactional path that updates streak and idempotency.
- **UI:** Points can be displayed elsewhere (e.g. profile or rewards); the habit dashboard focuses on daily goal, streak, and weekly calendar.

---

## SECTION 3 — System Architecture

### Backend services

The feature is implemented as a single logical service: the **engagement** module. It does not introduce a new microservice; it lives in the same app as Prisma, session engine, and API routes.

| Layer                      | Responsibility                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **engagementService**      | Orchestrates reads (today, streak, weekly) and the single write (recordSessionCompletion). Uses Prisma and engagement queries; applies student timezone for all date logic. |
| **engagementQueries**      | Pure query helpers: unique study days, streak computation from study days, weekly activity window, count completions in range. No side effects.                             |
| **timezone**               | Converts UTC ↔ student local date (IANA timezone): “today,” start/end of local day in UTC for DB range queries.                                                             |
| **Session event listener** | Subscribes to `SESSION_COMPLETED`; calls `recordSessionCompletion(studentId, sessionId)`. Fire-and-forget; failures are logged and do not block the session response.       |

**Source of truth for “did the student complete a session?”:** `StructuredSession.state = 'COMPLETE'` and `StructuredSession.completedAt`. All engagement reads derive from this. The cache table (`StudentEngagementStats`) is a materialized view for performance and for storing “longest streak ever”; it is updated on each completion and can be rebuilt from sessions if needed.

### engagementService (API)

**File:** `lib/engagement/engagementService.ts`

| Function                                        | Purpose                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getTodayCompletion(studentId)`                 | Returns `{ state, completedAt? }` for “today” in student timezone. Uses `countCompletionsInRange` and, if count ≥ 1, the latest `completedAt` in that range.                                                                                                                                                                                                       |
| `getCurrentStreak(studentId)`                   | Loads user timezone; gets unique study days (e.g. limit 365); runs `computeStreakFromStudyDays`; merges longest with `StudentEngagementStats.longestStreak` and returns `{ current, longest }`.                                                                                                                                                                    |
| `getWeeklyActivity(studentId)`                  | Delegates to `engagementQueries.getWeeklyActivity(studentId, user.timezone)`; returns last 7 days with `{ date, completed }`.                                                                                                                                                                                                                                      |
| `recordSessionCompletion(studentId, sessionId)` | Idempotent write: if session already in `EngagementProcessedSession`, return. Else load session (must be COMPLETE), compute completion date in student TZ, recompute streak from study days, then in one transaction: insert processed row, increment `User.points` by 25, upsert `StudentEngagementStats` (totals, lastActiveDate, currentStreak, longestStreak). |

Constants: `LEARNING_POINTS_PER_SESSION = 25`, `TZ_DEFAULT = 'UTC'`.

### API endpoints

| Method | Path                         | Auth             | Purpose                                                                                  |
| ------ | ---------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/engagement`            | Session required | **Combined:** `{ today, streak, weekly }` — preferred for dashboard (single round-trip). |
| GET    | `/api/engagement/today-goal` | Session required | Today’s completion state only.                                                           |
| GET    | `/api/engagement/streak`     | Session required | Current and longest streak.                                                              |
| GET    | `/api/engagement/weekly`     | Session required | Weekly activity (last 7 days).                                                           |

- **Auth:** All use `getServerSessionForHandlers()`. No session → `401 Unauthorized`.
- **Success:** JSON with the shapes described in Section 2; `Cache-Control: private, max-age=60, stale-while-revalidate=120`.
- **Errors:** 500 with a generic message; errors are logged (e.g. `engagement.today-goal.error`) and do not expose internals.

---

## SECTION 4 — Database Design

### StructuredSession usage

Engagement **reads** use only completed sessions:

- **Table:** `StructuredSession`
- **Filters:** `studentId`, `state: 'COMPLETE'`, `completedAt` not null. For “today” and ranges, `completedAt` is constrained to a UTC range that corresponds to the student’s local date(s).
- **Indexes:** `@@index([studentId, state])`, `@@index([studentId, completedAt])`. The second index supports range queries by `completedAt` for a given student (today, streak, weekly).

**Writes:** Session completion is written by the session engine (e.g. `transitionSessionPhase` → COMPLETE with `completedAt`). The engagement layer never inserts or updates `StructuredSession`; it only reads it and reacts to the `SESSION_COMPLETED` event.

### StudentEngagementStats table

**Purpose:** Cache for fast reads and for storing “longest streak ever.” Authoritative completion data remains `StructuredSession.completedAt`.

| Field                  | Type            | Meaning                                                   |
| ---------------------- | --------------- | --------------------------------------------------------- |
| id                     | String (cuid)   | Primary key.                                              |
| studentId              | String (unique) | FK to User.                                               |
| currentStreak          | Int             | Consecutive days with ≥1 completion (as of last write).   |
| longestStreak          | Int             | Maximum of (current computation, previous longest).       |
| lastActiveDate         | DateTime?       | UTC midnight of the last calendar day with ≥1 completion. |
| totalSessionsCompleted | Int             | Total completions ever processed.                         |
| learningPoints         | Int             | Total learning points awarded (e.g. 25 × sessions).       |
| updatedAt              | DateTime        | Last update.                                              |

**Updated when:** `recordSessionCompletion` runs (after a new completion). One upsert per student per completion; `longestStreak` is set to `max(computed longest, existing longest)` so it never decreases.

### EngagementProcessedSession (idempotency)

| Field       | Type            | Meaning                                              |
| ----------- | --------------- | ---------------------------------------------------- |
| id          | String (cuid)   | Primary key.                                         |
| sessionId   | String (unique) | Idempotency key: one row per session ever processed. |
| studentId   | String          | FK to User.                                          |
| processedAt | DateTime        | When the completion was recorded.                    |

**Purpose:** Ensure each session is counted at most once. Before applying points or updating stats, the service checks for an existing row with the same `sessionId`; if found, it returns without writing.

### User

- **timezone** — Optional IANA string (e.g. `Asia/Kolkata`). Used for “today,” streak calendar days, and weekly window. Null ⇒ UTC.
- **points** — Existing integer; incremented by `LEARNING_POINTS_PER_SESSION` on each (first) completion.

---

## SECTION 5 — Streak Calculation Logic

Algorithm (implemented in `engagementQueries.computeStreakFromStudyDays` and used by `engagementService`).

**Inputs:**

- `studyDays`: Sorted list of calendar dates (YYYY-MM-DD in student TZ) on which the student completed ≥1 session (e.g. from `getUniqueStudyDays`, limit 365).
- `todayLocal`: Today’s date string in the same timezone.

**Outputs:** `{ current: number, longest: number }`.

**Steps:**

1. **Unique study days:** From `StructuredSession` (state COMPLETE, completedAt set), select sessions in the desired range; map each `completedAt` to local date (YYYY-MM-DD) via `getLocalDateString(completedAt, timezone)`; deduplicate and sort dates (asc for streak walk).

2. **Longest run (any window):** Walk the sorted dates; if the next date is the day after the previous, extend the run; otherwise reset run to 1. Track the maximum run length → `longest`.

3. **Current streak (ending at “today” or last completed day):**
   - Start from `todayLocal`. If today is in `studyDays`, count today and walk backward day-by-day while the previous day is in `studyDays`; stop at first gap. → `current`.
   - If today is not in `studyDays`, optionally define “current” as the run ending at the most recent completed day (same backward walk from that day). The implementation walks backward from today first; if count is 0 and there is a `latestDay`, it walks backward from `latestDay` so “current” is the consecutive run up to (but not including) today.

4. **Merge with stored longest:** Return `current` and `longest = max(computed longest, StudentEngagementStats.longestStreak)` so the displayed “longest” never decreases after a completion.

**Consecutive-day rule:** Two dates are consecutive if they are exactly one calendar day apart (e.g. 2026-03-07 and 2026-03-08). Date math uses a single timezone for the student so that “day” is unambiguous.

---

## SECTION 6 — Frontend Architecture

### Dashboard placement

The engagement block is the **top section** of the student dashboard (above PrimaryActionCard). The dashboard page is a server component that fetches recommendation (e.g. `getNextAction`) and passes `recommendation?.topicId` into the engagement section so “Start Today’s Session” can link to the recommended topic.

### Components

| Component                  | Type           | Responsibility                                                                                                                                                                                                                           |
| -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EngagementSection**      | Client         | Fetches `GET /api/engagement` once on mount; parses combined response; handles loading and errors with safe fallbacks; renders DailyGoalCard, StreakIndicator, WeeklyActivityCalendar. Receives `nextTopicId` from server.               |
| **DailyGoalCard**          | Presentational | Shows “Today’s Learning Goal,” “Complete 1 session,” state (NOT_STARTED / IN_PROGRESS / COMPLETED), and “Start Today’s Session” (or “Done for today.”). Uses `nextTopicId` for the button href. Loading skeleton when `loading` is true. |
| **StreakIndicator**        | Presentational | Shows “N Day Streak” and “Keep it going tomorrow.” Renders nothing when `current === 0`. Loading skeleton when `loading` is true.                                                                                                        |
| **WeeklyActivityCalendar** | Presentational | Seven columns (Mon–Sun); maps last 7 days to weekdays; shows ● (completed) or ○ (not completed). Loading skeleton when `loading` is true.                                                                                                |

**Data flow:** Server → `EngagementSection(nextTopicId)`. Client → `fetch('/api/engagement')` → `parseCombined` → state → three child components. No engagement state is lifted to the rest of the dashboard; the section is self-contained.

### Error handling (UI)

- If `!res.ok` or parse fails or network errors: do not treat the body as success. Apply fallbacks: today `NOT_STARTED`, streak `0`, weekly `[]`. Always set `loading` to false in `finally` so the section never stays in a permanent loading state. The rest of the dashboard continues to work.

---

## SECTION 7 — Data Flow

### Session completion → engagement update → dashboard update

1. **Completion:** User finishes a session; client calls `POST /api/session/next` (or equivalent) with the final advance. Session engine transitions the session to `COMPLETE`, sets `completedAt`, persists to DB, then emits `SESSION_COMPLETED { studentId, sessionId }` (fire-and-forget).

2. **Engagement update:** `sessionEventListeners` subscribes to `SESSION_COMPLETED` and calls `recordSessionCompletion(studentId, sessionId)`.
   - Check `EngagementProcessedSession` by `sessionId`; if exists, return (idempotent).
   - Load session (must be COMPLETE, with `completedAt`).
   - Get user timezone; compute completion date in that TZ; get unique study days; compute current/longest streak.
   - In one transaction: insert `EngagementProcessedSession`, increment `User.points`, upsert `StudentEngagementStats`.

3. **Dashboard update:** Dashboard does not refetch automatically on session complete. On next load (or when the user returns to the dashboard), the client fetches `GET /api/engagement`, which reads from `engagementService` (today from `StructuredSession` + timezone, streak from study days + stats, weekly from study days). Responses are cached by the browser (e.g. 60s); after that, the next full page load or refetch shows the updated goal, streak, and weekly calendar.

---

## SECTION 8 — Edge Cases

### Duplicate events

- **Risk:** The same `SESSION_COMPLETED` event might be delivered more than once (e.g. retries, duplicate emissions).
- **Mitigation:** `recordSessionCompletion` is idempotent by `sessionId`. The first call creates an `EngagementProcessedSession` row and applies points and stats; subsequent calls for the same `sessionId` find the row and return without changing anything.

### Timezone issues

- **Missing timezone:** `User.timezone` is null → use `UTC` for “today” and all date math. Students in other zones will see “today” in UTC, which may be off by a day near midnight.
- **Invalid timezone:** The timezone helper uses `Intl` with the stored IANA value. Invalid values can lead to fallback or incorrect conversion; validate or default (e.g. to UTC) when saving or when reading.
- **Midnight boundary:** A completion at 23:59 in the student’s TZ counts for that day; 00:01 the next day counts for the next. All logic uses the same conversion (e.g. `getLocalDateString(completedAt, timezone)`) so boundaries are consistent.

### Multiple sessions per day

- **Daily goal:** One completion on a given day is enough for COMPLETED. Additional completions on the same day do not change the goal state; they are still counted for total sessions and learning points.
- **Streak:** Streak is “consecutive **days** with ≥1 completion.” Multiple sessions on the same day count as one day for the streak.
- **Idempotency:** Each session has a unique `sessionId`; each is processed once. So multiple sessions on the same day each add 25 points and one row in `EngagementProcessedSession`; the streak and “today” state are derived from the set of completion dates, not the number of sessions per day.

---

## SECTION 9 — Performance Considerations

- **Indexes:** `StructuredSession(studentId, completedAt)` and `(studentId, state)` support engagement range and filter queries. `EngagementProcessedSession(sessionId)` unique and `(studentId)`; `StudentEngagementStats(studentId)` for lookups.
- **Study days:** `getUniqueStudyDays` is limited (e.g. 365 or 400) to avoid unbounded scans. Streak and weekly only need a bounded window.
- **Single combined endpoint:** The dashboard uses `GET /api/engagement` (today + streak + weekly in one response) to reduce round-trips and connection overhead.
- **Cache-Control:** Engagement API responses set `private, max-age=60, stale-while-revalidate=120` so the browser can cache per-user and revalidate in the background.
- **Write path:** `recordSessionCompletion` runs in a single transaction (processed row + user points + stats). Failures are logged; the event handler does not block the session API response.
- **Read path:** Streak is computed from study days in app code; for very high traffic, consider caching the result per student (e.g. short TTL) or relying more on `StudentEngagementStats.currentStreak` if product accepts slight delay in “current” after completion.

---

## SECTION 10 — Future Improvements

- **IN_PROGRESS state:** Backend could set “today’s goal” to IN_PROGRESS when the student has an active (non-complete) session started today; would require a clear definition and possibly a small schema or query change.
- **Configurable goal:** Allow “complete N sessions per day” (e.g. 2) and/or different point amounts per session; would require product and schema/API changes.
- **Timezone from client:** Allow the client to send timezone (e.g. on login or in settings) and persist to `User.timezone` so “today” and weekly align with the student’s actual location without separate settings UI.
- **Dashboard live update:** After completing a session, optionally refetch engagement (e.g. via router refresh or a dedicated refetch) so the user sees the updated goal/streak without leaving the session flow.
- **Learning points UI:** Surface `User.points` (or a dedicated learning-points field) in the dashboard or profile if rewards/points become a first-class product.
- **Rebuild cache:** Script or admin endpoint to recompute `StudentEngagementStats` from `StructuredSession` for a student or globally, for recovery or backfills.

---

_Document version: 1.0. Audience: product, backend, frontend, maintainers. For implementation details see also: `docs/daily-habit-integration.md`, `docs/engagement-implementation.md`, `docs/daily-habit-ui.md`._
