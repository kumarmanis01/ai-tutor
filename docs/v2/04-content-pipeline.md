# Spinzy Academy — Content Pipeline

**Last updated: 2026-03-23**

The content pipeline is a five-step process that goes from an empty database to a student-facing diagnostic with generated questions.

---

## Step 1 — Taxonomy Seeding

**Script:** `scripts/seed-taxonomy.cjs`
**Trigger:** Manual. Run once on a fresh database, safe to re-run (all upserts, idempotent).
**Writes:** `Board`, `ClassLevel`, `SubjectDef`

```bash
node scripts/seed-taxonomy.cjs
# or
npm run seed
```

The script loads `.env.production` via `dotenv` before connecting to the database.

**Subject matrix seeded:**

| Grade range | Subjects                                                                    |
| ----------- | --------------------------------------------------------------------------- |
| 1–5         | English, Hindi, Mathematics, Environmental Studies                          |
| 6–8         | English, Hindi, Mathematics, Science, Social Science                        |
| 9–10        | English, Hindi, Mathematics, Science, Social Science, Computer Applications |
| 11–12       | English, Physics, Chemistry, Mathematics, Biology, Computer Science         |

Seeded for both CBSE and ICSE. Existing `SubjectDef` slugs are never renamed — the script finds the existing slug before upserting.

After seeding:

- 2 `Board` rows
- 24 `ClassLevel` rows (12 grades × 2 boards)
- ~120 `SubjectDef` rows

---

## Step 2 — HydrateAll Pipeline

**Trigger:** Admin UI at `/admin/content-engine/hydrateAll` or directly via:

```
POST /api/admin/hydrateAll
Body: { board, grade, subject, language?, difficulty? }
```

**Process:**

1. A root `HydrationJob` (jobType: `syllabus`) is created with `status: pending`.
2. The job is written to the `Outbox` table.
3. The `hydrationReconciler` scheduler job (runs every 2 minutes) reads pending `Outbox` rows and dispatches them to the `content-hydration` BullMQ queue.
4. The `content-engine-worker` PM2 process consumes the queue.

**Worker cascade:**

```
SyllabusWorker
  → creates ChapterDef rows (one per chapter)
  → creates TopicDef rows (one per topic per chapter)
  → enqueues NotesWorker jobs (one per topic)
  → enqueues QuestionsWorker jobs (one per topic)

NotesWorker (per topic)
  → calls GPT-4o-mini
  → creates TopicNote row (contentJson, status: draft)
  → writes AIContentLog

QuestionsWorker (per topic)
  → calls GPT-4o-mini
  → creates GeneratedTest + GeneratedQuestion rows
  → writes AIContentLog
```

**Content gate:** The diagnostic page checks `topicDef.count > 0` for the subject before rendering. This gate lifts as soon as SyllabusWorker completes — before notes and questions, which is correct because `syncFromGeneratedQuestions()` generates questions on demand if needed.

**Idempotency:** Each worker checks for existing rows before writing. Re-running HydrateAll for the same subject is safe.

**Recommended priority order for initial hydration:**

1. CBSE Grade 10 — Science
2. CBSE Grade 10 — Mathematics
3. CBSE Grade 10 — English
4. CBSE Grade 9 — Science, Mathematics
5. CBSE Grades 6–8
6. ICSE Grade 10

**Monitoring:** Job progress is visible in the admin UI at `/admin/content-engine/jobs`. The `HydrationJob` row tracks:

- `chaptersExpected` / `chaptersCompleted`
- `topicsExpected` / `topicsCompleted`
- `notesExpected` / `notesCompleted`
- `questionsExpected` / `questionsCompleted`
- `actualCostUsd`

Failed jobs can be retried via `POST /api/admin/hydrateAll/[jobId]/retry`.

---

## Step 3 — RAG Corpus Ingestion

**Script:** `scripts/scrape-ncert.ts`
**Source:** ncert.nic.in (NCERT publishes textbooks under a free educational license)
**Trigger:** Manual. Run after taxonomy is seeded and subject definitions exist.

```bash
npx tsx scripts/scrape-ncert.ts --grade 10 --subject mathematics --lang en
```

**Process:**

1. Fetches NCERT textbook content for the specified grade + subject + language.
2. Splits into paragraph-level chunks.
3. Generates embeddings via `text-embedding-3-small` (1536 dimensions).
4. Upserts into `CurriculumChunk` table using SHA-256 `contentHash` for deduplication.
5. Tags chunks with `conceptIds` where mapping is available.
6. Writes an `IngestRunLog` row on completion.

**Fields written:** `board`, `subject`, `grade`, `content`, `contentHash`, `embedding (vector 1536)`, `conceptIds`.

The embedding column is `Unsupported("vector(1536)")` in the Prisma schema — raw SQL is used for pgvector operations.

---

## Step 4 — Question Promotion (Lazy)

**File:** `lib/tests.ts`
**Function:** `syncFromGeneratedQuestions(filters, take)`

`GeneratedQuestion` rows created by the HydrateAll pipeline are not immediately in the student-facing `Question` table. On the first call to `selectQuestions()` for a given topic/chapter/subject, if the `Question` pool is too small, `syncFromGeneratedQuestions()` is called to upsert `GeneratedQuestion` rows into the `Question` table.

This lazy promotion means:

- The Question table starts empty.
- Content gates must check `TopicDef` (SyllabusWorker output), not `Question`.
- After first diagnostic or practice session, Question rows are populated.

The `Question` model adds production fields not on `GeneratedQuestion`:

- `status` (QuestionStatus: ACTIVE / QUARANTINED / REJECTED / PENDING_REVIEW)
- `irt_b` (IRT difficulty parameter — calibrated post-launch)
- `topicId` FK to TopicDef
- `board`, `grade`, `subject` for indexed queries

---

## Step 5 — IRT Calibration (Post-Launch)

**Status:** Planned for post-launch. Not yet implemented.

Once real student answer data accumulates in `AttemptQuestion`, a scheduled worker will compute the IRT b-parameter per question from real performance data and write it to `Question.irt_b`. Initial values are assigned during `syncFromGeneratedQuestions()` based on question type:

- Recall questions: irt_b ≈ -1.0 (easier)
- Single-step: irt_b ≈ 0.0
- Multi-step: irt_b ≈ 1.0

---

## Operational Reference

### Check if a subject is hydrated

```sql
-- Count active TopicDef rows for a SubjectDef
SELECT COUNT(*) FROM "TopicDef" t
JOIN "ChapterDef" c ON c.id = t."chapterId"
WHERE c."subjectId" = '<subjectDefId>'
  AND c.lifecycle = 'active'
  AND t.lifecycle = 'active';
```

If count = 0 → SyllabusWorker has not run. HydrateAll not yet triggered or failed.

### Trigger a fresh hydration (admin CLI)

```bash
# On VPS, with .env.production exported:
curl -X POST https://spinzyacademy.com/api/admin/hydrateAll \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin session cookie>" \
  -d '{"board":"cbse","grade":10,"subject":"science","language":"en","difficulty":"medium"}'
```

### Check Outbox for stuck jobs

```sql
SELECT id, queue, attempts, "sentAt", "createdAt"
FROM "Outbox"
WHERE "sentAt" IS NULL
ORDER BY "createdAt" ASC
LIMIT 20;
```

If rows are stuck with `sentAt IS NULL` and `attempts > 0`, the reconciler may be stalled. Check `ai-tutor-scheduler` PM2 logs.
