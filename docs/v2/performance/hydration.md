# Hydration Infrastructure Audit

> Scope: content ingestion (syllabus, chapters, topics, notes, questions, tests) and the serving layer
> that delivers that content to students.
> Last updated: 2026-05-18

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
12. [Limitations and Gaps](#12-limitations-and-gaps)

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
