# Daily Learning Habit — Implementation Summary

Implementation follows the audit in `docs/daily-habit-system-audit.md`. Delivered in five sections.

---

## SECTION 1 — Database schema

### New models (Prisma)

**User (change)**  
- `timezone` — `String?` (IANA, e.g. `Asia/Kolkata`). Used for “today” and weekly window in student local date. Null ⇒ UTC.

**StudentEngagementStats**  
- `studentId` — `String` @unique, FK to User  
- `currentStreak` — `Int` @default(0)  
- `longestStreak` — `Int` @default(0)  
- `lastActiveDate` — `DateTime?` (UTC midnight of last day with ≥1 completion)  
- `totalSessionsCompleted` — `Int` @default(0)  
- `learningPoints` — `Int` @default(0)  
- `updatedAt` — `DateTime` @updatedAt  
- `@@index([studentId])`

**EngagementProcessedSession** (idempotency)  
- `sessionId` — `String` @unique  
- `studentId` — `String` (FK to User)  
- `processedAt` — `DateTime` @default(now())  
- `@@index([studentId])`

### StructuredSession (index only)

- `@@index([studentId, completedAt])` — for engagement range queries (today, streak, weekly).

### Migration

Run when the schema is applied:

```bash
npx prisma migrate dev --name add_daily_habit_engagement
```

If your migrations are out of sync, create the migration with `--create-only` and apply when appropriate.

---

## SECTION 2 — Prisma queries

Implemented in `lib/engagement/engagementQueries.ts`:

| Query | Purpose |
|-------|--------|
| **getUniqueStudyDays(studentId, options)** | Distinct calendar dates (student TZ) with ≥1 completed session. Options: timezone, sinceUtc, untilUtc, limit. Returns sorted dates (desc). |
| **computeStreakFromStudyDays(studyDays, todayLocal)** | Given sorted study days and “today”, returns `{ current, longest }` (consecutive days with ≥1 completion). |
| **getWeeklyActivity(studentId, timezone)** | Last 7 local days; each `{ date, completed }`. Uses getUniqueStudyDays for that window. |
| **countCompletionsInRange(studentId, fromUtc, toUtc)** | `StructuredSession` count where state = COMPLETE and completedAt in [from, to]. |

All completion reads use `state: 'COMPLETE'` and `completedAt: { not: null }`. Date logic uses `lib/engagement/timezone.ts` (Intl, no extra deps).

---

## SECTION 3 — engagementService implementation

**File:** `lib/engagement/engagementService.ts`

| Function | Behavior |
|----------|----------|
| **getTodayCompletion(studentId)** | Loads user timezone; “today” = getTodayLocalDateString(tz); range = startOfLocalDayUtc … endOfLocalDayUtc. If countCompletionsInRange ≥ 1 → state COMPLETED and latest completedAt; else NOT_STARTED. |
| **getCurrentStreak(studentId)** | Gets timezone, getUniqueStudyDays(limit 365), computeStreakFromStudyDays(studyDays, today). Returns { current, longest } (longest max with stats cache if present). |
| **getWeeklyActivity(studentId)** | Delegates to engagementQueries.getWeeklyActivity(studentId, user.timezone). Returns last 7 days with { date, completed }. |
| **recordSessionCompletion(studentId, sessionId)** | See Section 4 (idempotent). Creates EngagementProcessedSession, increments User.points by 25, upserts StudentEngagementStats (totals + streak from getUniqueStudyDays + computeStreakFromStudyDays). |

**Constants:** `LEARNING_POINTS_PER_SESSION = 25`, `TZ_DEFAULT = 'UTC'`.

**Integration:** `lib/events/sessionEventListeners.ts` subscribes to `SESSION_COMPLETED` and calls `recordSessionCompletion(payload.studentId, payload.sessionId)`. Domain event payload extended to `{ studentId, sessionId }`; `sessionEngine` emits with both after a successful transition to COMPLETE.

---

## SECTION 4 — Idempotency safeguards

- **Key:** One row per `sessionId` in `EngagementProcessedSession`. Same session completing twice (e.g. duplicate event) must not double points or streak.
- **recordSessionCompletion:**  
  1. `findUnique(EngagementProcessedSession, { sessionId })`. If exists → return.  
  2. Load session (id, studentId, state COMPLETE, completedAt). If missing or not COMPLETE → log and return.  
  3. In a single transaction:  
     - `create(EngagementProcessedSession, { sessionId, studentId })`  
     - `user.update({ points: { increment: 25 } })`  
     - `studentEngagementStats.upsert(...)`  
  First completion creates the row; second completion hits step 1 and exits.
- **Event payload:** `sessionId` is required so the handler can key idempotency by session. No idempotency by time window or student alone.

---

## SECTION 5 — Performance considerations

- **Indexes:**  
  - `StructuredSession(studentId, completedAt)` for range scans (today, streak, weekly).  
  - `EngagementProcessedSession(sessionId)` unique for idempotency check.  
  - `EngagementProcessedSession(studentId)` and `StudentEngagementStats(studentId)` for lookups.
- **Study days:** getUniqueStudyDays uses a limit (default 500; streak uses 365/400). No unbounded full history.
- **Streak:** Computed from unique study days in app code; no heavy SQL. Stats cache (StudentEngagementStats) avoids recomputing for every read when you add a dashboard that shows cached values.
- **Transaction:** recordSessionCompletion uses one transaction for processed row + user points + stats so all-or-nothing and no double-credit on partial failure.
- **Event handler:** recordSessionCompletion is fire-and-forget from the event (same as TopicRanker). Failures are logged; they do not block the session response.
