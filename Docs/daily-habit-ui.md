# Daily Learning Habit — UI Implementation

Simple, academic, minimal UI for the Daily Learning Habit System. One primary CTA: Start today's session.

---

## SECTION 1 — Component architecture

- **EngagementSection** (client): Fetches `GET /api/engagement/today-goal`, `GET /api/engagement/streak`, `GET /api/engagement/weekly` on mount; renders DailyGoalCard, StreakIndicator, WeeklyActivityCalendar. Receives optional `nextTopicId` from the dashboard so "Start Today's Session" links to `/session/[topicId]`.
- **DailyGoalCard** (presentational): Shows "Today's Learning Goal", "Complete 1 session", and state (NOT_STARTED | IN_PROGRESS | COMPLETED). Primary CTA button "Start Today's Session" when not completed. No gamification.
- **StreakIndicator** (presentational): Shows "N Day Streak" and "Keep it going tomorrow." Renders nothing when streak is 0. Minimal styling.
- **WeeklyActivityCalendar** (presentational): Seven columns Mon–Sun; each shows ● (session completed) or ○ (no session). Data comes from the weekly API (last 7 days mapped to weekdays).

Data flow: Dashboard (server) passes `recommendation?.topicId` into EngagementSection. EngagementSection fetches the three engagement APIs and passes data into the three presentational components.

---

## SECTION 2 — DailyGoalCard component

- **Location:** `components/home/DailyGoalCard.tsx`
- **Props:** `state` (NOT_STARTED | IN_PROGRESS | COMPLETED), optional `nextTopicId`, optional `loading`.
- **Copy:** Heading "Today's Learning Goal"; body "Complete 1 session." When COMPLETED, subtext "Done for today."
- **CTA:** "Start Today's Session" — visible when state is NOT_STARTED or IN_PROGRESS. Links to `/session/[nextTopicId]` when `nextTopicId` is set, otherwise `/dashboard`.
- **Loading:** Skeleton (heading, body, button placeholders).
- **Styling:** Card with border, padding; primary button; no extra visuals.

---

## SECTION 3 — StreakIndicator component

- **Location:** `components/home/StreakIndicator.tsx`
- **Props:** `current` (number), optional `loading`.
- **Copy:** "N Day Streak" and "Keep it going tomorrow." When `current === 0`, component returns null.
- **Loading:** Skeleton line.
- **Styling:** Card with border; text only; no badges or gamification.

---

## SECTION 4 — WeeklyActivityCalendar component

- **Location:** `components/home/WeeklyActivityCalendar.tsx`
- **Props:** `days` (array of `{ date: string, completed: boolean }`), optional `loading`.
- **Behaviour:** Maps each day to weekday (Mon=0 … Sun=6) via date string; fills 7 slots. Renders Mon–Sun with ● for completed, ○ for no session.
- **Legend:** ● = session completed; ○ = no session.
- **Loading:** Skeleton row of 7 cells.
- **Styling:** Card with border; row of labels and symbols; minimal.

---

## SECTION 5 — Dashboard integration

- **Placement:** At the top of the dashboard main content (above PrimaryActionCard), so the daily goal is the primary CTA.
- **File:** `app/(student)/dashboard/page.tsx` — server component that passes `recommendation?.topicId` from `getNextAction` into EngagementSection.
- **API routes:** `GET /api/engagement/today-goal`, `GET /api/engagement/streak`, `GET /api/engagement/weekly` — all require auth; return JSON from the engagement service.
- **Single clear action:** "Start Today's Session" in DailyGoalCard is the one primary action; it uses the same next topic as the recommendation engine.
