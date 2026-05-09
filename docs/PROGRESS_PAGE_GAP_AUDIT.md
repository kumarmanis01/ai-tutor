<!--
FILE OBJECTIVE:
- Requirement-vs-implementation gap audit for /student/progress (F-STU-033).
- Documents every UI element that shows "no data" and the root cause.
- Serves as the canonical fix tracker for the progress page sprint.

LINKED UNIT TEST:
- N/A (audit document)

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-09T00:00:00Z | copilot | initial audit created
- 2026-05-09T01:00:00Z | copilot | Gap 1 FIXED — narrative API now serves from Redis cache; worker writes result on completion
- 2026-05-09T02:00:00Z | copilot | Gap 6 FIXED — model-specific subject filter shapes for heatmap and trendRows queries; Gap 7 FIXED — deduplicate subjectNames on read
-->

# /student/progress — Requirement vs. Implementation Gap Audit

**Audit date:** 2026-05-09  
**Requirement source:** `docs/v2/01_student.md` → F-STU-033  
**Page file:** `app/(student)/student/progress/page.tsx`  
**Status legend:** 🔴 Critical bug | 🟠 Data/seeding gap | 🟡 Logic bug | 🟢 Working

---

## Summary

All five main sections of the progress page show "no data" in the current environment. The root causes fall into three categories:

1. **API contract mismatch** — the AI Narrative API never returns usable data (critical bug, always broken)
2. **Missing curriculum seed data** — chapter mastery relies on DB records that are not present
3. **New-account data gap** — session history, heatmap, and test trend require completed sessions that don't exist yet for the test student; these will self-heal when real usage begins, but empty states are not actionable enough

---

## Gap 1 — AI Narrative always shows error state ✅ FIXED

**UI section:** "Teacher Vidya's insight" (top of left column)  
**Requirement:** F-STU-033 AC-03 — AI-generated, data-driven insight at the top of the report  
**Status:** FIXED 2026-05-09

### Root cause (historical)

`/api/student/progress/narrative` was enqueuing a BullMQ job and returning
`{ status: "queued", jobId }` (HTTP 202). `AiNarrativeWidget` expected
`{ narrative: string }`, found `data.narrative === undefined`, and always threw
into the error state.

### Fix applied (Option A — Redis cache)

**API route** (`app/api/student/progress/narrative/route.ts`):
1. Checks Redis for `narrative:{userId}` (6 h TTL).
2. Cache HIT → returns `{ narrative: <cached text> }` immediately — no DB, no job.
3. Cache MISS → gathers context (session count, chapter names), enqueues
   `AI_NARRATIVE` job with `cacheKey` + `cacheTtlSeconds` in the payload
   (fire-and-forget), then returns `{ narrative: FALLBACK_NARRATIVE }`.
   The UI shows the encouraging fallback on the first cold visit.
4. On the next visit (typically >1 min later after the worker completes) the
   cache is warm and the personalised AI narrative is served.

**Worker** (`worker/services/aiRequestWorker.ts`):
- After a NARRATIVE job succeeds, writes the LLM output to
  `Redis.set(payload.cacheKey, content, 'EX', payload.cacheTtlSeconds)`.
- If Redis is unavailable or write fails, logs a warning and returns
  `{ status: 'completed', type: 'NARRATIVE' }` — never throws.

**Tests added:**
- `tests/unit/api/student/progress/narrative.spec.ts` — 9 cases covering
  cache HIT, cache MISS, Redis unavailable, auth guard, Redis read error.
- `tests/unit/worker/services/aiRequestWorker.spec.ts` — 4 new NARRATIVE cases
  covering cache write, default TTL, null Redis, Redis.set failure.

### Files changed

| File | Change |
|------|--------|
| `app/api/student/progress/narrative/route.ts` | Rewritten: Redis-first, enqueue+fallback on cold |
| `worker/services/aiRequestWorker.ts` | Added NARRATIVE Redis cache-write block |
| `tests/unit/api/student/progress/narrative.spec.ts` | New — 9 test cases |
| `tests/unit/worker/services/aiRequestWorker.spec.ts` | Updated header + 4 NARRATIVE cases |

---

## Gap 2 — Chapter mastery shows "No chapters available yet" 🟠

**UI section:** Chapter mastery card (right column)  
**Requirement:** F-STU-033 AC-01 — Mastery % per chapter, colour-coded  
**Status:** BROKEN — subject header renders ("Mathematics") but chapters array is empty

### Root cause

`computeReadinessScore` (lib/student/examReadiness.ts line 109) queries:

```ts
prisma.chapterDef.findMany({
  where: { subject: { id: subjectId } },
  select: {
    boardChapterWeights: { select: { weightMarks: true } },
    topics: { select: { concepts: { select: { id: true } } } },
  },
})
```

It returns the zero result (`{ chapters: [] }`) in any of these cases:

| Condition | Cause |
|-----------|-------|
| `chapterDef` table is empty for the subject | Curriculum not seeded |
| `boardChapterWeights` all have `weightMarks = 0` | Board weight seed missing |
| `totalWeightMarks <= 0` | Guard on line 130 forces early return |
| No `concept` rows under any topic | Concept seed missing |

`ChapterMasteryBars` shows the subject header from `subjectDef.name` (which IS found) but renders "No chapters available yet" because `chapters.length === 0`.

### Secondary observation — "Mathematics" appears twice

The subject card renders once per entry in `subjectDefs`. The student's `User.subjects` array appears to contain `"Mathematics"` twice. The deduplication guard is missing in the profile-save path.

### Fix required

1. **Verify/seed curriculum data:** Confirm that `chapterDef`, `topics`, `concepts`, and `boardChapterWeights` records exist for the student's enrolled subjects. Run:
   ```sql
   SELECT cd.name, count(bw.id) as weight_rows
   FROM "ChapterDef" cd
   LEFT JOIN "BoardChapterWeight" bw ON bw."chapterId" = cd.id
   WHERE cd."subjectId" = '<subjectId>'
   GROUP BY cd.name;
   ```
2. **Fallback path:** If `boardChapterWeights` is missing, fall back to equal-weight distribution across chapters so mastery is still visible.
3. **Dedup subjects:** Add `[...new Set(subjects)]` when reading/writing `User.subjects`.

**Files to change:**
- `lib/student/examReadiness.ts` — add equal-weight fallback when board weights are zero
- Profile save route — dedup subjects on write
- Prisma seed script — ensure curriculum data is present

---

## Gap 3 — Session history is empty 🟠

**UI section:** "Session history" table (right column)  
**Requirement:** F-STU-033 AC-01 — Sessions completed, test scores over time  
**Status:** EXPECTED for new accounts; empty state UX is adequate but score data is sparse

### Root cause

`TestScoreHistory` receives rows from:

```ts
prisma.structuredSession.findMany({
  where: { studentId: userId, completedAt: { not: null } },
  select: { meta: true, ... },
})
```

Score is read from `session.meta.score`. This field is only written when the session completion flow explicitly calls `POST /api/student/session/[sessionId]/complete` with a computed score. For sessions abandoned or auto-closed, `meta.score` is `null` and the score column shows `--`.

### Secondary issue — score source mismatch

F-STU-033 AC-01 mentions "Test scores over time" as a separate metric from "Sessions completed". The implementation merges both into a single session history table. Chapter practice test scores (from the `testResult` table) are shown separately in `ScoreTrendGraph` but are a completely different data source.

### Fix required

- This will self-heal as the student completes sessions. No code change required for the empty state.
- **Improve score coverage:** Ensure `meta.score` is written even for auto-closed sessions (e.g., on session timeout). Check `POST /api/student/session/[sessionId]/complete` to confirm score is always written.
- Consider splitting "Session history" and "Test scores" into visually distinct sections to match AC-01 wording.

**Files to change:**
- Session complete route — verify `meta.score` is always written on completion

---

## Gap 4 — Practice test trend is empty 🟠

**UI section:** "Practice test trend" line chart (right column)  
**Requirement:** F-STU-033 AC-01 — Test scores over time  
**Status:** EXPECTED for new accounts; will self-heal after first chapter test

### Root cause

`ScoreTrendGraph` is fed by:

```ts
prisma.testResult.findMany({
  where: {
    studentId: userId,
    score: { not: null },
    finishedAt: { not: null },
    AttemptQuestions: {
      some: {
        question: { chapter: { not: null }, ...subjectFilter },
      },
    },
  },
  take: 10,
})
```

No `testResult` records exist yet. Requires the student to complete at least one chapter practice test via the test-taking flow.

### Secondary bug — `subjectFilter` applied to wrong model field 🟡

When `?subject=Mathematics` is in the URL, `subjectFilter` is:

```ts
{ subject: { equals: 'Mathematics', mode: 'insensitive' } }
```

This is spread directly into `question: { chapter: { not: null }, ...subjectFilter }`. The `Question` model does **not** have a `subject` field — subject is accessible only through `question.chapter.subject`. This will cause a Prisma runtime error or return zero rows when any subject filter is active.

The correct filter should be:

```ts
{ chapter: { not: null, subject: { name: { equals: activeSubject, mode: 'insensitive' } } } }
```

### Fix required

- Empty state is acceptable for new accounts.
- **Fix subject filter on `testResult` query** — correct the Prisma where clause to filter through `question.chapter.subject.name`.

**Files to change:**
- `app/(student)/student/progress/page.tsx` — fix `subjectFilter` for `trendRows` query (line ~130)

---

## Gap 5 — Study time heatmap shows 0 active days 🟠

**UI section:** "Study time — last 4 weeks" heatmap (right column)  
**Requirement:** F-STU-033 AC-01 — Time spent studying (weekly heatmap)  
**Status:** EXPECTED for new accounts; will self-heal

### Root cause

Heatmap is built from `completedAt` sessions in the last 28 days. No completed sessions → all cells grey.

Duration per session is computed as `completedAt - startedAt`. If a student spends 30 minutes but the session is recorded as 0 minutes (same-second start/complete), the cell shows no intensity. This can happen in test environments.

### Secondary bug — `subjectFilter` applied to wrong model field 🟡

The heatmap query spreads `subjectFilter` directly into `structuredSession.where`:

```ts
prisma.structuredSession.findMany({
  where: {
    studentId: userId,
    completedAt: { not: null, gte: heatmapSince },
    ...subjectFilter, // { subject: { equals: 'Mathematics' } } — WRONG
  },
})
```

`structuredSession` has no `subject` field. The subject is reachable through `topic.chapter.subject.name`. This query will throw a Prisma validation error at runtime when `?subject=` is in the URL.

### Fix required

- Empty state acceptable for new accounts.
- **Fix subject filter on heatmap query** — filter through `topic.chapter.subject.name`.

**Files to change:**
- `app/(student)/student/progress/page.tsx` — fix `subjectFilter` for `heatmapSessions` query

---

## Gap 6 — subjectFilter applied to wrong relation paths (multiple queries) ✅ FIXED 2026-05-09

**Cross-cutting bug affecting AC-02 (filter by subject)**

The generic `subjectFilter` variable has been removed and replaced with model-specific
constants inline at each query:

| Query target | Old (broken) | Fixed |
|---|---|---|
| `structuredSession` (heatmap) | `{ subject: { equals: ... } }` at root | `sessionSubjectFilter` via `topic→chapter→subject→name` |
| `testResult.question` (trend) | `{ ...subjectFilter }` spread into `question` | `questionClause` merges `chapter: { not: null, subject: { name: ... } }` |

### Fix applied

```ts
// structuredSession filter — heatmap query
const sessionSubjectFilter = activeSubject
  ? { topic: { chapter: { subject: { name: { equals: activeSubject, mode: 'insensitive' as const } } } } }
  : {};

// question clause — trendRows query (merges chapter: { not: null } constraint)
const questionClause = activeSubject
  ? { chapter: { not: null, subject: { name: { equals: activeSubject, mode: 'insensitive' as const } } } }
  : { chapter: { not: null } };
```

**Files changed:**
- `app/(student)/student/progress/page.tsx` — removed generic `subjectFilter`; replaced with `sessionSubjectFilter` and `questionClause`
- `tests/unit/app/student/progress/subjectFilter.spec.ts` — **new** — 16 test cases covering all filter shapes and dedup logic

---

## Gap 7 — Duplicate subject entries in profile ✅ FIXED 2026-05-09 (read side)

**UI section:** Chapter mastery card shows "Mathematics" twice  
**Requirement:** Each subject should appear once  
**Status:** Read-side fix applied (bundled with Gap 6); write-side dedup still open

### Root cause

No deduplication existed when reading subjects from `User.subjects` (a Prisma Json array). If the student enrolled in "Mathematics" twice (double-submit, retry), both entries were stored and both were passed through to `subjectDefs`, rendering the subject card twice.

### Fix applied

```ts
// Gap 7 fix: deduplicate subjects on read to prevent duplicate subject cards.
const subjectNames = [...new Set(
  (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean),
)];
```

**Files changed:**
- `app/(student)/student/progress/page.tsx` — `subjectNames` now uses `[...new Set(...)]`

**Remaining (write-side, still open):**
- Add deduplication on write in the profile/enrolment save path so duplicates are never stored.

---

## Gap 8 — PDF export route missing mandatory file header 🟡

**File:** `app/api/student/progress/export/route.ts`  
**Requirement:** `.github/copilot-instructions.md` — every file must have a FILE OBJECTIVE header  
**Status:** Header missing; CI will flag this

### Fix required

Add the standard header block at the top of the export route.

---

## Consolidated Fix Priority

| # | Gap | Severity | Effort | Self-heals? | Status |
|---|-----|----------|--------|-------------|--------|
| 1 | Narrative API contract mismatch | 🔴 Critical | Medium | No | ✅ FIXED 2026-05-09 |
| 6 | subjectFilter wrong relation paths | 🔴 Critical | Low | No | ✅ FIXED 2026-05-09 |
| 2 | Chapter mastery — curriculum data missing | 🟠 High | Medium | No | 🔴 Open |
| 7 | Duplicate subjects in profile (read side) | 🟡 Medium | Low | Partial | ✅ FIXED (read) 2026-05-09 |
| 3 | Session history empty | 🟠 High | None | Yes — on first session | 🟠 Open (self-heals) |
| 4 | Practice test trend empty + filter bug | 🟠 High | Low (filter) | Partial | 🔴 Open |
| 5 | Study time heatmap empty + filter bug | 🟠 High | Low (filter) | Partial | 🔴 Open |
| 8 | PDF export missing file header | 🟡 Low | Trivial | No | 🔴 Open |

---

## Acceptance Criteria Status After Fixes

| AC | Description | Current | After Gaps Fixed |
|----|-------------|---------|-----------------|
| AC-01 | Sessions chart (trend last 30 days) | Shows bars — empty for new users | ✅ Works once sessions exist |
| AC-01 | Mastery % per chapter (colour-coded) | ❌ Empty (curriculum data missing) | ✅ After seed + fallback fix |
| AC-01 | Test scores over time | ❌ Empty (no test results yet) | ✅ After first chapter test |
| AC-01 | Time spent studying (weekly heatmap) | ❌ Empty (no sessions yet) | ✅ After first completed session |
| AC-01 | Concepts mastered count | ✅ Shows 0 correctly | ✅ |
| AC-02 | Filterable by subject | ✅ FIXED — model-specific filter shapes applied | ✅ Working |
| AC-02 | Filterable by time range | ✅ Working | ✅ |
| AC-03 | AI-generated narrative insight | ✅ FIXED — cache HIT serves AI text; MISS returns fallback while worker generates | ✅ Working |
| AC-04 | Download as PDF | ✅ Working | ✅ |
| AC-05 | Accessible on free tier | ✅ No paywall | ✅ |

---

## Files Requiring Changes (in fix order)

1. `app/api/student/progress/narrative/route.ts` — serve from Redis cache or synchronous fallback
2. `app/(student)/student/progress/page.tsx` — fix subjectFilter shapes; deduplicate subjects
3. `lib/student/examReadiness.ts` — add equal-weight fallback when boardChapterWeights missing
4. Profile/enrolment save route — deduplicate User.subjects on write
5. `app/api/student/progress/export/route.ts` — add FILE OBJECTIVE header
6. Prisma seed — ensure chapterDef + boardChapterWeights + topics + concepts are seeded for all active subjects
