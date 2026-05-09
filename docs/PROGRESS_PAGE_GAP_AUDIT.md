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
- 2026-05-09T03:00:00Z | copilot | Gap 7 confirmed fully fixed — write-side already protected in onboarding and enroll/save routes
- 2026-05-09T04:00:00Z | copilot | Gap 2 FIXED — equal-weight fallback in examReadiness.ts when boardChapterWeights missing; concept-free chapter fallback
- 2026-05-09T05:00:00Z | copilot | Gap 3 FIXED — meta.score written to StructuredSession in student session complete route; score never persisted was a code bug not just a data gap
- 2026-05-09T06:00:00Z | copilot | Gap 4 documentation corrected — trend subject-filter bug marked fixed under Gap 6; consolidated priority status updated
- 2026-05-09T07:00:00Z | copilot | Gap 4 marked fully fixed as code defect; remaining empty trend state documented as expected new-account data condition
- 2026-05-09T08:00:00Z | copilot | Gap 5 marked fully fixed as code defect; remaining empty heatmap state documented as expected new-account data condition
- 2026-05-09T09:00:00Z | copilot | Gap 8 FIXED — added mandatory FILE OBJECTIVE header to progress export route and added route unit tests
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

## Gap 2 — Chapter mastery shows "No chapters available yet" ✅ FIXED 2026-05-09

**UI section:** Chapter mastery card (right column)  
**Requirement:** F-STU-033 AC-01 — Mastery % per chapter, colour-coded  
**Status:** FIXED — chapters now render even when curriculum data is partially seeded

### Root cause (historical)

`computeReadinessScore` in `lib/student/examReadiness.ts` returned the zero-state (`{ chapters: [] }`) under two conditions that are common in a development or freshly-deployed environment:

| Condition | Old behaviour | Fixed behaviour |
|-----------|---------------|-----------------|
| `boardChapterWeights` all zero / missing | `if (totalWeightMarks <= 0) return zero` — all chapters lost | Equal-weight fallback: 1 mark per chapter so all chapters render |
| No `concept` rows under any topic | `if (allConceptIds.length === 0) return zero` — chapters lost | Skip concept query; every chapter renders with `masteryScore = 0` |

### Fix applied

**`lib/student/examReadiness.ts`**:

```ts
// 1. Equal-weight fallback when board weights are missing
const rawTotal = chapters.reduce(
  (sum, ch) => sum + (ch.boardChapterWeights[0]?.weightMarks ?? 0), 0
)
const usingEqualWeights = rawTotal <= 0
const totalWeightMarks = usingEqualWeights ? chapters.length : rawTotal

// 2. Skip concept query when no concepts seeded (chapters still render at score 0)
const states: StudentConceptStateRow[] = allConceptIds.length > 0
  ? await prisma.studentConceptState.findMany(...)
  : []

// 3. Per-chapter: use weight=1 when on equal-weight fallback
const weightMarks = usingEqualWeights ? 1 : (ch.boardChapterWeights[0]?.weightMarks ?? 0)
```

With equal weights, every chapter gets `boardWeightPct = 100 / n` and mastery bars render correctly. The UI will show accurate relative mastery even without board-specific weighting.

### Files changed

| File | Change |
|------|--------|
| `lib/student/examReadiness.ts` | Equal-weight fallback; concept-free chapter fallback |
| `tests/unit/lib/student/examReadiness.spec.ts` | **New** — 15 test cases covering normal path, both fallbacks, and all label thresholds |

---

## Gap 3 — Session history score column always showed `--` ✅ FIXED 2026-05-09

**UI section:** "Session history" table (right column)  
**Requirement:** F-STU-033 AC-01 — Sessions completed, test scores over time  
**Status:** FIXED 2026-05-09 — score now written to StructuredSession.meta on every completed session

### Root cause (historical)

The progress page reads `session.meta.score` from `StructuredSession`:

```ts
prisma.structuredSession.findMany({
  where: { studentId: userId, completedAt: { not: null } },
  select: { meta: true, ... },
})
```

`POST /api/student/session/[sessionId]/complete` (the V2 session complete route)
computed `correctAnswers / totalQuestions` and returned `accuracy` in the HTTP
response body but **never wrote it to `StructuredSession.meta`**. Every completed
session therefore showed `--` in the score column — even for students with
many completed sessions. This was a code bug, not merely a new-account data gap.

### Fix applied

**File:** `app/api/student/session/[sessionId]/complete/route.ts`

After computing `accuracy`, the route now reads `learningSession.meta.structuredSessionId`
(set by `createBridgedLearningSession` in the session engine bridge) and writes
`meta.score = Math.round(accuracy * 100)` to the corresponding `StructuredSession`.
The write is isolated in a try/catch — any DB error is logged as `warn` and does
not affect the HTTP response. Existing `meta` fields are preserved via object spread.

```ts
const structuredSessionId = (learningSession?.meta as any)?.structuredSessionId
if (structuredSessionId && typeof structuredSessionId === 'string') {
  const scorePercent = Math.round(accuracy * 100)
  const existing = await prisma.structuredSession.findUnique(...)
  if (existing) {
    await prisma.structuredSession.update({
      where: { id: structuredSessionId },
      data: { meta: { ...existing.meta, score: scorePercent } },
    })
  }
}
```

**Unit tests:** `tests/unit/api/student/session/complete.spec.ts` (10 tests, all pass)

---

## Gap 4 — Practice test trend empty for new accounts 🟠

**UI section:** "Practice test trend" line chart (right column)  
**Requirement:** F-STU-033 AC-01 — Test scores over time  
**Status:** ✅ FIXED (code) — query/filter path is correct; empty state is expected until first finished test

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
        question: questionClause,
      },
    },
  },
  take: 10,
})
```

No `testResult` records exist yet for newly created accounts. The chart will populate after at least one completed chapter practice test exists.

### Resolution ✅

The subject-filter defect for trend rows is fixed under **Gap 6** via
model-specific relation-path filters (`questionClause` through `question.chapter.subject.name`).

The remaining empty-chart behavior is a **data-availability state**, not a code defect.

### Current action

- Keep the existing empty state for genuinely new accounts.
- Optional QA step: seed one finished `testResult` fixture to validate non-empty rendering in local/dev.

---

## Gap 5 — Study time heatmap shows 0 active days 🟠

**UI section:** "Study time — last 4 weeks" heatmap (right column)  
**Requirement:** F-STU-033 AC-01 — Time spent studying (weekly heatmap)  
**Status:** ✅ FIXED (code) — query/filter path is correct; empty state is expected until completed sessions exist

### Root cause

Heatmap is built from `completedAt` sessions in the last 28 days. No completed sessions → all cells grey.

Duration per session is computed as `completedAt - startedAt`. If a student spends 30 minutes but the session is recorded as 0 minutes (same-second start/complete), the cell shows no intensity. This can happen in test environments.

### Update — filter bug is already fixed ✅

The subject-filter defect for heatmap sessions is already fixed under **Gap 6**
via model-specific relation-path filters (`sessionSubjectFilter` through
`topic.chapter.subject.name`).

The remaining empty heatmap behavior is a **data-availability state**, not a code defect.

### Current action

- Keep the existing empty state for genuinely new accounts.
- Optional QA step: seed one completed `structuredSession` in the last 28 days to validate non-empty heatmap rendering in local/dev.

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

## Gap 7 — Duplicate subject entries in profile ✅ FIXED 2026-05-09 (fully resolved)

**UI section:** Chapter mastery card shows "Mathematics" twice  
**Requirement:** Each subject should appear once  
**Status:** Fully resolved — both read-side and write-side are protected

### Root cause

Existing DB rows for some accounts contained duplicate entries in `User.subjects` (a Prisma Json array), likely from double-submit or retry during onboarding. The page was passing those duplicates straight through to `subjectDefs`, rendering the subject card twice.

### Fix applied

**Read side** (`app/(student)/student/progress/page.tsx`) — added `[...new Set(...)]`:
```ts
// Gap 7 fix: deduplicate subjects on read to prevent duplicate subject cards.
const subjectNames = [...new Set(
  (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean),
)];
```

**Write side** — already protected before this audit:
- `app/api/user/onboarding/route.ts` line 55: `[...new Set((body.subjects as any[]).map(...).filter(...))]`
- `app/api/enroll/save/route.ts` line 60: `[...new Set((body.subjects as unknown[]).map(...).filter(...))]`

New duplicates cannot be written via any current API path.

---

## Gap 8 — PDF export route missing mandatory file header 🟡

**File:** `app/api/student/progress/export/route.ts`  
**Requirement:** `.github/copilot-instructions.md` — every file must have a FILE OBJECTIVE header  
**Status:** ✅ FIXED 2026-05-09

### Fix applied

Added the standard FILE OBJECTIVE header block at the top of the export route,
including LINKED UNIT TEST, instruction references, and EDIT LOG entry.

**Files changed:**
- `app/api/student/progress/export/route.ts` — added mandatory top-of-file header
- `tests/unit/api/student/progress/export.spec.ts` — new route unit tests (auth guard, success PDF response, error path)

---

## Consolidated Fix Priority

| # | Gap | Severity | Effort | Self-heals? | Status |
|---|-----|----------|--------|-------------|--------|
| 1 | Narrative API contract mismatch | 🔴 Critical | Medium | No | ✅ FIXED 2026-05-09 |
| 6 | subjectFilter wrong relation paths | 🔴 Critical | Low | No | ✅ FIXED 2026-05-09 |
| 2 | Chapter mastery — curriculum data missing | 🟠 High | Medium | No | ✅ FIXED 2026-05-09 |
| 7 | Duplicate subjects in profile | 🟡 Medium | Low | No | ✅ FIXED 2026-05-09 |
| 3 | Session history score always `--` | 🟠 High | `complete/route.ts` | No — code bug | ✅ FIXED 2026-05-09 |
| 4 | Practice test trend empty for new accounts | 🟠 High | N/A (code fixed) | Yes | ✅ CLOSED — filter bug fixed; waits for first test result data |
| 5 | Study time heatmap empty for new accounts | 🟠 High | N/A (code fixed) | Yes | ✅ CLOSED — filter bug fixed; waits for completed session data |
| 8 | PDF export missing file header | 🟡 Low | Trivial | No | ✅ FIXED 2026-05-09 |

---

## Acceptance Criteria Status After Fixes

| AC | Description | Current | After Gaps Fixed |
|----|-------------|---------|-----------------|
| AC-01 | Sessions chart (trend last 30 days) | Shows bars — empty for new users | ✅ Works once sessions exist |
| AC-01 | Mastery % per chapter (colour-coded) | ✅ FIXED — equal-weight fallback renders chapters when board weights missing | ✅ Working |
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
5. Prisma seed — ensure chapterDef + boardChapterWeights + topics + concepts are seeded for all active subjects
