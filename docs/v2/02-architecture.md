# Spinzy Academy — System Architecture

**Last updated: 2026-03-23**

---

## Infrastructure

| Layer | Technology |
|-------|-----------|
| VPS | AlmaLinux, path: `/home/gnosiva/apps/content-engine/ai-tutor/` |
| Process manager | PM2 — 3 processes (see below) |
| DNS + SSL | Cloudflare — Full (strict) |
| Database | Neon PostgreSQL (pgvector enabled, 24+ migrations applied) |
| Cache + Queue | Redis (local) + BullMQ |
| File storage | Cloudflare R2 |
| Deploy script | `scripts/deploy-and-run.sh` |

### PM2 Processes

All three are defined in `ecosystem.config.cjs` and started with:
```
pm2 start ecosystem.config.cjs --env production --update-env
```

| Process | Script | Purpose |
|---------|--------|---------|
| `ai-tutor-web` | `npm start` (Next.js) | Serves the web app and all API routes |
| `content-engine-worker` | `scripts/run-worker.sh` | BullMQ consumer for content hydration jobs |
| `ai-tutor-scheduler` | `scripts/run-scheduler.sh` | Cron jobs + hydration reconciler |

---

## Application Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, App Router, TypeScript strict |
| Styling | TailwindCSS (mobile-first, 360px base) |
| Auth | NextAuth v5 — Google OAuth + email magic link |
| ORM | Prisma 6.19.1 (locked — do not upgrade to v7) |
| Database client | `@prisma/client` generated from `prisma/schema.prisma` |
| AI (teaching) | OpenAI GPT-4o |
| AI (content gen) | OpenAI GPT-4o-mini |
| AI (failover) | Anthropic claude-haiku-4-5 |
| Embeddings | `text-embedding-3-small` → pgvector (1536 dims) |
| Queue | BullMQ on Redis |

---

## Route Groups

The Next.js App Router uses four route groups:

| Group | Path prefix | Who uses it |
|-------|-------------|-------------|
| `(public)` | `/`, `/login`, `/signup` | Unauthenticated visitors |
| `(student)` | `/dashboard`, `/diagnostic/*`, `/session/*` | Authenticated students |
| `(parent)` | `/parent/*` | Authenticated parents |
| `(admin)` | `/admin/*` | Internal staff only |

---

## Key API Routes

### Student-facing
| Route | Purpose |
|-------|---------|
| `POST /api/user/onboarding` | Save board/grade/subjects after OAuth sign-in |
| `POST /api/tutor/session/start` | Create or resume a `StructuredSession` |
| `POST /api/tutor/turn` | Send a student message, receive Vidya's response (streaming) |

### Admin — Content Engine
| Route | Purpose |
|-------|---------|
| `POST /api/admin/hydrateAll` | Trigger HydrateAll pipeline for a board+grade+subject |
| `GET /api/admin/hydrateAll/stats` | Pipeline progress stats |
| `GET /api/admin/hydrateAll/[jobId]` | Individual job detail |
| `POST /api/admin/hydrateAll/[jobId]/retry` | Retry a failed job |
| `GET /api/admin/content-engine/jobs` | List all hydration jobs |
| `GET /api/admin/content-engine/queue` | BullMQ queue depth |
| `GET /api/admin/content-engine/workers` | Worker process health |
| `GET /api/admin/content-engine/summary` | System summary for dashboard |

### Admin — UI Pages
Main content-engine UI lives at `/admin/content-engine/`:
- `/admin/content-engine/hydrateAll` — trigger + monitor hydration
- `/admin/content-engine/jobs` and `/admin/content-engine/jobs/[id]` — job detail
- `/admin/content-engine/moderation` — content approval queue
- `/admin/content-engine/queue` — Redis queue status
- `/admin/content-engine/workers` — PM2 process health

---

## BullMQ Queues

| Queue name | Producer | Consumer | Purpose |
|------------|---------|---------|---------|
| `content-hydration` | `POST /api/admin/hydrateAll` + Outbox reconciler | `content-engine-worker` | HydrateAll pipeline (syllabus → notes → questions) |
| `diagnostic-bootstrap` | `POST /api/user/onboarding` (non-blocking) | `content-engine-worker` | Seed baseline `StudentConceptState` after onboarding |
| `distress-notification` | AI tutor safety layer | `content-engine-worker` | Safety alerts — currently gated (`ENABLE_DISTRESS_DETECTION=false`) |
| `weekly-digest` | `ai-tutor-scheduler` (Sunday 18:00 IST) | `ai-tutor-scheduler` | Parent weekly digest emails |

---

## Scheduler Jobs

Defined in `worker/scheduler.ts`. All run in the `ai-tutor-scheduler` PM2 process.

| Job | Interval | Function |
|-----|----------|---------|
| `hydrationReconciler` | 2 minutes | Polls `Outbox` table, dispatches pending hydration jobs to BullMQ |
| `markIgnored` | 24 hours | Marks stale `ContentRecommendation` rows as ignored |
| `weeklyParent` | 7 days | Aggregates `WeeklyStudentSummary` + sends parent digest |
| `readinessPrecompute` | 24 hours | Precomputes `ReadinessStatus` per student × subject |
| `costReport` | 24 hours | Writes `DailyCostMetric` from `AITutorTurnLog` totals |
| `dailyMaintenance` | 24 hours | Cleanup stale sessions, expired locks |
| `cleanup` | 7 days | Purge old telemetry, dead-letter rows |
| `dataDeletion` | 24 hours | Process `DeletionRequest` rows (DPDP erasure) |

---

## AI Pipeline

### Teaching (Vidya tutor turns)

```
Student message
  → POST /api/tutor/turn
  → Session state loaded from Redis (TTL 24h) + LearningSession DB
  → promptAssembly.ts: assembles PromptContext
      (studentName, grade, board, teachingLanguage, stage, stageAttemptCount,
       hintsUsed, ragChunks, conceptName, subjectName, recentMisconceptions)
  → RAG retrieval: CurriculumChunk table (pgvector cosine similarity)
  → OpenAI GPT-4o (streaming) — guided-question response
  → AITutorTurnLog written (tokens, cost, latencyMs, safetyFlagged)
  → Session state updated in Redis
```

Key file: `lib/ai/tutor/promptAssembly.ts`

### Content Generation (HydrateAll pipeline)

```
POST /api/admin/hydrateAll
  → HydrationJob created (status: pending)
  → Written to Outbox table
  → hydrationReconciler (every 2 min) reads Outbox, dispatches to BullMQ
  → content-engine-worker consumes:
      SyllabusWorker  → ChapterDef + TopicDef rows
      NotesWorker     → TopicNote rows (GPT-4o-mini)
      QuestionsWorker → GeneratedTest + GeneratedQuestion rows
  → AIContentLog written for every LLM call
```

Content gate: `topicDef.count > 0` for the subject before allowing diagnostic access.
Question promotion: `lib/tests.ts:syncFromGeneratedQuestions()` lazily promotes
`GeneratedQuestion` → `Question` on first `selectQuestions()` call.

### RAG Corpus Ingestion

```
scripts/scrape-ncert.ts --grade 10 --subject mathematics --lang en
  → Fetches NCERT content (ncert.nic.in, free educational license)
  → Chunks text, generates embeddings (text-embedding-3-small)
  → Upserts CurriculumChunk (SHA-256 contentHash dedup)
  → IngestRunLog written
```

---

## Auth Flow

1. Student hits Google OAuth → NextAuth creates `User` + `Account` rows.
2. `POST /api/user/onboarding` saves board, grade, subjects.
3. Under-18 students: `accountStatus = pending_parent_verification` until parent OTP verified.
4. Under-13 students: blocked at `ParentOTPGate` overlay until parent phone verified.
5. DPDP consent captured in `Consent` table (scope: DATA_PROCESSING, AI_INTERACTION, etc.).

`grade` and `board` are **immutable after first save** — stripped from every PATCH handler.

---

## Observability

| Signal | Where |
|--------|-------|
| Per-turn cost + latency | `AITutorTurnLog` |
| Daily cost summary | `DailyCostMetric` |
| Content gen cost | `AIContentLog` |
| System health snapshots | `SystemMetricSample` |
| Active alerts | `SystemAlert` |
| Flexible telemetry | `TelemetrySample` |
| Admin actions | `AuditLog` |
| Safety events | `SafetyEvent` |
