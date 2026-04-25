# Daily Learning Habit System — System Audit

**Document type:** Architecture audit (no code)  
**Scope:** Backend services, queries, indexes, caching, timezone, and API surface for the Daily Learning Habit feature.  
**Constraint:** Do not modify the recommendation engine; do not assume data beyond existing signals.

---

## Existing Signals (Source of Truth)

- **Session completion:** `StructuredSession.state = 'COMPLETE'`
- **Completion time:** `StructuredSession.completedAt` (set once when transition to COMPLETE succeeds)
- **Existing models:** `User.points` (integer, already used for referrals); `StudentStreak` (studentId, kind, current, best, lastActive, updatedAt) with `@@index([studentId, kind])`
- **Completion flow:** `POST /api/session/next` → `advanceSession()` → `transitionSessionPhase(..., COMPLETE)` → DB write with `completedAt` → `emitSessionCompleted({ studentId })` → existing listener invalidates TopicRanker cache

---

## 1) Backend Services Required

| Service                     | Responsibility                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engagement service**      | Single backend module for habit logic.                               | (1) **Daily goal:** Derive today’s state (NOT_STARTED / IN_PROGRESS / COMPLETED) from whether the student has at least one completed session “today” in their local date. (2) **Streak:** Compute consecutive calendar days with ≥1 completed session from `StructuredSession` rows (state = COMPLETE, completedAt non-null). (3) **Weekly activity:** Return a fixed window (e.g. last 7 calendar days, or current week Mon–Sun) with a boolean or count per day. (4) **Learning points:** Award +25 on session completion; persist via `User.points` increment (or dedicated table if product wants separate “learning points” from “rewards points”). |
| **Session completion hook** | Ensure every transition to COMPLETE is reflected in engagement.      | Use the existing **domain event** `SESSION_COMPLETED` (emitted from `sessionEngine` after a successful transition). Register a new `onSessionCompleted` handler that calls the engagement service to record completion (update streak cache, add points, etc.). No change to `sessionEngine` or `transitionSessionPhase`; only a new listener.                                                                                                                                                                                                                                                                                                           |
| **Idempotency enforcer**    | Prevent double-counting when the same completion is processed twice. | Implement inside the engagement service: record completion keyed by `sessionId` (or by `(studentId, completedAt)` if you allow one session to be “completed” only once). Before applying points or updating streak, check that this session has not already been counted.                                                                                                                                                                                                                                                                                                                                                                                |

No new “session” or “recommendation” services; recommendation engine (P0–P5) remains unchanged.

---

## 2) Queries Required

All of the following use only `StructuredSession` with `state = 'COMPLETE'` and `completedAt IS NOT NULL`. Dates are interpreted in the student’s timezone (see §5).

| Query                              | Purpose                                                                                          | Shape                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today completion**               | Daily goal state.                                                                                | For a given `studentId` and “today” in student local date: count or exists of sessions where `state = 'COMPLETE'`, `completedAt` in that local date. Returns: none → NOT_STARTED; one or more → COMPLETED. (IN_PROGRESS can be derived if you track “session started but not completed today” separately; otherwise omit or infer from “has active session” elsewhere.) |
| **Unique study days (for streak)** | List of calendar days (in student timezone) on which the student completed at least one session. | Query: `StructuredSession` where `studentId = ?`, `state = 'COMPLETE'`, `completedAt IS NOT NULL`. Group by date(completedAt in student TZ); optionally order by date desc and limit for “recent” usage.                                                                                                                                                                |
| **Current streak**                 | Consecutive days ending “today” (or “yesterday” if today not yet completed).                     | From the unique study days: take the most recent dates; walk backwards and stop at the first gap. Count consecutive days. If “today” is in the set, streak includes today; else streak ends yesterday (or last completed day).                                                                                                                                          |
| **Weekly activity**                | Last 7 days or current week (Mon–Sun).                                                           | Same “unique study days” source; filter to the chosen window; return a structure keyed by date (or weekday) with a boolean or count per day for the calendar UI (● / ○).                                                                                                                                                                                                |
| **Record completion (idempotent)** | Apply +25 points and update streak/cache only once per session.                                  | (1) Check if `sessionId` (or `(studentId, completedAt)`) already recorded in idempotency store. (2) If not: run a small transaction that increments `User.points` by 25, updates streak cache (if used), and marks this session as processed.                                                                                                                           |

**Implementation note:** “Unique study days” can be implemented in raw SQL with `DATE(completedAt AT TIME ZONE student_tz)` and `GROUP BY` that date, or in application code by fetching completed sessions and grouping in JS/TS. Either way, the only table read is `StructuredSession` (and optionally the idempotency/streak cache table).

---

## 3) Indexes to Add

| Table                 | Index                                           | Justification                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **StructuredSession** | `(studentId, state)` where `state = 'COMPLETE'` | Already have `@@index([studentId, state])`; sufficient for “all completed sessions for student.”                                                                                                                                      |
| **StructuredSession** | `(studentId, completedAt)`                      | Enables efficient “completed sessions for student ordered by completedAt” for streak and weekly activity (range on completedAt, filter by studentId and state = COMPLETE). Optional but recommended if you query by date range often. |

If a **cache table** is introduced (see §4), add:

- Unique constraint or unique index on `(studentId, sessionId)` or `(studentId, completedDate)` for idempotency and/or daily rollups.
- Index on `studentId` for fast lookup of a student’s cache row(s).

No new indexes on recommendation or home-engine tables.

---

## 4) Is a Caching Table Required for Streak?

**Recommendation: optional but justified for performance and consistency.**

- **Without cache:** Streak is computed on demand from `StructuredSession` (state = COMPLETE, completedAt). For each request you: query unique study days (e.g. last 30–60 days), then compute consecutive days in app code. This is correct and uses only existing data; at low/medium traffic it is acceptable.
- **With cache:** A small table (e.g. **StudentEngagementStats** or reuse/expand **StudentStreak** with a well-defined `kind`, e.g. `daily_session`) stores per-student: `currentStreak`, `longestStreak`, `lastActiveDate` (last calendar day with a completion), and optionally `totalSessionsCompleted` and `learningPoints`. Updated **once per completion** in the same transactional (or eventually consistent) path that awards points. Read path becomes a single row lookup.

**When to add a cache table:**

- Add it if you want **stable, fast reads** for dashboard/UI (streak, weekly calendar, “today completed”) without scanning sessions on every request.
- Add it if you want **strong idempotency**: e.g. a row keyed by `(studentId, sessionId)` or a “processed completions” table so that double delivery of `SESSION_COMPLETED` does not double-increment points or streak.

**When to avoid:**

- Do not add it only for “correctness” of streak: correctness can be achieved from `StructuredSession.completedAt` alone. Cache is for performance and for a clean idempotency boundary.

**If you introduce a new table:** Justify it in the schema/migration as “engagement cache for daily habit (streak, points, idempotency).” Keep the **authoritative** definition of “which days had a completion” as derived from `StructuredSession`; the cache is a materialized view that can be rebuilt or corrected from that source if needed.

---

## 5) Timezone Handling

- **Requirement:** “Student local date” must drive daily goal, streak, and weekly calendar. Same UTC instant can be “yesterday” for one student and “today” for another.
- **Current schema:** No `timezone` or `timeZone` field on `User` in the inspected schema. So timezone must come from one of:
  - **Preferred:** User preference (e.g. `User.timezone` or `User.preferredTimezone` stored as IANA string, e.g. `Asia/Kolkata`). Add a nullable column if not present; default to a safe default (e.g. `UTC` or app default) when null.
  - **Alternative:** Request context (e.g. `Accept-Language` + heuristic, or explicit `X-Timezone` header) for the read path only; avoid using it for write path (points/streak) unless you persist it to the user.
- **Safe pattern:**
  - **Writes (record completion):** Store `StructuredSession.completedAt` in UTC (already the case). When updating streak/cache, compute “completion date” as the calendar date in the **student’s stored timezone** (or UTC if timezone missing).
  - **Reads (today, streak, weekly):** For “today” and “this week,” compute the current date (and week bounds) in the student’s timezone. Query sessions whose `completedAt`, when converted to that timezone, fall on the relevant dates.
- **Edge cases:** Midnight boundary: a session completed at 23:59 in the student’s TZ counts for that day; 00:01 the next day in that TZ counts for the next day. Use a single, consistent conversion (e.g. `completedAt` → student TZ → date string or date-only) everywhere.
- **Implementation:** Use a small timezone utility that takes `(utcDate: Date, ianaTimezone: string)` and returns the local calendar date (and optionally start/end of that day in UTC for range queries). Do not assume server timezone or browser timezone on the server without storing or passing it explicitly.

---

## 6) Backend Endpoints

| Endpoint                                                     | Method | Purpose                                                                                                                                                                 | Auth                |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **GET /api/engagement** (or **GET /api/engagement/summary**) | GET    | Return daily goal state, current streak, weekly activity (e.g. last 7 days with ●/○), and learning points for the current user.                                         | Required (student). |
| **POST /api/session/next**                                   | POST   | Existing. No change to contract. When the transition is to COMPLETE, the new engagement listener will run and record completion (points + streak) in an idempotent way. | Required.           |

**Optional (if you want explicit “record” for other triggers):**

- **POST /api/engagement/record-completion** — Body: `{ sessionId }`. Called only by backend or trusted caller when a session is known to be complete. Idempotent; no-op if session already counted. Use only if you need to record completion from a path that does not go through the existing `SESSION_COMPLETED` event.

**Recommendation:** Do **not** add a separate “complete session” endpoint; keep completion as a side effect of the existing advance-to-COMPLETE flow and the new `onSessionCompleted` handler. Expose only the **read** endpoint for engagement (daily goal, streak, calendar, points) so the client can display the habit UI.

---

## Architecture Summary

- **Single source of truth for “did the student complete a session?”:** `StructuredSession.state = 'COMPLETE'` and `StructuredSession.completedAt`.
- **Single place completion is written:** `transitionSessionPhase` (called by `advanceSession`). No duplicate completion writes elsewhere.
- **Single place completion is “observed”:** Domain event `SESSION_COMPLETED` after a successful transition. Add one new listener that calls the engagement service.
- **Engagement service:** Stateless; uses Prisma to read `StructuredSession` and optionally a small cache table; writes `User.points` and cache (if any); idempotency by session (or by student+date) so double events do not double count.
- **Recommendation engine:** Unchanged. No new priorities; no changes to P0–P5 or to getNextAction.
- **Timezone:** Student’s stored (or default) IANA timezone drives “today” and “this week” for both reads and completion-date in writes.

This audit does not prescribe exact table schemas or function signatures; it defines the boundaries, data sources, and safety rules so that implementation can proceed without redesigning the recommendation engine or introducing complex gamification.
