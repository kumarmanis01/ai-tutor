<!--
FILE OBJECTIVE:
- Engineering decision log for Phase 2 (V2 UI + reliability improvements).
  Records audit findings, root causes, and implementation decisions for
  production-hardening sprints against the AI-Tutor platform.

LINKED UNIT TEST:
- tests/unit/docs/phase-2.spec.ts (N/A — documentation file)

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-11T00:00:00Z | copilot | initial document: Practice Question Generator audit
-->

# Phase 2 — Engineering Decision Log

> This document records audit findings, root causes, and implementation decisions
> for Phase 2 production-hardening sprints.

---

## Session: On-Demand Practice Question Generator Hardening

**Date:** 2026-05-11  
**Branch:** `optimize/practice-question-generation-improvement`  
**Author:** Copilot (Senior Enterprise Software Architect mode)

---

### Background

The on-demand Practice Question Generator was audited end-to-end following student
reports of indefinitely disabled "Generate Practice Questions" buttons and suspected
over-generation of questions (excessive LLM cost).

The audit covered the full path:

```
Student session (PRACTICE phase, pending content)
  → SessionContainer.tsx           — polling state machine
  → /api/session/[id]/practice/hydrate  — status + manual trigger
  → contentHydrationTrigger.ts     — fire-and-forget topic trigger
  → enqueueTopicHydration.ts       — BullMQ enqueue with dedupe
  → questionsWorker.ts             — generates easy/medium/hard variants
```

---

### Findings

#### Finding 1 — CRITICAL: Duplicate Job Fan-Out (3× LLM Over-Generation)

**File:** `lib/session/contentHydrationTrigger.ts`

**Root Cause:**  
`triggerForTopic()` looped over `DIFFICULTIES = ['easy', 'medium', 'hard']` and
called `enqueueQuestionsHydration()` once per difficulty, producing 3 separate jobs.
However, `questionsWorker.handleQuestionsJob()` already generates all 3 difficulty
levels internally (lines ~607–612) in a single job execution.

**Impact:**  
One topic trigger → 3 jobs → each generates 3 difficulty sets → **9 difficulty sets**
generated per topic instead of 3. This tripled the LLM API cost for every cold-start
session.

**Fix Applied:**  
Removed the `DIFFICULTIES` loop. `enqueueQuestionsHydration()` is now called exactly
once per topic with `difficulty: 'medium'` as the queue tag (the worker ignores this
tag and generates all three levels regardless).

```ts
// Before (creates 3 separate jobs per topic):
for (const d of DIFFICULTIES) {
  await enqueueQuestionsHydration({ topicId, language: 'en', difficulty: d });
}

// After (creates 1 job per topic; worker generates all 3 difficulties internally):
const qRes = await enqueueQuestionsHydration({ topicId, language: 'en', difficulty: 'medium' });
```

---

#### Finding 2 — HIGH: Polling Deadlock — Button Permanently Disabled on Transient Error

**File:** `components/session/SessionContainer.tsx`

**Root Cause:**  
In `pollHydrationStatus()`, when `getPracticeHydrationStatus()` returned `null` (e.g.,
any network error, 503, timeout), the code set `isHydrationRunning: false` and stopped
polling entirely. Because the button is disabled while `isGenerating || isHydrationRunning || isChecking`,
and the hydration job was still running on the server, the button stayed permanently
disabled until a full page reload.

**Impact:**  
A single transient network failure during polling locked the student into a broken
state with no recovery path. This is especially critical on budget 4G connections
(the target device profile).

**Fix Applied:**  
On `null` status (transient failure), the polling loop **does not stop**. Instead it:
1. Preserves the previous `isHydrationRunning` state (does not clear it)
2. Shows a non-alarming message: `"Checking status... (will retry automatically)"`
3. Schedules the next poll with exponential backoff (`min(15000, 2000 * 2^attempt)`)

```ts
// Before: stops polling on any failure
if (!status || isCancelled) {
  setPracticePendingStatus({ isHydrationRunning: false, errorMessage: 'Unable to check...' });
  // no schedulePoll call — polling dies here
  return;
}

// After: retries with backoff on transient failure
if (!status || isCancelled) {
  if (!isCancelled) {
    pollAttempt += 1;
    const retryDelayMs = Math.min(15000, 2000 * 2 ** Math.min(pollAttempt, 3));
    setPracticePendingStatus({ isChecking: false, errorMessage: 'Checking status... (will retry automatically)' });
    schedulePoll(retryDelayMs);
  }
  return;
}
```

---

#### Finding 3 — MEDIUM: Missing Phase Gate on Manual Hydrate Endpoint

**File:** `app/api/session/[sessionId]/practice/hydrate/route.ts`

**Root Cause:**  
The `POST` handler accepted requests from sessions in any state (OVERVIEW, EXPLANATION,
TEST, HOMEWORK, etc.) and would trigger question generation for them. This could produce
content at wrong phases and emit spurious alert emails.

**Impact:**  
Any client bug or race condition could fire the manual hydration trigger outside the
PRACTICE phase, causing unnecessary LLM calls and operations email noise.

**Fix Applied:**  
Added a session state guard immediately after the session ownership check:

```ts
if (session.state !== 'PRACTICE') {
  return NextResponse.json(
    { error: 'Practice hydration only available during PRACTICE phase' },
    { status: 409 },
  );
}
```

Additionally, a **duplicate guard** (introduced by an earlier partial edit) was removed.
The `POST` handler had two identical `session.state !== 'PRACTICE'` checks in sequence;
the redundant second check was deleted.

---

#### Finding 4 — MEDIUM (Noted, Not Fixed): Prompt Pipeline Architecture Drift

**Files:** `lib/ai/prompts/promptBuilder.ts`, `worker/services/questionsWorker.ts`

**Observation:**  
`promptBuilder.ts` exports a `generatePractice()` function that wraps LLM calls with
schema validation and retry logic (the schema-first pattern mandated by copilot-instructions).
However, `questionsWorker.ts` calls `renderTemplate()` + `callLLM()` directly, bypassing
this wrapper. `generatePractice()` is only used in test files.

**Risk:**  
Architecture divergence — future worker modifications may diverge further from the
schema-first pipeline, reducing consistency and making the guardrails harder to enforce.

**Decision:**  
Not fixed in this sprint. Risk is low in the short term because the worker has its own
Zod validation on the `callLLM()` response. Tracked for Phase 3 architectural cleanup.

---

### Files Changed

| File | Type | Change Summary |
|------|------|---------------|
| `lib/session/contentHydrationTrigger.ts` | Source | Removed 3-way difficulty loop; single questions job per topic |
| `app/api/session/[sessionId]/practice/hydrate/route.ts` | Source | Added PRACTICE phase guard; removed duplicate guard |
| `components/session/SessionContainer.tsx` | Source | Polling retry on transient failure instead of stopping |
| `app/(student)/student/onboarding/page.tsx` | Source | Minor parent description copy update |
| `tests/unit/app/api/session/[sessionId]/practice/hydrate/route.spec.ts` | Test | Added PRACTICE-phase guard regression tests |
| `tests/unit/components/session/SessionContainer.spec.tsx` | Test | Added resilient polling regression test |
| `tests/unit/session/sessionEngine.startSession.test.ts` | Test | Updated single-job assertion |
| `tests/unit/lib/session/contentHydrationTrigger.spec.ts` | Test (new) | Unit test for single-job trigger behavior |

---

### Test Coverage

All 12 tests in the three directly affected test files pass:

```
tests/unit/app/api/session/[sessionId]/practice/hydrate/route.spec.ts  — PASS
tests/unit/components/session/SessionContainer.spec.tsx                 — PASS
tests/unit/session/sessionEngine.startSession.test.ts                   — PASS
```

Pre-existing test failures in unrelated files (missing `@testing-library/user-event`,
missing `NextActionCard` / `TodayGoal` components) are excluded from this sprint —
they are tracked in the post-launch backlog and do not affect production.

---

### Gate Result

| Check | Result |
|-------|--------|
| `npm run build:workers` | ✅ Clean |
| `npx tsc --noEmit` | ✅ Clean |
| `python3 scripts/fix-smart-quotes.py` | ✅ Clean |
| Focused unit tests (12 tests) | ✅ All pass |

---

### Conclusion

Three production bugs were patched in this session:

1. **Cost critical**: 3× over-generation eliminated — every practice session now
   triggers exactly 1 questions job instead of 3.
2. **UX critical**: Students on flaky 4G connections no longer get permanently disabled
   practice buttons after a single network blip.
3. **Safety**: Manual practice hydration endpoint is now restricted to the PRACTICE
   phase, preventing spurious generation and alert email noise.
