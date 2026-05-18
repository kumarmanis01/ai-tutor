# Hydration Infrastructure Audit

> Scope: content ingestion (syllabus, chapters, topics, notes, questions, tests) and the serving layer
> that delivers that content to students.
> Last updated: 2026-05-18 (fixes applied same day)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Hydration Workflow](#2-hydration-workflow)
3. [Key Files](#3-key-files)
4. [LLM Calls](#4-llm-calls)
5. [Prompts](#5-prompts)
6. [DB Hits -- Ingestion Path](#6-db-hits----ingestion-path)
7. [Validation](#7-validation)
8. [Content Serving](#8-content-serving)
9. [DB Hits -- Serving Path](#9-db-hits----serving-path)
10. [Caching and Redis Usage](#10-caching-and-redis-usage)
11. [Performance Characteristics](#11-performance-characteristics)
12. [Difficulty-Based Question Serving](#12-difficulty-based-question-serving)
13. [Limitations -- Fixed](#13-limitations----fixed)
14. [Environment Variables Reference](#14-environment-variables-reference)

---

## 1. Architecture Overview

Content hydration is a fully asynchronous, queue-driven pipeline.
No LLM call is made synchronously inside an API route or server component.

```
Trigger (admin/reconciler)
        |
        v
  Hydrator (enqueue-only)
        |  creates HydrationJob + Outbox row (same DB transaction)
        v
  Outbox Dispatcher
        |  polls Outbox, pushes to BullMQ
        v
  contentQueue (BullMQ + Redis)
        |
        v
  contentWorker (processor)
        |  resolves job type, dispatches
        +---> syllabusWorker   (SYLLABUS job)
        +---> notesWorker      (NOTES job)
        +---> questionsWorker  (QUESTIONS job)
        +---> assembleWorker   (ASSEMBLE job)
        |
        v
  LLM call (callLLM)
        |  OpenAI primary, Anthropic haiku failover
        v
  Validation (aiOutputValidator)
        |  Zod schema + semantic gates + placeholder detection
        v
  DB write (Prisma $transaction with retry)
        |
        v
  Soft-approve / version persisted
```

---

## 2. Hydration Workflow

### 2.1 Entry Points

| Trigger | File | Scope |
|---------|------|-------|
| Admin UI "Hydrate All" | `app/api/admin/hydrateAll/route.ts` | Full subject tree |
| Reconciler (cron, every 5 min) | `worker/services/hydrationReconciler.ts` | Pending topics (fills gaps) |
| Direct enqueue | `hydrators/hydrateSyllabus.ts`, `hydrators/hydrateNotes.ts`, `hydrators/hydrateQuestions.ts` | Per-subject or per-topic |

### 2.2 Job Lifecycle

```
Pending --> Running --> Completed
                   \--> Failed
                   \--> Paused  (HYDRATION_PAUSED system setting)
```

Each `HydrationJob` row has `attempts`, `lockedAt`, `lastError`, `contentReady`, and `hierarchyLevel`.
BullMQ retries a job up to 3 times (5 s initial delay, exponential backoff).
The worker also has its own LLM-level retry (up to 3 attempts, 2 s base delay).
Notes has an additional semantic-quality retry (1 extra attempt with a quality hint appended to the prompt).

### 2.3 Idempotency

All enqueue functions check for an existing `Pending` or `Running` job before creating a new one.
Unique DB constraints enforce at-most-one active job per `(topicId, language, jobType, difficulty)`.
Content writes use `upsert` on `(topicId, language, version)` / `(topicId, language, difficulty, version)`.

### 2.4 Hierarchy

The reconciler creates jobs in dependency order:

```
Level 1: SYLLABUS   (creates ChapterDef + TopicDef rows)
Level 2: NOTES      (requires TopicDef to exist)
Level 3: QUESTIONS  (requires TopicDef to exist)
Level 4: ASSEMBLE   (requires GeneratedTest rows to exist)
```

Workers enforce their expected hierarchy level at runtime and fail fast if the level is wrong.

### 2.5 Kill Switches

| Setting (SystemSetting.key) | Effect |
|-----------------------------|--------|
| `HYDRATION_PAUSED` | Pauses all job types |
| `HYDRATION_DISABLED_NOTES` | Pauses NOTES jobs only |
| `HYDRATION_DISABLED_QUESTIONS` | Pauses QUESTIONS jobs only |
| `AI_PAUSED` | Blocks all LLM calls |

---

## 3. Key Files

### Hydrators (enqueue-only, no LLM)

| File | Responsibility |
|------|---------------|
| `hydrators/hydrateSyllabus.ts` | Calls `enqueueSyllabusHydration()` -- idempotent check, resolves `subjectId`, creates `HydrationJob` + `Outbox` |
| `hydrators/hydrateNotes.ts` | Delegates to `enqueueNotesHydration()` in execution-pipeline |
| `hydrators/hydrateQuestions.ts` | Delegates to `enqueueQuestionsHydration()` in execution-pipeline |
| `hydrators/assembleTest.ts` | Test assembly helpers |
| `hydrators/hydrationPrompts.ts` | Legacy prompts -- deprecated, not used by active workers |

### Execution Pipeline

| File | Responsibility |
|------|---------------|
| `lib/execution-pipeline/enqueueTopicHydration.ts` | `enqueueNotesHydration`, `enqueueQuestionsHydration`, `enqueueTestsHydration` -- all idempotent, create `HydrationJob` + `Outbox` in same transaction |

### Workers

| File | Responsibility |
|------|---------------|
| `worker/processors/contentWorker.ts` | BullMQ processor -- resolves `HydrationJob`, dispatches to worker service |
| `worker/services/syllabusWorker.ts` | Syllabus generation -- 1 LLM call, per-chapter transactions |
| `worker/services/notesWorker.ts` | Notes generation -- 1 LLM call + optional retry, versioned `TopicNote` upsert |
| `worker/services/questionsWorker.ts` | Questions generation -- 3 LLM calls (1 per difficulty), soft-promotes to `Question` table |
| `worker/services/assembleWorker.ts` | Test assembly -- no LLM call, auto-approves if >= 5 questions |
| `worker/services/hydrationReconciler.ts` | Gap-filling cron (every 5 min) -- scans for un-hydrated topics, enqueues missing jobs |

### Infrastructure

| File | Responsibility |
|------|---------------|
| `lib/callLLM.ts` | Single LLM call surface -- model selection, retry, timeouts, circuit breaker, cost logging |
| `lib/aiOutputValidator.ts` | Zod schemas + semantic gates + placeholder detection for all content types |
| `lib/execution-pipeline/submitJob.ts` | Low-level BullMQ enqueue helper |
| `queues/contentQueue.ts` | BullMQ queue factory -- lazy init, shared Redis IORedis connection |
| `lib/redis.ts` | Redis singleton with TLS support, exponential-backoff reconnect |
| `lib/cache.ts` | Thin `cacheGet` / `cacheSet` / `cacheDel` / `cacheDelPattern` over Redis |
| `prompts/index.ts` + `prompts/renderer.ts` | Prompt template rendering with schema fingerprinting |

---

## 4. LLM Calls

### 4.1 Model Selection (in `callLLM.ts`)

| Prompt type | Model (env override) | Default |
|-------------|---------------------|---------|
| `syllabus`, `topics`, `structure` | `MODEL_SMALL` | `gpt-4o-mini` |
| `notes`, `doubts`, `practice` | `MODEL_MEDIUM` | `gpt-4o` |
| `questions` | `MODEL_LARGE` | `gpt-4o` |
| `tutor:hint`, `tutor:eval` | `MODEL_SMALL` | `gpt-4o-mini` |
| `tutor:teach` | `MODEL_MEDIUM` | `gpt-4o` |

Failover: if OpenAI circuit is open, `callLLM` falls back to `claude-haiku-4-5-20251001` (Anthropic).

### 4.2 Per-Worker LLM Call Summary

#### Syllabus Worker
- **Calls per job:** 1
- **Model:** `gpt-4o-mini` (syllabus promptType)
- **Temperature:** 0.0 (deterministic)
- **Timeout:** `SYLLABUS_LLM_TIMEOUT_MS` (default 20 s)
- **RAG:** yes -- grounded with `CurriculumChunk` rows for the subject (NCERT context)
- **Retry:** BullMQ job-level only (no per-call retry)

#### Notes Worker
- **Calls per job:** 1, or 2 on semantic validation failure
- **Model:** `gpt-4o` (notes promptType)
- **Temperature:** 0.0
- **Timeout:** `NOTES_LLM_TIMEOUT_MS` (default 30 s)
- **RAG:** yes -- sibling topic names + NCERT `CurriculumChunk` rows for the topic
- **Retry:** 1 semantic retry if validation returns `notes_too_few_sections` or similar; quality hint appended to re-prompt

#### Questions Worker
- **Calls per job:** 3 (one per difficulty: easy / medium / hard)
- **Model:** `gpt-4o` (questions promptType, `MODEL_LARGE`)
- **Temperature:** 0.0
- **Timeout:** `QUESTIONS_LLM_TIMEOUT_MS` (default 30 s)
- **RAG:** yes -- NCERT `CurriculumChunk` rows for the topic
- **Concurrency:**
  - `LLM_SAFE_MODE=false` (production default): 3 calls run in `Promise.all`
  - `LLM_SAFE_MODE=true` (VPS flag, currently `true`): 3 calls run sequentially
- **Cost note:** with `LLM_SAFE_MODE=true`, wall-clock time per QUESTIONS job is ~90 s (3 x 30 s)

#### Assemble Worker
- **Calls per job:** 0 -- purely deterministic

### 4.3 Tutor Path (not hydration, for completeness)

Tutor LLM calls go through `callLLMForTutor()` -- separate retry config, same `callLLM` underneath.
Not involved in content hydration.

---

## 5. Prompts

All prompts are rendered via `prompts/renderer.ts` using `renderTemplate(name, vars)`.
The renderer returns `{ prompt, schemaHash, version }` -- the hash is stored in `AIContentLog`
to enable cache invalidation when the prompt template changes.

| Template name | Used by | Key variables |
|---------------|---------|---------------|
| `syllabus` | syllabusWorker | `board`, `grade`, `subject`, `language`, `ncertChapterHints` |
| `topic-notes` | notesWorker | `topicName`, `grade`, `board`, `subject`, `chapter`, `priorTopics`, `difficultyLevel`, `language`, `ncertContext` |
| `topic-questions` | questionsWorker | `topicName`, `grade`, `board`, `subject`, `difficulty`, `difficultyDescription`, `language`, `ncertContext` |
| `assemble` | assembleWorker | (no LLM call) |
| `bilingual-notes` | notesWorker (bilingual path) | extended notes vars with bilingual flag |
| `chapters` | syllabusWorker (chapters sub-call) | `board`, `grade`, `subject` |

### Legacy prompts (deprecated)
`hydrators/hydrationPrompts.ts` contains inline prompt strings from before the renderer was introduced.
These are not called by any active worker. They can be deleted once `hydrators/` legacy files are cleaned up.

---

## 6. DB Hits -- Ingestion Path

### 6.1 Enqueue Phase (per job, in `enqueueTopicHydration.ts` / `hydrateSyllabus.ts`)

| Operation | Table | Purpose |
|-----------|-------|---------|
| `findFirst` | `HydrationJob` | Idempotency check -- existing Pending/Running job? |
| `findUnique` | `SystemSetting` | Check `HYDRATION_PAUSED` |
| `create` | `HydrationJob` | Create job record (`status: Pending`) |
| `create` | `Outbox` | Reliable enqueue -- same transaction as job create |

**Total enqueue: 3-4 reads + 2 writes (wrapped in transaction)**

### 6.2 Syllabus Worker

| Operation | Table | Count | Notes |
|-----------|-------|-------|-------|
| `updateMany` | `HydrationJob` | 1 | Optimistic lock -- claim job atomically |
| `findUnique` | `HydrationJob` | 1 | Reload claimed job |
| `findUnique` | `SystemSetting` | 1 | Check `HYDRATION_PAUSED` |
| `findFirst` | `ChapterDef` | 1 | Skip if syllabus already exists |
| `findUnique` | `SubjectDef` | 1 | Resolve subject name |
| `findMany` | `CurriculumChunk` | 1 | RAG grounding (NCERT context, first 5 chunks) |
| `create` | `AIContentLog` | 1 | Log LLM call start |
| `findFirst` | `ExecutionJob` | 1 | Link to ExecutionJob for audit trail |
| `create` | `JobExecutionLog` | 1 | `RESPONSE_RECEIVED` event |
| Per chapter (in transaction): | | | |
| `findFirst` | `ChapterDef` | N (one per chapter) | Check for existing chapter |
| `create` | `ChapterDef` | N | Create chapter |
| `findFirst` | `TopicDef` | N*M (per topic) | Check for existing topic |
| `create` | `TopicDef` | N*M | Create topic |
| Final transaction: | | | |
| `update` | `AIContentLog` | 1 | Attach model/tokens/cost |
| `update` | `HydrationJob` | 1 | `status: Running, contentReady: true` |
| `findFirst` | `ExecutionJob` | 1 | Link for audit |
| `create` | `JobExecutionLog` | 1 | `SYLLABUS_READY` event |

**Typical subject (10 chapters, 5 topics each): ~15 reads + 60 writes during chapter loop + 4 final writes**

### 6.3 Notes Worker

| Operation | Table | Count | Notes |
|-----------|-------|-------|-------|
| `updateMany` | `HydrationJob` | 1 | Optimistic lock |
| `findUnique` | `HydrationJob` | 1 | Reload |
| `findUnique` | `SystemSetting` | 1 | `HYDRATION_PAUSED` |
| `findUnique` | `TopicDef` | 1 | Load topic + chapter + subject |
| `findFirst` | `TopicNote` | 1 | Check for existing approved note (skip if present) |
| `findMany` | `TopicDef` | 1 | Sibling topics for RAG context |
| `findMany` | `CurriculumChunk` | 1 | NCERT grounding (first 5 chunks) |
| `create` | `AIContentLog` | 1 | Log LLM call start |
| In transaction (success path): | | | |
| `upsert` | `TopicNote` | 1 | Write versioned note (`status: draft`) |
| `create` | `AIContentLog` | 1 | Update success metadata |
| `update` | `HydrationJob` | 1 | `status: Completed, contentReady: true` |
| `findFirst` + `create` | `ExecutionJob`, `JobExecutionLog` | 2 | Audit trail |

**Total per NOTES job: ~9 reads + 5 writes (happy path), up to 14 reads + 8 writes on semantic retry**

### 6.4 Questions Worker

| Operation | Table | Count | Notes |
|-----------|-------|-------|-------|
| `updateMany` | `HydrationJob` | 1 | Optimistic lock |
| `findUnique` | `HydrationJob` | 1 | Reload |
| `findUnique` | `SystemSetting` | 1 | `HYDRATION_PAUSED` |
| `findMany` | `CurriculumChunk` | 1 | NCERT grounding |
| `findFirst` | `ExecutionJob` | 1 | Link for audit |
| `create` | `JobExecutionLog` | 1 | `PROCESSING_STARTED` |
| Per difficulty (x3): | | | |
| `findFirst` | `GeneratedTest` | 3 | Check for existing approved test |
| `create` | `AIContentLog` | 3 | LLM call start |
| In transaction (per difficulty): | | | |
| `upsert` | `GeneratedTest` | 3 | Create/update test |
| `deleteMany` | `GeneratedQuestion` | 3 | Remove stale questions for this job |
| `create` | `GeneratedQuestion` | 3 x N | One per question (N = question count cap, default 2) |
| `create` | `AIContentLog` | 3 | Success metadata |
| `update` | `HydrationJob` | 1 | `status: Completed` |
| Soft-promotion (after all difficulties): | | | |
| `findMany` | `Question` | 1 | Load existing active questions (dedup check) |
| `findMany` | `GeneratedQuestion` | 1 | Load all generated questions for these tests |
| `upsert` | `Question` | N_total | One per unique question (content-key dedup) |
| Audit: | | | |
| `findFirst` + `create` | `ExecutionJob`, `JobExecutionLog` | 2 | `COMPLETED` event |

**Total per QUESTIONS job: ~14 reads + (6 + 3*N) writes. With default cap of 2 questions/difficulty: ~14 reads + 18 writes. Soft-promotion adds 2 reads + up to 6 upserts.**

### 6.5 Assemble Worker

Reads: scans `GeneratedTest` for draft rows, counts `GeneratedQuestion` relations.
Writes: `update GeneratedTest status: approved` if >= 5 questions.
Minimal -- O(1) reads + 1 write.

---

## 7. Validation

Validation lives in `lib/aiOutputValidator.ts`.

### Layers (applied in order)

1. **JSON parse** -- LLM output must be valid JSON
2. **Zod schema** -- strict structural validation:
   - `SyllabusSchema`: chapters array, each with title + topics array
   - `VidyaNotesSchema` / `NoteSchema` (legacy): sections array, each with type + content
   - `QuestionsSchema`: questions array, each with type, question, answer, explanation
3. **Semantic gates** (notes):
   - Minimum 7-9 sections (depending on difficulty)
   - At least 2 `worked_example` sections
   - Every section content >= 80 words
   - Required section types present: `hook`, `concept`, `worked_example`, `summary`
   - `bridgeToNext` sentence required
4. **Subject-specific answer shape** (questions):
   - Math: `solution_steps` + `final_answer` fields required
   - Science: `direct_answer` + `scientific_explanation` required
5. **Placeholder detection** -- regex scan for strings like `"content coming soon"`, `"TBD"`, `"[insert"`, `"placeholder"`
6. **Deduplication** (questions only) -- `hash(question + options + answer)` removes duplicates within a generation batch; content-key dedup at soft-promotion prevents cross-batch duplicates in `Question` table

### On validation failure

- **Notes:** worker re-prompts once with a quality hint listing exactly which gates failed (e.g. `"notes_too_few_sections"`). If retry also fails, job is marked `Failed`.
- **Questions:** if all generated questions are deduped out, error code `all_questions_deduped_out` is recorded and job is marked `Failed`.
- **Syllabus:** single attempt only; failure marks job `Failed`.
- All failures are persisted to `AIContentLog` (success: false) and `JobExecutionLog`.

---

## 8. Content Serving

### 8.1 API Routes

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `GET /api/notes/for-topic` | `app/api/notes/for-topic/route.ts` | none (admin UI) | Lists approved `TopicNote` metadata for a topic |
| `GET /api/notes/topic-note/[id]` | `app/api/notes/topic-note/[id]/route.ts` | none | Returns full `TopicNote` including `contentJson` |
| `GET /api/notes/topics-overview` | `app/api/notes/topics-overview/route.ts` | none | Topic overview for notes navigation |
| `GET /api/questions/for-topic` | `app/api/questions/for-topic/route.ts` | none | Lists approved `GeneratedTest` metadata with question counts |
| `GET /api/chapters` | `app/api/chapters/route.ts` | none | Lists active `ChapterDef` rows for a subject |
| `GET /api/topics` | `app/api/topics/route.ts` | none | Lists `TopicDef` rows for a chapter |
| `GET /api/syllabus` | `app/api/syllabus/route.ts` | none | Stub -- returns empty (schema has no Syllabus model) |

All routes are marked `export const dynamic = 'force-dynamic'` -- no Next.js static caching.

### 8.2 Student-Facing Notes Component

`app/(student)/dashboard/components/Notes/index.tsx` drives the student notes experience with 3 sequential fetches:

1. `fetch('/api/notes/topics-overview')` -- load subject/chapter/topic tree
2. `fetch('/api/notes/for-topic?topicId=...')` -- load note metadata for selected topic
3. `fetch('/api/notes/topic-note/${id}')` -- load full note content (`contentJson`)

These are client-side fetches triggered by user interaction (subject/chapter/topic selection).
No server-side prefetch or cache layer wraps these calls.

### 8.3 Approval Gates

| Content type | Approval model | Student visibility |
|-------------|---------------|-------------------|
| Notes (`TopicNote`) | Manual admin approval (`status: draft --> approved`) | `status = 'approved'` filter in all queries |
| Questions (`Question`) | Soft-approval -- immediate after generation | No gate; promoted directly |
| Syllabus/Chapters/Topics | No gate | Active (`lifecycle = 'active'`) filter only |

---

## 9. DB Hits -- Serving Path

### `/api/notes/for-topic`
- 1 x `TopicNote.findMany` filtered by `{ topicId, lifecycle: 'active', status: 'approved' }`, `select` metadata-only fields (no `contentJson`)

### `/api/notes/topic-note/[id]`
- 1 x `TopicNote.findFirst` filtered by `{ id, lifecycle: 'active', status: 'approved' }`, `select` including `contentJson`

### `/api/questions/for-topic`
- 1 x `GeneratedTest.findMany` filtered by `{ topicId, lifecycle: 'active', status: 'approved' }` with `_count: { select: { questions: true } }`

### `/api/chapters` and `/api/topics`
- 1 x `ChapterDef.findMany` / `TopicDef.findMany` filtered by parent id and `lifecycle: 'active'`

All serving queries are single-table, paginated by implicit result set size (no explicit limit set -- see Limitations).
No Redis cache sits in front of any serving route.

---

## 10. Caching and Redis Usage

### What IS cached

| What | Where | TTL |
|------|-------|-----|
| BullMQ job queues | Redis (shared IORedis connection via `queues/contentQueue.ts`) | N/A (queue infrastructure) |
| Readiness scores, explanation content, doubt KB | `lib/cache.ts` (`cacheGet`/`cacheSet`) | Per call (set by callers) |

### What is NOT cached

- `TopicNote` content (`contentJson`) -- no Redis layer; every `/api/notes/topic-note/[id]` call hits Postgres directly
- `GeneratedTest` / `GeneratedQuestion` lists -- no Redis layer; every `/api/questions/for-topic` hits Postgres
- `ChapterDef` / `TopicDef` tree -- no Redis layer; every navigation fetch hits Postgres
- Hydration worker DB reads (topic metadata, sibling topics, NCERT chunks) -- not cached; re-queried on every job

### Redis client

`lib/redis.ts` -- singleton `IORedis` instance, lazy-init, TLS support, exponential-backoff reconnect (up to 30 s).
Shared between BullMQ queues and `lib/cache.ts` to avoid N TCP connections.

---

## 11. Performance Characteristics

### Ingestion throughput (estimates at current caps)

| Job type | LLM wall-clock | DB writes | Total job wall-clock |
|----------|---------------|-----------|---------------------|
| SYLLABUS (10 chapters, 5 topics) | ~5-15 s | ~70 | ~20-30 s |
| NOTES | ~10-30 s | ~6 | ~15-40 s |
| QUESTIONS (`LLM_SAFE_MODE=true`) | ~90 s (3 x 30 s sequential) | ~20 | ~100-120 s |
| QUESTIONS (`LLM_SAFE_MODE=false`) | ~30 s (3 x 30 s parallel) | ~20 | ~35-50 s |
| ASSEMBLE | 0 s | 1 | < 1 s |

With `LLM_SAFE_MODE=true` (current VPS setting), a full topic requires ~200 s end-to-end (notes + questions + assemble).

### Reconciler overhead

Runs every 5 min with a 5-min lock. Each run scans `TopicDef` for topics missing notes/questions,
then enqueues missing jobs. This is a read-heavy DB scan -- no index on "topics without notes" exists
natively; reconciler likely does a LEFT JOIN or subquery. At scale (thousands of topics) this scan
will grow linearly.

### Serving latency

All serving routes execute a single DB query against Neon (managed Postgres, remote).
No connection pooling client (PgBouncer) is noted in the codebase -- standard Prisma connection pool.
Expected P50 latency per API call: 30-80 ms (Neon + network). At high concurrency Neon connection
limits can become a bottleneck.

### Transaction overhead in workers

- Syllabus worker: per-chapter transactions (avoids single long-lived transaction across all chapters/topics)
- Questions worker: single transaction per difficulty with a 30 s `$transaction` timeout (explicit cast to bypass Prisma's 5 s default)
- Notes worker: single transaction for note upsert + AIContentLog + HydrationJob update

Prisma transaction retry wrapper (3 attempts, 500 ms incremental backoff) handles transient Neon connection resets.

---

## 12. Limitations and Gaps

### L1 -- No Redis cache on serving routes
`/api/notes/topic-note/[id]`, `/api/questions/for-topic`, `/api/chapters`, `/api/topics` all query Postgres
on every request. A student opening the Notes page triggers 3 sequential Postgres round-trips.
`lib/cache.ts` exists but is not wired into any content serving route.
**Impact:** unnecessary Neon load at scale; P99 latency spikes under concurrent students.

### L2 -- No pagination limit on serving queries
`TopicNote.findMany` and `GeneratedTest.findMany` in serving routes have no explicit `take` limit.
A topic with many note versions or many test versions returns all rows.
**Impact:** unbounded response payloads; potential memory pressure at scale.

### L3 -- Sequential LLM calls under LLM_SAFE_MODE=true
Current VPS flag `LLM_SAFE_MODE=true` forces 3 sequential LLM calls per QUESTIONS job (~90 s LLM time).
This triples hydration time for questions compared to parallel mode.
**Impact:** full subject hydration (notes + questions for 50 topics) takes ~3.5 hours vs ~1.2 hours.

### L4 -- Notes require manual admin approval before students can see them
`TopicNote` rows are written with `status: draft` and require admin promotion to `approved`.
Questions are soft-approved immediately. This creates an asymmetry: students can practice questions
for a topic but cannot read notes for it until an admin acts.
**Impact:** operational bottleneck; newly hydrated topics have questions but no visible notes.

### L5 -- Reconciler scan is unbounded
`hydrationReconciler.ts` scans all `TopicDef` rows every 5 minutes to find gaps.
There is no `VALIDATION_CAP_TOPICS_PER_RUN` enforcement visible at the top-level reconciler scan
(caps exist per-chapter when creating jobs, but the scan itself reads all topics).
**Impact:** DB read amplification as the syllabus grows.

### L6 -- Legacy `hydrators/hydrationPrompts.ts` is dead code
The file contains inline prompt strings that predate the `prompts/renderer.ts` system.
No active worker calls these. The file imports are not cleaned up.
**Impact:** confusion about which prompts are active; risk of someone referencing stale prompts.

### L7 -- No explicit connection pool / PgBouncer configuration noted
Workers and API routes share the same Prisma client without any explicit `connection_limit` or
PgBouncer configuration. Under concurrent hydration jobs (multiple workers) + serving traffic,
Neon's default connection limit can be hit.
**Impact:** `P_CONN_POOL_TIMEOUT` errors at scale.

### L8 -- `AIContentLog` grows unboundedly
Every LLM call persists a full `responseBody` (raw LLM output) to `AIContentLog`.
There is no archival or TTL on these rows. For a subject with 50 topics x 4 calls each = 200 rows,
each potentially large. At 100 subjects this is 20,000 rows of large JSON.
**Impact:** table bloat; no purge/archival job observed.

### L9 -- `hydrators/` legacy wrapper layer is redundant
`hydrators/hydrateNotes.ts` and `hydrators/hydrateQuestions.ts` are thin pass-throughs that
immediately call into `lib/execution-pipeline/enqueueTopicHydration.ts`. The extra indirection
adds no value and creates two call sites to maintain.
**Impact:** developer confusion about which entry point to use.

### L10 -- Notes component waterfall (3 sequential client fetches)
The student Notes UI does 3 sequential `fetch()` calls on the client:
topics-overview --> for-topic --> topic-note/[id].
There is no server-side prefetch or parallel loading.
**Impact:** noticeable latency on budget Android / 4G -- ~240-480 ms extra before content renders.

---

## 12. Difficulty-Based Question Serving

### 12.1 How Difficulty is Stored

Each `GeneratedTest` row carries a `difficulty` field (`easy` | `medium` | `hard`).
Each `Question` row (soft-promoted) also carries a `difficulty: String?` field.
Difficulty is set at hydration time by the questionsWorker for each of the 3 difficulty bands.

### 12.2 Student Cannot Pick Difficulty Directly

There is no UI control for difficulty. Two independent engines resolve it automatically:

**A) Adaptive (Structured Session path -- `app/api/session/start` → PRACTICE/TEST phases)**

```
lib/ai/adaptiveDifficulty.ts: resolveTargetDifficulty(mastery)

StudentTopicProgress.mastery (0–1 float)
  < 0.50            → 'easy'
  0.50 – 0.74       → 'medium'
  >= 0.75           → 'hard'
  null (first visit) → 'medium'
```

Called inside `lib/session/getPhaseContent.ts` → `resolvePractice()` and `resolveTest()`.
The resolved difficulty is passed to a `Question.findMany({ where: { difficulty } })` query.
Fallback: if target difficulty band is empty, any available question is returned.

**B) Preference-based (Legacy quick-practice path -- `app/api/tests/start`)**

```
StudentContentPreference.difficulty (per subject, updated after each test)
  → passed to selectQuestions() as filter
  → fallback: 'medium'
```

Updated by `lib/personalization/difficultyTuning.ts: adjustDifficultyAfterTest()` after every test
submission (`app/api/tests/submit`). Uses a weighted scoring model:
- Accuracy 35%, Time 20%, Hints used 20%, Retry count 15%, AI confidence 10%
- Score >= 0.5 → increase; <= -0.3 → decrease; otherwise maintain.

### 12.3 Recommendation Engine Interaction

`lib/recommendations/engine.ts` scores content items with a `DIFFICULTY_MATCH` weight (10 pts).
It reads `StudentContentPreference.difficulty` and boosts items whose `GeneratedTest.difficulty`
matches the student's current preference. The recommendation engine does NOT directly serve
questions -- it surfaces topics; the session engine resolves difficulty at practice time.

### 12.4 DB Query Chain for Difficulty-Based Question Serving

```
POST /api/session/start { topicId }
  → StructuredSession created
  → resolvePhaseContent('PRACTICE')
    → StudentTopicProgress.findUnique({ studentId, topicId })   -- 1 read (mastery)
    → resolveTargetDifficulty(mastery)                          -- in-memory
    → Question.findMany({ topicId, difficulty, status:'ACTIVE' })  -- 1 read
    → dedup against session.meta.servedPracticeIds              -- in-memory
    → random pick (5 questions)
    → StructuredSession.update({ meta: { servedPracticeIds } }) -- 1 write
```

Total: 2 DB reads + 1 write per phase content resolution. No LLM call.

### 12.5 Fallback When Difficulty Band is Empty

If the `Question` table has no rows for the target difficulty:
1. `getPhaseContent.ts` re-queries with no difficulty filter (any available question)
2. If still empty, falls back to `GeneratedQuestion` table (soft-approved but not yet promoted)

This means a topic can have zero questions in a specific band right after hydration if the
soft-promotion step failed. The VPS has a 5-min reconciler cycle that would re-enqueue a
questions job on the next pass.

### 12.6 Key Tables for Difficulty Routing

| Table | Field | Type | Role |
|-------|-------|------|------|
| `StudentTopicProgress` | `mastery` | Float 0–1 | Drives adaptive difficulty in session engine |
| `StudentContentPreference` | `difficulty` | Enum | Drives legacy quick-practice path |
| `Question` | `difficulty` | String? | Filter target in `Question.findMany` |
| `GeneratedTest` | `difficulty` | DifficultyLevel enum | Metadata; not directly queried in session path |
| `StructuredSession` | `meta.servedPracticeIds` | JSON | Dedup -- prevents repeat questions within session |

### 12.7 Mastery vs Readiness Tier -- Critical Distinction

Readiness tiers (`critical` / `weak` / `fair` / `on track` / `strong`) displayed in the UI
are computed from `SubjectReadinessScore.readinessScore` (0–100 int). They are **display labels only**
and are NOT used to route difficulty.

Difficulty routing uses `StudentTopicProgress.mastery` (0–1 float, per-topic). These are two
separate signals that happen to correlate but are computed independently.

---

## 13. Limitations -- Fixed

All 10 limitations from the original audit were addressed on 2026-05-18:

| # | Limitation | Fix |
|---|-----------|-----|
| L1 | No Redis cache on serving routes | Added `cacheGet`/`cacheSet` to all 3 serving routes (TTL 300 s / 900 s). Cache invalidated on admin approval and after worker auto-approve. |
| L2 | No pagination limit on serving queries | Added `take: 20` to `TopicNote.findMany` and `GeneratedTest.findMany` in serving routes. |
| L3 | Sequential LLM calls under LLM_SAFE_MODE=true | Added `QUESTIONS_PARALLEL=true` env var. When set, overrides `LLM_SAFE_MODE` for the questions worker only -- enables parallel 3-difficulty generation while keeping safe mode for real-time tutor calls. |
| L4 | Notes require manual admin approval | Notes are now soft-approved immediately on write (`status: Approved`). Admin can still quarantine/reject. Same pattern as questions. Cache is invalidated after soft-approve. |
| L5 | Reconciler scan is unbounded | Added `RECONCILER_TOPICS_PER_SUBJECT_CAP` env var (default 0 = unlimited). When set, caps the `topicDef.findMany` in Level 2 and Level 3 job creation. |
| L6 | Legacy dead code | Deleted `hydrators/hydrationPrompts.ts`, `hydrators/personalizeContent.ts`, `hydrators/testLegacyHydrateHelpers.ts`, `hydrators/hydrateNotes.ts`, `hydrators/hydrateQuestions.ts` and all associated test files. Test helpers moved to `tests/helpers/legacyHydrationHelpers.ts`. |
| L7 | No connection pool config | `lib/prisma.ts` now reads `DB_POOL_SIZE` env var and appends `connection_limit` + `pool_timeout=20` to the DATABASE_URL. |
| L8 | AIContentLog grows unboundedly | Added `purgeOldAIContentLogs()` to daily maintenance in `worker/scheduler.ts`. Deletes rows older than `AI_CONTENT_LOG_RETENTION_DAYS` (default 30) in 500-row batches. |
| L9 | Redundant hydrator wrapper layer | Covered by L6. `scripts/hydrateAll.ts` now imports `enqueueNotesHydration`/`enqueueQuestionsHydration` directly. |
| L10 | Notes component waterfall (3 fetches) | Created `GET /api/notes/topic-content` -- single query returning latest approved note with full `contentJson`. Student Notes component now does 1 fetch instead of 2 sequential fetches on topic select. |

---

## 14. Environment Variables Reference

New variables introduced by the fixes above. Add to `.env` and `.env.production`:

| Variable | Default | Effect |
|----------|---------|--------|
| `QUESTIONS_PARALLEL` | `false` | Set to `true` to run 3 difficulty LLM calls in parallel even when `LLM_SAFE_MODE=true`. Reduces QUESTIONS job time from ~90 s to ~30 s. |
| `DB_POOL_SIZE` | unset (Prisma default) | Integer. Sets `connection_limit` in Prisma DATABASE_URL. Recommended: `5` for workers, `10` for Next.js API server. |
| `AI_CONTENT_LOG_RETENTION_DAYS` | `30` | Number of days to keep `AIContentLog` rows before daily purge. |
| `RECONCILER_TOPICS_PER_SUBJECT_CAP` | `0` (unlimited) | Max topics fetched per subject per reconciler run. Protects against unbounded scans on large subjects. Set to 0 to disable cap. |

---

## 15. Question Generation Counts, Session Phase Serving, and Query Performance

### 15.1 Questions Generated Per Difficulty

**Source:** `worker/services/questionsWorker.ts`, `getValidationQuestionCount()` (line 119)

```
VALIDATION_CAP_QUESTIONS_PER_DIFFICULTY env (if set)  ← takes precedence
  else LLM_MODE='real'  → 2 per difficulty  (6 total across easy/medium/hard)
  else                  → 5 per difficulty  (15 total, dev/test)
```

The job-level override (`job.inputParams.questionsPerDifficulty`) is capped at the base cap -- it can only reduce the count, never exceed it.

**What the LLM prompt requests** (`prompts/topic-questions.ts`, line 52):
```
Generate exactly ${count} multiple-choice questions
All ${count} questions MUST be ${difficulty} level
```

Only MCQ format is generated. 4 options, 1 correct answer per question.

**After LLM response, questions are reduced by:**
1. JSON parse failure -- entire difficulty band discarded
2. Zod validation (`validateQuestionsShapeWithReport`) -- malformed questions dropped
3. In-batch dedup (`dedupeQuestionsForPersistence`) -- hash of `${prompt}::${options}::${answer}`, normalized (lowercase, collapsed whitespace)
4. Cross-batch dedup at soft-promotion -- content keys checked against existing ACTIVE `Question` rows

**Practical outcome in production (LLM_MODE='real'):**

| Stage | Count per difficulty |
|-------|---------------------|
| Requested from LLM | 2 |
| After Zod validation | 0-2 |
| After in-batch dedup | 0-2 |
| Stored in GeneratedQuestion | 0-2 |
| Promoted to Question table | 0-2 (after cross-batch dedup) |
| **Total in Question table (all 3 difficulties)** | **0-6** |

This is the critical bottleneck: **a topic with full hydration has at most 6 questions** in production. Each session phase requires 5. There is almost no buffer.

The cap of 2 was introduced as a cost-control gate. At scale it becomes a serving constraint.

---

### 15.2 How Questions Are Served Across Session Phases

**Source files:**
- `lib/session/getPhaseContent.ts` -- resolves content for each phase
- `app/api/session/start/route.ts` -- starts session, resolves OVERVIEW content
- `app/api/session/next/route.ts` -- advances phase, resolves next content
- `app/api/session/[sessionId]/practice/more/route.ts` -- PRACTICE_MORE endpoint

#### Phase: OVERVIEW
- Queries `TopicDef.findUnique` with nested includes (chapter → subject → class → board)
- Queries `TopicNote.findFirst` for a preview snippet
- No questions served -- metadata only

#### Phase: EXPLANATION
- Queries `TopicNote.findFirst({ topicId, status: 'approved' })` first
- Falls back to `TopicNote.findFirst({ topicId })` (draft) if none approved
- Both queries are sequential (could be a single `orderBy: [{status:'approved'}, {version:'desc'}]`)
- No questions served -- notes content only

#### Phase: PRACTICE
**Target: 5 questions**

```
1. resolveTargetDifficulty(mastery)   -- 'easy' | 'medium' | 'hard'
2. Question.findMany({ topicId, difficulty: target, status: 'ACTIVE' })
3. dedupe against meta.servedContentKeys   -- removes already-seen content
4. Fisher-Yates shuffle → pick 5
5. FALLBACK 1: if < 5 → Question.findMany({ topicId, status: 'ACTIVE' })  -- any difficulty
6. FALLBACK 2: if still 0 → on-demand GeneratedQuestion promotion (see §15.4)
7. FINAL: if still 0 → return { type: 'pending' }
```

Served IDs saved to `StructuredSession.meta.servedPracticeIds` and `servedContentKeys`.

#### Phase: TEST (Quick Test)
**Target: 5 questions, never repeating PRACTICE questions**

```
1. resolveTargetDifficulty(mastery)
2. Question.findMany({ topicId, difficulty: target, status: 'ACTIVE' })
3. filter out servedPracticeIds + servedContentKeys
4. Fisher-Yates shuffle → pick 5
5. FALLBACK: if < 5 → Question.findMany({ topicId, status: 'ACTIVE' })  -- any difficulty, re-dedup
6. FINAL: if still 0 → return { type: 'pending' }
```

"Never repeat" is the hard constraint -- if all available questions were already served in PRACTICE, TEST returns pending even if questions exist.

Served IDs saved to `meta.servedTestIds`.

#### Phase: HOMEWORK
- Queries `HomeworkAssignment.findFirst({ sessionId, studentId })`
- Questions embedded in `HomeworkAssignment.questions` JSON field
- No live question lookup -- content is pre-written into the assignment record
- No fallback re-generation if assignment is missing: returns `{ type: 'pending' }`

#### Phase: PRACTICE_MORE (Premium)
**Target: 5 fresh questions, excludes all previously served**

```
1. Collect all servedPracticeIds from session meta
2. Question.findMany({ topicId, status: 'ACTIVE', id: { notIn: servedPracticeIds } })
3. Random shuffle → pick 5
4. if < 5 available → enqueue enqueueQuestionsHydration({ questionsPerDifficulty: 5 + 5 buffer })  (non-blocking)
5. FINAL: if < 5 → HTTP 409 "NOT_ENOUGH_FRESH_QUESTIONS"
```

Only available to premium subscribers. Daily cap enforced. Unlike other phases, PRACTICE_MORE surfaces the shortage as a hard error (409) rather than a soft pending state.

---

### 15.3 Distribution of Questions Per Phase (Counts)

| Phase | Questions | Source table | Difficulty | Dedup scope | Hardcoded? |
|-------|-----------|-------------|-----------|------------|-----------|
| OVERVIEW | 0 | TopicDef, TopicNote | N/A | -- | -- |
| EXPLANATION | 0 | TopicNote | N/A | -- | -- |
| PRACTICE | 5 | Question | Target band → any | servedContentKeys | Yes (line 58) |
| TEST | 5 | Question | Target band → any | + servedPracticeIds | Yes (line 59) |
| HOMEWORK | varies | HomeworkAssignment.questions (JSON) | N/A | none | No |
| PRACTICE_MORE | 5 | Question | None (any) | servedPracticeIds | Yes (line 31 of route) |

All counts of 5 are hardcoded constants in the source. There is no env var override for phase question count.

**Production math:**

```
Max questions in Question table per topic: 6 (2 per difficulty × 3 difficulties)
PRACTICE needs:    5
TEST needs:        5 (not overlapping with PRACTICE)
PRACTICE_MORE:     5 (not overlapping with anything)
Total demand:      15
Total supply:      6
```

With the default cap of 2 per difficulty, the system structurally cannot satisfy a full PRACTICE + TEST + PRACTICE_MORE sequence for a single topic without fallback re-hydration. PRACTICE exhausts ~5 of 6 questions; TEST finds at most 1 fresh question and falls back to pending.

---

### 15.4 What Happens When Not Enough Questions

| Phase | Shortage behaviour | Re-hydration triggered? |
|-------|-------------------|------------------------|
| PRACTICE | Step-down difficulty → on-demand GeneratedQuestion promotion → `{type:'pending'}` | No job enqueued -- promotion uses existing GeneratedQuestion rows |
| TEST | Step-down difficulty → `{type:'pending'}` | No |
| HOMEWORK | `{type:'pending'}` | No |
| PRACTICE_MORE | Enqueues `enqueueQuestionsHydration` (non-blocking, fire-and-forget) → HTTP 409 on same request | Yes -- but student must retry manually |

**On-demand GeneratedQuestion promotion (PRACTICE fallback 2):**

This runs inline during the API request when the `Question` table has 0 rows for the topic:

```
1. GeneratedQuestion.findMany({ test: { topicId, status: { not: Rejected } } })
   -- with full join chain: test → topic → chapter → subject → class → board
2. Question.findMany({ topicId, status: 'ACTIVE' }) -- existing ACTIVE rows (dedup check)
3. for each GeneratedQuestion not in existing set:
     Question.upsert(...)   -- O(n) sequential upserts, no batch
4. Question.findMany({ topicId, status: 'ACTIVE' })  -- re-query after promotion
```

This entire block runs synchronously inside the API request. With up to 6 GeneratedQuestion rows per topic, latency impact is bounded but still adds 6 sequential DB round-trips.

---

### 15.5 Why Lag Is High When Questions Are Assembled or Served

#### Assembly lag (`assembleWorker.ts`)

The assembleWorker runs after questionsWorker completes:

1. `GeneratedTest.findMany({ topicId, language, difficulty, status: 'draft' }, { _count: { questions: true } })`
   -- no index on `(topicId, status)`, potential table scan
2. For each draft test with >= 5 questions: `GeneratedTest.update({ status: 'approved' })`
   -- **O(n) sequential updates** across all draft tests

For a fresh topic with 3 draft tests (one per difficulty), this is 3 sequential round-trips. Not critical at current scale but grows linearly.

#### Serving lag (`getPhaseContent.ts`)

Five structural causes:

**A) Missing indexes on `Question` table**

The primary PRACTICE and TEST query is:
```sql
SELECT ... FROM "Question"
WHERE "topicId" = $1 AND "difficulty" = $2 AND "status" = 'ACTIVE'
```

No compound index `(topicId, difficulty, status)` exists in `prisma/schema.prisma`. As the `Question` table grows, this becomes a sequential scan filtered client-side.

The fallback query drops `difficulty`:
```sql
WHERE "topicId" = $1 AND "status" = 'ACTIVE'
```
No index on `(topicId, status)` either.

**B) On-demand promotion runs in the hot path**

When the `Question` table has 0 rows for a topic (freshly hydrated topic, first student to reach it):
- 6 sequential DB upserts run inside the API request
- 1 deep-join `GeneratedQuestion.findMany` (test → topic → chapter → subject → class → board)
- 1 re-query after promotion
- **Typical extra latency: 100-400 ms on Neon**

This hits every first student to open a freshly hydrated topic.

**C) No Redis cache in front of phase content**

Every `session/next` or `session/start` call re-queries Postgres for the full question set. For a popular topic with 100 concurrent students, 100 identical queries hit Neon simultaneously. There is no deduplicated read path.

**D) OVERVIEW includes deep eager join**

```typescript
TopicDef.findUnique({
  include: {
    chapter: {
      include: {
        subject: {
          include: {
            class: { include: { board: true } }
          }
        }
      }
    }
  }
})
```

4 levels of nested includes for every session start. Prisma executes these as sequential JOINs or subqueries depending on the relation type.

**E) EXPLANATION double-query**

Two sequential `TopicNote.findFirst` calls (approved → draft fallback) when a single query with status ordering would cover both cases.

#### Timing summary (estimated per `session/next` call on Neon)

| Operation | Estimated latency |
|-----------|------------------|
| `StructuredSession.findUnique` | 5-15 ms |
| `Question.findMany` (with index) | 5-20 ms |
| `Question.findMany` (without index, table scan) | 20-100 ms |
| On-demand GeneratedQuestion promotion (cold topic) | 100-400 ms |
| `StructuredSession.update` (meta) | 5-15 ms |
| **Total (warm topic, indexed)** | **~25-60 ms** |
| **Total (cold topic, no index, promotion)** | **~150-550 ms** |

---

### 15.6 How Slow Queries Are Identified and Healed

#### Current state: minimal observability for DB queries

**What IS monitored:**
- `worker/jobs/dailyLatencyReport.ts` -- queries `AITutorTurnLog.latencyMs`, sends email when p95 LLM turn latency > 10 000 ms. Covers end-to-end tutor response time (LLM + DB combined), not DB in isolation.
- Prisma logs `['query', 'info', 'warn', 'error']` in production (`lib/prisma.ts`). Query text is emitted to stdout (PM2 logs) but there is no threshold filter, no structured latency field, and no alerting on slow queries.

**What is NOT monitored:**
- No `prisma.$on('query', handler)` event listener with duration threshold
- No per-query latency field in application logs
- No Neon `pg_stat_statements` surfacing to the app layer
- No DB-level slow query log parsed by any worker
- No circuit breaker for DB calls (only for LLM calls in `lib/ai/tutor/circuitBreaker.ts`)
- No auto-healing (auto-reindex, query plan refresh, connection drain)

#### How slow queries are currently found

1. **PM2 logs**: Prisma query logs appear in PM2 stdout. A developer must manually grep for slow queries -- there is no automated alerting.
2. **Neon console**: Neon provides `pg_stat_statements` via its web dashboard. Not integrated into the app.
3. **LLM turn latency spike**: When DB latency degrades enough to push end-to-end LLM turn time above 10 000 ms, the daily latency report fires an email. This is a lagging indicator -- DB slowness must be severe before it surfaces.

#### Identified slow query patterns and recommended fixes

| Query | Table | Problem | Fix |
|-------|-------|---------|-----|
| `WHERE topicId=$1 AND difficulty=$2 AND status='ACTIVE'` | `Question` | No compound index | Add `@@index([topicId, difficulty, status])` |
| `WHERE topicId=$1 AND status='ACTIVE'` | `Question` | No index on (topicId, status) | Covered by above index (topicId prefix usable) |
| `WHERE topicId=$1 AND status NOT IN ('draft')` | `GeneratedTest` | No index | Add `@@index([topicId, status, difficulty])` |
| `GeneratedQuestion.findMany` with 4-level join | `GeneratedQuestion` | Over-fetching (deep join) for simple check | Replace with count query or move to a background job |
| `TopicDef.findUnique` with 4-level nested include | `TopicDef` | Deep eager-load on every session start | Cache in Redis (topicId → metadata, TTL 1 hour) |
| Sequential `TopicNote.findFirst` x2 | `TopicNote` | Two round-trips where one suffices | Merge into single query: `orderBy: [{status: 'asc'}, {version: 'desc'}]` |

#### Recommended healing additions

1. **Prisma query timing middleware** -- add a Prisma extension that logs duration for all queries > 100 ms:
   ```typescript
   prisma.$extends({
     query: {
       $allModels: {
         async $allOperations({ model, operation, args, query }) {
           const start = Date.now();
           const result = await query(args);
           const ms = Date.now() - start;
           if (ms > 100) logger.warn('slow_query', { model, operation, ms });
           return result;
         }
       }
     }
   });
   ```

2. **Redis cache for phase content** -- cache `getPhaseContent` result per `(sessionId, phase)` with a 60 s TTL. Invalidate on `session/next` advance. Eliminates the repeat-query problem for concurrent students on the same topic.

3. **Pre-warm Question table on hydration complete** -- when questionsWorker marks `contentReady=true`, immediately trigger on-demand promotion if not already done. Eliminates the cold-topic latency spike on first student access.

4. **Prisma schema indexes to add** (`prisma/schema.prisma`):
   ```prisma
   model Question {
     @@index([topicId, difficulty, status])
   }

   model GeneratedTest {
     @@index([topicId, status, difficulty])
   }
   ```

5. **Neon pg_stat_statements integration** -- expose slow query data via a scheduled job that queries `pg_stat_statements` on Neon and logs top 10 slowest queries daily alongside the latency report.
