# On-Demand Diagnostic Question Generator
## Source of Truth

Last updated: 2026-04-21

---

## Problem

When a student clicks "Start Diagnostics" for a board/grade/subject combination that
has not yet been pre-seeded by the admin HydrateAll pipeline, they land in an
indefinite wait. Nothing in the student-triggered path kicks off content generation,
and the only recovery path (admin runs HydrateAll) is completely decoupled from the
student's session. The "Notify me when ready" email fires at most once per 24 hours,
and silently drops the notification if the Resend call fails.

---

## Desired Student Journey

```
Student taps "Start Diagnostics"
          |
          v
  Content already in DB?
  /              \
Yes               No
  |                |
  v                v
Render test    Trigger generation immediately (this feature)
               Show waiting screen with live progress
                          |
             [~30s for questions-only case]
             [~2–5 min for full pipeline case]
                          |
                          v
               Auto-navigate to test (no manual reload)
```

The student should never see an indefinite spinner. Every wait has a bounded estimate
and a visible progress phase. Auto-navigation means zero manual steps after clicking
"Start Diagnostics".

---

## Two Generation Paths

### Path A — Questions missing, topics already exist (~30 s)

Triggered by: `FEATURE_ONDEMAND_DIAGNOSTIC=true` (must be set on VPS).

When `generateSubjectDiagnosticTest` finds topics but returns zero questions, it
calls `generateDiagnosticQuestionsOnDemand`, which makes a single `gpt-4o-mini` call
with a 30 s timeout, generates all 15 MCQs, and persists them to the `Question` table.

Concurrency guard: A Redis lock (`diagnostic:gen-lock:{subjectId}`, 90 s TTL) ensures
only one OpenAI call fires per subject at a time. Concurrent arrivals get `[]` back,
see the `DiagnosticWaitingScreen` with `reason: "questions"`, and are auto-navigated
once the first caller's results land in DB (~30 s).

After the first generation the questions are in the DB permanently; all subsequent
students get them instantly from the bank.

### Path B — Topics (syllabus) missing (~2–5 min)

Triggered by: `DiagnosticWaitingScreen` calling
`POST /api/student/diagnostic/trigger-generation` on mount.

The endpoint creates a `HydrationJob` (type `syllabus`) + `Outbox` row in a single
transaction, exactly mirroring the admin `POST /api/admin/hydrateAll` pattern. The
existing outbox dispatcher picks it up and feeds it to the `content-hydration` BullMQ
queue. The reconciler then drives the full cascade:

```
HydrationJob (syllabus, Level 0)
  -> syllabusWorker  generates ChapterDef + TopicDef
  -> reconciler      creates Level 2 notes + questions jobs
  -> questionsWorker generates GeneratedQuestion rows
```

Idempotency: if a HydrationJob for this `subjectId` is already `pending` or `running`,
`trigger-generation` returns the existing job ID without creating a new one.

---

## New Endpoints

### `GET /api/student/diagnostic/check-ready`

Auth-guarded. Lightweight readiness check for client polling.

Query: `?subjectId={id}`

Response:
```json
{ "ready": false, "phase": "topics" }
{ "ready": false, "phase": "questions" }
{ "ready": true,  "phase": "ready" }
```

Logic:
1. Count active `TopicDef` rows for the subject.
2. If 0 → `phase: "topics"` (syllabus pipeline not done).
3. Count `Question` (status ACTIVE) + `GeneratedQuestion` rows for those topics.
4. If 0 → `phase: "questions"` (question pipeline not done).
5. Otherwise → `ready: true`.

No DB writes. Designed for 5 s polling with negligible load.

### `POST /api/student/diagnostic/trigger-generation`

Auth-guarded. Idempotent. Fires once on `DiagnosticWaitingScreen` mount.

Body: `{ "subjectId": string }`

Response:
```json
{ "triggered": true,  "phase": "topics",    "jobId": "..." }
{ "triggered": false, "phase": "topics",    "jobId": "..." }   // job already running
{ "triggered": false, "phase": "questions"                  }   // topics exist; Path A handles it
{ "triggered": false, "phase": "ready"                      }   // content already in DB
```

Behaviour for `phase: "topics"`:
- Looks up `SubjectDef` with `class.board` and `class.grade`.
- Checks for existing `HydrationJob` (`subjectId`, status `pending` or `running`).
- If none: creates `HydrationJob` + `Outbox` in one transaction. Sets
  `language` from student profile (defaults to `en`).
- Returns `triggered: true` with the new or existing `jobId`.

---

## Updated DiagnosticWaitingScreen

Replaces the 30 s full-page reload with:

1. **On mount** — calls `POST /api/student/diagnostic/trigger-generation` once.
   Sets `triggerState` to track the result.

2. **5 s polling** — calls `GET /api/student/diagnostic/check-ready` every 5 s.
   Updates `phase` display to "Loading your syllabus..." or "Preparing your questions..."

3. **Auto-navigate** — when `ready: true`, calls `window.location.reload()` so the
   Server Component re-runs and renders the diagnostic directly. No manual action needed.

4. **Fallback** — if polling fails 3 times in a row, falls back to showing
   "Tap to retry" with a manual reload button (avoids infinite silent failure).

5. **"Notify me when ready"** — remains as secondary action for students who leave
   the page before the auto-navigate fires.

---

## Fixed: Notification Reliability

`worker/jobs/diagnosticReadinessCheck.ts` previously deleted the Redis key regardless
of whether the email send succeeded (because `sendMailSafe` swallows errors).

Fix: call `sendMail` directly inside a `try/catch`. Only delete the key on success.
On failure, log the error and leave the key — the next daily run will retry.

```
Before:
  sendMailSafe(...)     // never throws
  redis.del(key)        // always runs → notification lost on email failure

After:
  try {
    await sendMail(...)
    await redis.del(key)   // only if send succeeded
    notified++
  } catch (err) {
    logger.error(...)      // key survives → retried tomorrow
  }
```

---

## VPS Environment Flags

| Flag | Current | Required | Action |
|------|---------|----------|--------|
| `FEATURE_ONDEMAND_DIAGNOSTIC` | unset | `true` | Add to `ecosystem.config.cjs` + `pm2 restart all` |

No other flags need to change. `LLM_MODE=real` is already set, which is required for
`gpt-4o-mini` calls in `generateDiagnosticQuestionsOnDemand`.

---

## Cost Estimate

Path A (questions-only, per subject, one-time): one `gpt-4o-mini` call,
~4 000 output tokens. At current pricing ~$0.002 per generation. After first student
triggers it, all subsequent students pay $0.

Path B (full pipeline): same cost as a manual admin HydrateAll run for the subject.

---

## Files Changed

| File | Change |
|------|--------|
| `docs/v2/on-demand-generator.md` | This document (new) |
| `app/api/student/diagnostic/check-ready/route.ts` | New GET endpoint |
| `app/api/student/diagnostic/trigger-generation/route.ts` | New POST endpoint |
| `lib/diagnostics/diagnosticQuestionService.ts` | Concurrency lock in `generateDiagnosticQuestionsOnDemand` |
| `components/student/diagnostic/DiagnosticWaitingScreen.tsx` | Polling + auto-navigate |
| `worker/jobs/diagnosticReadinessCheck.ts` | Email-delete reliability fix |
| `tests/unit/api/diagnostic_check_ready.spec.ts` | New unit tests |
| `tests/unit/api/diagnostic_trigger_generation.spec.ts` | New unit tests |

---

## Out of Scope (post-launch backlog)

- Persist notification subscriptions to a DB table for full audit trail and retries.
- Trigger `diagnosticReadinessCheck` immediately when the reconciler finalises a job
  (instead of waiting for the daily cron).
- Push notification when diagnostic is ready (requires notification permission grant).
