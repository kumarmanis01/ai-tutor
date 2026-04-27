# Daily Learning Habit — Integration

Integration of the Daily Learning Habit system with the Spinzy Academy student dashboard: API routes, engagement service wiring, caching, loading states, and error handling so the dashboard never breaks.

---

## SECTION 1 — API route structure

| Method | Path | Auth | Purpose |
|--------|------|------|--------|
| GET | `/api/engagement` | Session required | Combined: today goal + streak + weekly (preferred for dashboard) |
| GET | `/api/engagement/today-goal` | Session required | Today’s completion state only |
| GET | `/api/engagement/streak` | Session required | Current and longest streak |
| GET | `/api/engagement/weekly` | Session required | Weekly activity (array of days) |

**Auth:** All routes use `getServerSessionForHandlers()`. Missing session → `401 Unauthorized` with `{ error: 'Unauthorized' }`.

**Response shape (success):**

- **Combined** `GET /api/engagement`:  
  `{ today: TodayGoal, streak: Streak, weekly: WeeklyDay[] }`
- **today-goal:** `{ state, completedAt? }` (`state`: `NOT_STARTED` | `IN_PROGRESS` | `COMPLETED`)
- **streak:** `{ current: number, longest: number }`
- **weekly:** `Array<{ date: string, completed: boolean }>`

**Caching:** Successful JSON responses set:

`Cache-Control: private, max-age=60, stale-while-revalidate=120`

(60s fresh, 120s stale-while-revalidate; `private` for user-specific data.)

---

## SECTION 2 — Route handler implementation

**Shared flow:**

1. **Auth:** Call `getServerSessionForHandlers()`, read `session?.user?.id`. If no `userId`, return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.
2. **Service:** Call the appropriate `engagementService` function with `userId`:
   - `getTodayCompletion(userId)` → today-goal
   - `getCurrentStreak(userId)` → streak
   - `getWeeklyActivity(userId)` → weekly
3. **Success:** Return `NextResponse.json(data)`, then set header:  
   `res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')`.
4. **Errors:** In a `try/catch`, on failure log (e.g. `logger.warn('engagement.<route>.error', { userId, error })`) and return `NextResponse.json({ error: '...' }, { status: 500 })`.

**Combined route** `GET /api/engagement`: Runs `Promise.all([ getTodayCompletion(userId), getCurrentStreak(userId), getWeeklyActivity(userId) ])` and returns a single JSON object `{ today, streak, weekly }` with the same caching and error handling.

**Files:**

- `app/api/engagement/route.ts` — combined handler
- `app/api/engagement/today-goal/route.ts`
- `app/api/engagement/streak/route.ts`
- `app/api/engagement/weekly/route.ts`

All handlers use `engagementService` from `@/lib/engagement/engagementService`.

---

## SECTION 3 — Dashboard data fetching strategy

- **Primary:** The dashboard uses **one request**: `GET /api/engagement`. The client component `EngagementSection` calls `fetch('/api/engagement')` in a `useEffect` and parses the combined response.
- **Server → client:** The dashboard page (server component) passes `nextTopicId={recommendation?.topicId ?? null}` into `EngagementSection`. The section uses it so “Start Today’s Session” can link to `/session/[topicId]` when a recommendation exists.
- **When data is loaded:** `loading` is true until the single fetch settles (success or failure). On success, `parseCombined` validates the shape and updates `today`, `streak`, `weekly`. On non-OK or parse failure, fallback state is applied and `loading` is set to false so the section never stays in a permanent loading state.
- **Optional:** The three separate endpoints remain available for other clients or for a future fallback (e.g. if combined fails, retry with three fetches). The current implementation does not fall back to three fetches; it uses safe fallbacks only.

---

## SECTION 4 — Error handling strategy

**Principle:** Errors must not break the dashboard. The engagement section is self-contained: it never throws to the parent and always shows a valid UI.

**Client (`EngagementSection`):**

1. **HTTP:** If `!res.ok`, do not treat the body as success. Do not set state from the response; apply fallbacks.
2. **Network/parse:** In `.catch()` or when `parseCombined` returns null, apply the same fallbacks.
3. **Fallbacks:**  
   - Today: `{ state: 'NOT_STARTED' }`  
   - Streak: `{ current: 0, longest: 0 }`  
   - Weekly: `[]`
4. **Loading:** `setLoading(false)` is always called in `.finally()`, so loading never stays true indefinitely after an error.

**Validation:** `parseCombined` checks that the combined payload has the expected shape (e.g. `today.state`, `streak.current` as number, `weekly` as array). Invalid or partial data is treated like an error and fallbacks are applied.

**Server:** Route handlers catch errors, log them, and return 500 with a generic message. They do not leak stack traces or internal details.

---

## SECTION 5 — Performance optimization

- **Single round-trip:** The dashboard uses `GET /api/engagement` instead of three separate calls, reducing latency and connection overhead.
- **Cache-Control:** All four engagement endpoints set `private, max-age=60, stale-while-revalidate=120` on success so browsers can cache per-user and revalidate in the background.
- **No double fetch:** `EngagementSection` runs one fetch on mount; no redundant calls.
- **Cancellation:** The effect cleanup sets a `cancelled` flag so that if the component unmounts before the request completes, state is not updated after unmount.
- **Optional consolidation tradeoff:** A single endpoint improves performance and simplifies the client; the separate endpoints remain for flexibility (e.g. other UIs that need only one of today/streak/weekly) and can be cached independently if needed later.
