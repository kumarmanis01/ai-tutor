# AI Content Engine – Enterprise Architecture & Guardrails

**Authoritative Source of Truth**  
**Role:** Senior Enterprise Architect  
**Audience:** Junior → Senior Engineers, Product, QA, Ops  
**Status:** Mandatory reading & compliance document

---

## 1. Purpose

This document defines the complete, end‑to‑end architecture, contracts, guardrails, and operating principles for the AI Content Engine.

**Objectives:**
- Consistency of design across APIs, workers, queues, DB, and UI
- Predictable behavior of AI generation jobs
- Zero ambiguity in hierarchy (Board → Class → Subject → Chapter → Topic)
- Robust handling of retries, failures, cancellation, and moderation
- A single mental model for humans and machines (Copilot, AI workers)

> **Note:** This document overrides tribal knowledge, ad‑hoc decisions, and partial implementations.

---

## 2. Core Domain Model

### 2.1 Curriculum Hierarchy (Non‑Negotiable)
```
Board
 └─ Class / Grade
  └─ Subject
    └─ Chapter
       └─ Topic
```

### 2.2 Definitions

- **Board:** Curriculum authority (CBSE, ICSE, State, IB)
- **Class / Grade:** Academic level under a board (e.g., Grade 6)
- **Subject:** Discipline under a class (Maths, Science)
- **Chapter:** Logical syllabus unit within a subject
- **Topic:** Smallest atomic instructional unit

> **Note:** Topic is the minimum generation unit for notes, questions, and tests.

### 2.3 Syllabus

- **Syllabus = Chapters + Topics for a Subject**
- Generated via AI but always draft + approval‑gated
- No content generation allowed unless syllabus exists

---

## 3. Prisma Schema Guardrails

### 3.1 ID‑First Rule (Absolute)
- All relations use foreign keys (IDs)
- Strings (name, slug) are display‑only
- No writes based on strings

### 3.2 Example (Conceptual)
- `Board(id)`
- `ClassLevel(id, boardId)`
- `SubjectDef(id, classId)`
- `ChapterDef(id, subjectId)`
- `TopicDef(id, chapterId)`

**Content tables:**
- `TopicNote(topicId, language, status)`
- `Question(topicId, difficulty, marks)`
- `GeneratedTest(topicId | chapterId)`

---

## 4. API Architecture & Contracts

### 4.1 API Philosophy
- APIs are thin orchestration layers
- **No AI calls in API routes**
- APIs validate, enqueue, and observe

### 4.2 `/api/hierarchy` (Foundational)
- **Read‑only**
- Used by all UI and admin tools
- Returns full hierarchy tree
- `GET /api/hierarchy`
- **Guarantees:** Stable IDs, no derived or inferred hierarchy

### 4.3 Job Submission APIs
- `POST /api/admin/content-engine/jobs`
- **Payload must include:**
  - `jobType`
  - `entityType` (`TOPIC` | `CHAPTER` | `SUBJECT`)
  - `entityId`
  - `language`
- **Validation rules:**
  - `entityId` must exist
  - hierarchy must be valid
  - syllabus must exist (unless `jobType = SYLLABUS`)

---

## 5. Execution Pipeline

### 5.1 Why a Pipeline Exists
All execution must pass through one pipeline to manage:
- retries
- failures
- cancellation
- observability

### 5.2 Pipeline Responsibilities
- Deduplicate jobs
- Track state transitions
- Retry with backoff
- Mark terminal failures
- Support cancellation

### 5.3 Job Lifecycle (Mandatory)
```
CREATED
 → QUEUED
 → RUNNING
 → (SUCCESS | FAILED | CANCELLED)
```
> Jobs stuck in PENDING are a bug, not a state.

---

## 6. Workers & Queues

### 6.1 Queue Creation Guardrail
- ❌ No queue or Redis client at module load
- ✅ Lazy initialization only

### 6.2 Worker Responsibilities
- Fetch job by ID
- Lock job
- Execute AI call
- Persist results
- Emit telemetry
- Update job status

**Workers NEVER:**
- accept user input
- infer hierarchy
- bypass approval

---

## 7. Retry, Failure, Cancellation

### 7.1 Retry Policy
- Network errors → retry
- AI transient errors → retry
- Validation errors → fail fast

### 7.2 Cancellation
- Admin‑initiated
- Worker checks cancellation flag between steps

---

## 8. Content Moderation & Approval

### 8.1 Status Model
- `DRAFT`
- `APPROVED`
- `REJECTED`
- `ARCHIVED`

### 8.2 Rules
- No DRAFT content visible to users
- Rejected content cannot be published
- Regeneration creates new draft

---

## 9. Deletion Rules

- **Soft delete only**
- Cascade delete prohibited without admin confirmation
- Audit log mandatory

---

## 10. UI/UX Guiding Principles

### 10.1 Hierarchy‑First UX
- User selects hierarchy before action
- UI never accepts free‑text identifiers

### 10.2 Deterministic UX
- Same inputs → same outcome
- No implicit defaults

### 10.3 Admin is a Supervisor, Not an Operator
- Admin triggers jobs
- System executes independently

---

## 11. Telemetry & Health Dashboard

### 11.1 Telemetry Must Capture
- Job latency
- Success/failure rate
- Retry counts
- Queue depth
- AI error classes

### 11.2 Dashboards
- API health
- Worker health
- Queue backlog
- Content completeness by hierarchy

---

## 12. Copilot Guardrails (MANDATORY)

Copilot MUST:
- ❌ Never introduce string‑based filters for hierarchy
- ❌ Never create queues at import time
- ❌ Never bypass approval flow
- ❌ Never add AI calls in API routes

Copilot MUST:
- Use IDs only
- Respect job lifecycle
- Log state transitions
- Ask before schema changes

> Any Copilot output violating these rules must be rejected.

---

## 13. Known Failure Pattern (Post‑Mortem Rule)

**Symptom:** Job stuck in PENDING  
**Root Causes:**
- enqueue failed silently
- worker not running
- Redis unavailable
- job status not transitioned

**Rule:**  
Every job submission must synchronously verify enqueue success.

---

## 14. Final Architectural Law

**Hierarchy is truth. Jobs are requests. Workers execute. Humans approve.**

If a design violates this sentence, it is wrong.

> This document is living but controlled. All changes require senior architectural review.  
> This is now your single, enterprise-grade source of truth.

---

## Addendum: System Diagrams & Canonical Models

### 1. System Context Diagram (High Level)

```
┌─────────────┐
│   ADMIN UI  │
│ (Next.js)   │
└──────┬──────┘
    │ HTTP (ID-based requests only)
    ▼
┌───────────────────────────────┐
│        API LAYER             │
│  /api/* (Next.js routes)     │
│ - Validation                 │
│ - Authorization              │
│ - ID Resolution              │
│ - Job Submission             │
└──────┬───────────────────────┘
    │ enqueue(job)
    ▼
┌───────────────────────────────┐
│ EXECUTION PIPELINE           │
│ (Job Orchestrator)           │
│ - Retry                      │
│ - Cancellation               │
│ - Idempotency                │
│ - Connectivity handling      │
│ - Telemetry emission         │
└──────┬───────────────────────┘
    │
    ▼
┌───────────────────────────────┐
│ QUEUE / REDIS (Lazy Init)     │
│ - contentQueue                │
│ - syllabusQueue               │
└──────┬───────────────────────┘
    │ consume
    ▼
┌───────────────────────────────┐
│ WORKERS (Isolated Process)    │
│ - callLLM                     │
│ - validation                  │
│ - moderation                  │
│ - persistence                 │
└──────┬───────────────────────┘
    │
    ▼
┌───────────────────────────────┐
│ PRISMA + POSTGRES             │
│ Canonical Academic Hierarchy  │
│ Versioned Content             │
│ Approval State                │
└───────────────────────────────┘
```

**Key Rules:**
- ❌ UI never talks to workers
- ❌ Workers never expose HTTP
- ✅ API layer is the only ingress
- ✅ Execution Pipeline owns retries/failures

---

### 2. Academic Domain Model (Canonical)

```
Board
 └── ClassLevel (Grade)
   └── SubjectDef
     └── ChapterDef
       └── TopicDef
         ├── TopicNote
         ├── GeneratedTest
         │     └── GeneratedQuestion
         └── AIContentLog
```

**Definitions:**
| Entity        | Meaning                                   |
| ------------- | ----------------------------------------- |
| Board         | Governing curriculum body (CBSE, ICSE, State) |
| ClassLevel    | Grade under a board (unique per board)    |
| SubjectDef    | Subject for a class (Maths, Physics)      |
| ChapterDef    | Curriculum chapter (versioned)            |
| TopicDef      | Atomic learning unit                      |
| Syllabus      | Chapters + Topics generated for a Subject |
| Notes         | Explanatory content for a Topic           |
| Test          | Difficulty-based assessment for a Topic   |
| Questions     | Items belonging to a Test                 |

> **Nothing exists outside TopicDef. All content is topic-scoped by design.**

---

### 3. UI → API → JOB → WORKER Sequence (Content Generation)

**Example: Generate Notes for a Topic**

1. **Admin UI**
  - `POST /api/admin/content-engine/jobs`  
   `{ entityType: "TOPIC", entityId }`
2. **API Route**
  - validate IDs
  - verify hierarchy integrity
  - create Job (`status=PENDING`)
3. **Execution Pipeline**
  - enqueue(jobId)
4. **Queue**
5. **Worker**
  - fetch topic + hierarchy
  - callLLM()
  - validate output
  - save as DRAFT
  - update job status = COMPLETED
6. **Prisma / DB**

**Failure Path (Connectivity / LLM Failure):**
- Worker: LLM timeout / network error
- Execution Pipeline: retry (policy-based), exponential backoff, emit telemetry
- Max retries exceeded → Job status = FAILED

---

### 4. Job Lifecycle

```
CREATED
   ↓
ENQUEUED
   ↓
RUNNING
   ↓
┌──────────────┐
│ COMPLETED    │
│ FAILED       │
│ CANCELLED    │
└──────────────┘
```

**Rules:**
- ❌ No job may remain in PENDING beyond enqueue timeout
- ❌ Workers cannot create jobs
- ✅ Pipeline must update state at every transition
- ✅ Admin UI must surface why a job failed

---

### 5. Execution Pipeline (Critical)

**Responsibilities:**
- Retry (configurable per job type)
- Cancellation
- Idempotency keys
- Circuit breaking
- Telemetry emission
- Queue connectivity handling

**Pseudocode:**
```js
execute(job) {
  markRunning(job)
  try {
  runWorker(job)
  markCompleted(job)
  } catch (err) {
  if (retryable(err)) retry(job)
  else markFailed(job, err)
  }
}
```

---

### 6. Telemetry & Health Dashboard

**Telemetry Events:**
- job_created
- job_enqueued
- job_started
- job_completed
- job_failed
- retry_attempt
- queue_disconnected
- llm_timeout

**Admin Dashboard Panels:**
- **Job Health:** Pending, Running, Failed, Avg Duration
- **LLM Health:** Timeout %, Cost, Retry rate
- **Queue Health:** Connectivity, Depth, Consumer lag

---

### 7. UI/UX Wireframe (Hierarchy-First)

```
[ Board ▼ ]
  ↓
[ Class ▼ ]
  ↓
[ Subject ▼ ]
  ↓
[ Chapter ▼ ] (optional)
  ↓
[ Topic ▼ ]

[ Language ▼ ]
[ Content Type ○ Notes ○ Test ○ Questions ]

[ Generate ]
```

**UX Rules:**
- Dropdowns reset downstream selections
- IDs only, never strings
- Empty states explain why (e.g., “Generate syllabus first”)
- No free-text academic input in admin UI

---

### 8. ESLint + Runtime Guardrails (Copilot Enforced)

**Forbidden:**
- ❌ Prisma access in UI
- ❌ Direct LLM calls
- ❌ String-based filters (subject="Maths")
- ❌ Queue creation at module load

**Required:**
- ✅ callLLM() wrapper
- ✅ ExecutionPipeline.execute()
- ✅ ID-based APIs
- ✅ Approval status checks

> Copilot must refuse to generate code violating these.

---

### 9. Content Moderation & Deletion

- All AI output = draft
- Teacher/admin approval required
- Soft delete only (lifecycle)
- New versions created, never overwrite

---

### 10. How All Pieces Interact (Summary)

| Layer      | Responsibility           |
| ---------- | ----------------------- |
| UI         | Human intent            |
| API        | Validation & submission |
| Pipeline   | Reliability & control   |
| Queue      | Async decoupling        |
| Worker     | Pure execution          |
| DB         | Source of truth         |
| Telemetry  | Observability           |

---

## Codebase Inspection Options

1. **Upload ZIP (Recommended):**
   - Zip the repo and upload directly in chat for full review.
2. **Paste Files Incrementally:**
   - Start with `/prisma/schema.prisma`, `/lib/queues/*`, `/api/admin/content-engine/*`, `workers`.
3. **GitHub Link:**  
   - Not accessible unless you paste files.

---

## Final Word (As Your Architect)

What you’re building is not just an edtech app —  
it is a content factory with human oversight and AI automation.

**Without:**
- diagrams
- lifecycle clarity
- pipeline ownership

…it will drift and break again.

**You’ve now locked the system.**

Below is a senior-enterprise-architect level design for Admin Dashboards, covering:

📐 Conceptual architecture  
🧠 What admins need to see & do  
🧩 API routes (clean contracts)  
🖥 UI layout & wireframes (textual)  
🔁 How dashboards interact with pipeline, jobs, workers  
📊 Telemetry & health correlation  
🔐 Guardrails (what UI can and cannot do)

This is designed to fit exactly into the architecture you locked above, not fight it.

---

# ADMIN DASHBOARDS — SYSTEM DESIGN

## 1. PURPOSE OF ADMIN DASHBOARDS (WHY THEY EXIST)

Admin dashboards are not CRUD UIs.  
They are observability + control surfaces for:

- Academic correctness
- AI reliability
- Operational health
- Human approval workflows

They answer four core admin questions:

1. What content exists, at what stage, for which board/class/subject/topic?
2. What jobs are running, stuck, failing, or retrying — and why?
3. Is the AI behaving well (cost, failures, latency)?
4. Can I intervene safely (approve, retry, cancel, rollback)?

---

## 2. DASHBOARD MODULES (HIGH-LEVEL)

Admin Console  
 ├── Academic Explorer  
 ├── Content Moderation  
 ├── Job Monitor  
 ├── Execution Pipeline Health  
 ├── AI / LLM Telemetry  
 ├── System Events & Audit Logs

Each module maps to specific API routes and specific DB tables.

---

## 3. ACADEMIC EXPLORER DASHBOARD

**Purpose:**  
Canonical, read-only navigation of the entire academic hierarchy.

**UI Wireframe**
```
┌────────────────────────────────────────────┐
│ Academic Explorer                           │
├────────────────────────────────────────────┤
│ Board ▼  CBSE                               │
│ Class ▼  6                                  │
│ Subject ▼ Mathematics                      │
│ Chapter ▼ Fractions (v1)                   │
│ Topic ▼ Proper Fractions                   │
├────────────────────────────────────────────┤
│ Content Summary                             │
│ - Notes: Draft (Hindi), Approved (English) │
│ - Tests: 2 Draft, 1 Approved               │
│ - Questions: 30 total                      │
└────────────────────────────────────────────┘
```

**API Contract**

- `GET /api/hierarchy`  
  Returns the full academic hierarchy tree.

- `GET /api/admin/content-summary?topicId=`  
  Returns content summary for a topic.

**Guardrails**

- ❌ No editing here
- ❌ No creation
- ✅ Pure observability

---

## 4. CONTENT MODERATION DASHBOARD

**Purpose:**  
Human approval of AI-generated academic content.

**UI Wireframe**
```
┌────────────────────────────────────────────┐
│ Content Moderation                         │
├────────────────────────────────────────────┤
│ Filters:                                  │
│ Board | Class | Subject | Topic | Language│
│ Status: Draft / Approved                  │
├────────────────────────────────────────────┤
│ [Topic] Proper Fractions                  │
│ Type: Notes (Hindi)                       │
│ Version: v1                               │
│ Generated by: AI                          │
│                                          │
│ [Content Viewer]                          │
│                                          │
│ ┌───────────┐  ┌───────────┐              │
│ │ Approve   │  │ Reject    │              │
│ └───────────┘  └───────────┘              │
└────────────────────────────────────────────┘
```

**API Contracts**

- Fetch pending content  
  `GET /api/admin/moderation/notes?status=draft`  
  `GET /api/admin/moderation/tests?status=draft`

- Approve  
  `POST /api/admin/moderation/notes/{id}/approve`

- Reject (with reason)  
  `POST /api/admin/moderation/notes/{id}/reject`  
  Payload: `{ "reason": "Incorrect example in paragraph 2" }`

**DB Effects**

- status: draft → approved
- editedByTeacher = true (if modified)
- Creates moderation audit log

---

## 5. JOB MONITOR DASHBOARD (MOST CRITICAL)

**Purpose:**  
Answer: “Why is my job stuck / failed / retrying?”

**UI Wireframe**
```
┌────────────────────────────────────────────┐
│ Job Monitor                                │
├────────────────────────────────────────────┤
│ Filters:                                  │
│ Status | Job Type | Entity Type | Date     │
├────────────────────────────────────────────┤
│ Job ID        Type        Status     Retries│
│ abc123        NOTES       RUNNING    1/3    │
│ def456        SYLLABUS    FAILED     3/3 ❌ │
│ ghi789        TESTS       PENDING    0/3 ⚠ │
├────────────────────────────────────────────┤
│ Selected Job Details                      │
│ - Entity: Topic → Proper Fractions        │
│ - Created At:                             │
│ - Last Error: LLM timeout                 │
│ - Retry Policy: Exponential (3)           │
│                                          │
│ [Retry] [Cancel]                          │
└────────────────────────────────────────────┘
```

**API Contracts**

- List jobs  
  `GET /api/admin/jobs?status=FAILED`

- Job details  
  `GET /api/admin/jobs/{jobId}`

- Retry  
  `POST /api/admin/jobs/{jobId}/retry`

- Cancel  
  `POST /api/admin/jobs/{jobId}/cancel`

**Pipeline Interaction**

- Retry → re-enqueue via Execution Pipeline
- Cancel → sets terminal state, worker checks cancellation token

---

## 6. EXECUTION PIPELINE HEALTH DASHBOARD

**Purpose:**  
Detect systemic failures, not content issues.

**UI Wireframe**
```
┌────────────────────────────────────────────┐
│ Execution Pipeline Health                  │
├────────────────────────────────────────────┤
│ Queue Status: Connected ✅                 │
│ Active Workers: 3                          │
│ Pending Jobs: 12                           │
│ Oldest Pending: 8m ⚠                      │
├────────────────────────────────────────────┤
│ Retry Rates (last 1h):                    │
│ - NOTES: 5%                               │
│ - TESTS: 18% ⚠                            │
└────────────────────────────────────────────┘
```

**API Contracts**

- Pipeline status  
  `GET /api/admin/pipeline/status`  
  Returns:  
  ```json
  {
  "queueConnected": true,
  "activeWorkers": 3,
  "pendingJobs": 12,
  "oldestPendingMs": 480000
  }
  ```

---

## 7. AI / LLM TELEMETRY DASHBOARD

**Purpose:**  
Cost + reliability governance.

**UI Wireframe**
```
┌────────────────────────────────────────────┐
│ AI Telemetry                               │
├────────────────────────────────────────────┤
│ Avg Latency: 2.1s                          │
│ Timeout Rate: 3.2%                         │
│ Daily Cost: ₹4,230                         │
├────────────────────────────────────────────┤
│ Errors by Type:                           │
│ - Timeout                                 │
│ - Rate Limit                              │
│ - Invalid Output                          │
└────────────────────────────────────────────┘
```

**API**

- `GET /api/admin/telemetry/llm`

---

## 8. SYSTEM EVENTS & AUDIT LOGS

**Purpose:**  
Compliance, debugging, trust.

**Captures:**
- Job state transitions
- Content approvals
- Deletions (soft)
- Admin actions
- Worker crashes

**API**

- `GET /api/admin/audit?entityType=Topic&id=...`

---

## 9. HOW DASHBOARDS INTERACT WITH PIPELINE (IMPORTANT)

Dashboard Action  
   ↓  
Admin API  
   ↓  
Execution Pipeline  
   ↓  
Queue / Worker  
   ↓  
Telemetry Event  
   ↓  
Dashboard Refresh

Dashboards never talk to workers directly.

---

## 10. ADMIN UI GUARDRAILS (NON-NEGOTIABLE)

- ❌ No free-text academic inputs
- ❌ No direct DB edits
- ❌ No bypassing approval
- ❌ No retry without job context

- ✅ IDs only
- ✅ Explicit actions
- ✅ Visible consequences
- ✅ Audit trail everywhere

---

## 11. WHY THIS DESIGN PREVENTS YOUR CURRENT ISSUE

“Job submitted but sitting in pending forever”

Because now:

- Job state transitions are visible
- Pipeline health shows queue / worker disconnect
- Retry + cancel are explicit
- Telemetry exposes where it broke
- No more blind spots

---

## ENTERPRISE-GRADE DELIVERY: ADMIN DASHBOARDS

Below is a comprehensive, enterprise-grade delivery covering all three asks, written as if this is the canonical implementation spec + starter code that a senior architect hands to the team.

### SECTION 1 — ADMIN API ROUTE STUBS (CANONICAL CONTRACTS)

These APIs are read-only by default, ID-driven, audited, and pipeline-aware.

#### 1.1 Academic Hierarchy (Read-only, cached)

- `GET /api/admin/hierarchy`  
  Purpose: Single canonical source for UI navigation

```ts
// /api/admin/hierarchy/route.ts
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const boards = await prisma.board.findMany({
  where: { lifecycle: "active" },
  include: {
    classes: {
    where: { lifecycle: "active" },
    orderBy: { grade: "asc" },
    include: {
      subjects: {
      include: {
        chapters: {
        where: { lifecycle: "active" },
        orderBy: { order: "asc" },
        include: {
          topics: {
          where: { lifecycle: "active" },
          orderBy: { order: "asc" }
          }
        }
        }
      }
      }
    }
    }
  }
  })

  return NextResponse.json(boards)
}
```

**Guardrails**
- ❌ No writes
- ❌ No filtering by string
- ✅ IDs only
- ✅ Cacheable

#### 1.2 Content Moderation APIs

- Fetch draft content  
  `GET /api/admin/moderation/notes?status=draft`  
  `GET /api/admin/moderation/tests?status=draft`

```ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "draft"

  const notes = await prisma.topicNote.findMany({
  where: { status },
  include: {
    topic: {
    include: {
      chapter: { include: { subject: { include: { class: { include: { board: true }}}}}}
    }
    }
  },
  orderBy: { createdAt: "desc" }
  })

  return NextResponse.json(notes)
}
```

- Approve / Reject Content  
  `POST /api/admin/moderation/notes/:id/approve`  
  `POST /api/admin/moderation/notes/:id/reject`

```ts
export async function POST(_: Request, { params }: { params: { id: string }}) {
  await prisma.topicNote.update({
  where: { id: params.id },
  data: { status: "approved" }
  })

  return NextResponse.json({ success: true })
}
```

Audit log must be written here (see schema section).

#### 1.3 Job Monitor APIs

- List Jobs  
  `GET /api/admin/jobs?status=FAILED`

```ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const jobs = await prisma.hydrationJob.findMany({
  where: status ? { status } : {},
  orderBy: { createdAt: "desc" }
  })

  return NextResponse.json(jobs)
}
```

- Retry / Cancel  
  `POST /api/admin/jobs/:id/retry`  
  `POST /api/admin/jobs/:id/cancel`

```ts
export async function POST(_: Request, { params }: any) {
  await prisma.hydrationJob.update({
  where: { id: params.id },
  data: { status: "pending", retries: { increment: 1 } }
  })

  // enqueue via pipeline (lazy init queue)
  await enqueueJob(params.id)

  return NextResponse.json({ success: true })
}
```

#### 1.4 Execution Pipeline Health

- `GET /api/admin/pipeline/status`

Returns:
```json
{
  "queueConnected": true,
  "activeWorkers": 2,
  "pendingJobs": 14,
  "oldestPendingMs": 420000
}
```

#### 1.5 AI Telemetry

- `GET /api/admin/telemetry/llm`  
  Returns aggregated metrics from telemetry table.

---

### SECTION 2 — ADMIN UI COMPONENTS (NEXT.JS + SWR)

These are clean, composable dashboards, not bloated pages.

#### 2.1 Academic Explorer UI

```tsx
export function AcademicExplorer() {
  const { data } = useSWR("/api/admin/hierarchy", fetcher)

  return (
  <div>
    <HierarchyTree data={data} />
    <ContentSummaryPanel />
  </div>
  )
}
```
Hierarchy tree is read-only.

#### 2.2 Content Moderation UI

```tsx
export function ModerationQueue() {
  const { data } = useSWR("/api/admin/moderation/notes?status=draft", fetcher)

  return data.map(note => (
  <ModerationCard
    key={note.id}
    title={note.title}
    content={note.contentJson}
    onApprove={() => approve(note.id)}
    onReject={() => reject(note.id)}
  />
  ))
}
```

#### 2.3 Job Monitor UI

```tsx
export function JobMonitor() {
  const { data } = useSWR("/api/admin/jobs", fetcher)

  return (
  <table>
    {data.map(job => (
    <JobRow
      job={job}
      onRetry={() => retry(job.id)}
      onCancel={() => cancel(job.id)}
    />
    ))}
  </table>
  )
}
```

#### 2.4 Pipeline Health Dashboard

```tsx
export function PipelineHealth() {
  const { data } = useSWR("/api/admin/pipeline/status", fetcher, { refreshInterval: 5000 })

  return (
  <StatsGrid stats={data} />
  )
}
```

#### 2.5 AI Telemetry Dashboard

- Charts:  
  - Latency over time  
  - Failure rates  
  - Cost per job type

---

### SECTION 3 — DATABASE SCHEMA (JOBS + TELEMETRY)

This is critical — your current pain comes from missing clarity here.

#### 3.1 Job Table (Hydration / Generation)

```prisma
model HydrationJob {
  id           String   @id @default(cuid())
  jobType      JobType
  entityType   String // TOPIC | SUBJECT | CHAPTER
  entityId     String

  status       JobStatus @default(pending)
  retries      Int       @default(0)
  maxRetries   Int       @default(3)

  lastError    String?
  startedAt    DateTime?
  finishedAt   DateTime?

  createdAt    DateTime  @default(now())
}
```

#### 3.2 Execution Events (State Machine)

```prisma
model JobExecutionLog {
  id        String   @id @default(cuid())
  jobId     String
  job       HydrationJob @relation(fields: [jobId], references: [id])

  event     String // STARTED | RETRY | FAILED | COMPLETED
  message   String?
  createdAt DateTime @default(now())
}
```

#### 3.3 AI Telemetry

```prisma
model AITelemetry {
  id           String   @id @default(cuid())
  jobId        String?
  model        String
  latencyMs    Int
  tokenCount   Int
  costUsd      Float
  success      Boolean
  errorType    String?
  createdAt    DateTime @default(now())
}
```

#### 3.4 Admin Audit Log

```prisma
model AdminAuditLog {
  id        String   @id @default(cuid())
  adminId  String
  action   String
  entity   String
  entityId String
  metadata Json?
  createdAt DateTime @default(now())
}
```

---

## HOW ALL OF THIS INTERACTS (MENTAL MODEL)

Admin UI  
  ↓  
Admin API (ID-based)  
  ↓  
Execution Pipeline  
  ↓  
Queue / Worker  
  ↓  
Telemetry + Job Logs  
  ↓  
Admin Dashboards

No shortcuts. No hidden state.

---

## WHY THIS IS ENTERPRISE-GRADE

- Deterministic content ownership
- Observable pipelines
- Human-in-the-loop moderation
- Safe retries and cancellations
- Clear onboarding for juniors
- Copilot-safe guardrails

Here is your excerpt, converted to Markdown (with code blocks and diagrams preserved):


## Sequence Diagrams (Canonical)

### 1. Job Lifecycle — AI Content Generation

**Scenario:** Admin generates Notes for a Topic

```
Admin UI
     |
     | 1. Select Board → Class → Subject → Topic
     | 2. Click "Generate Notes"
     v
Admin API (/content-engine/jobs)
     |
     | 3. Validate IDs (topicId exists, active)
     | 4. Create HydrationJob (status=pending)
     | 5. Write JobExecutionLog: CREATED
     | 6. Enqueue job via Execution Pipeline
     v
Execution Pipeline
     |
     | 7. Retry-safe enqueue
     | 8. Connectivity checks (Redis/Queue)
     v
Queue (Bull / Redis)
     |
     | 9. Worker pulls job
     v
Worker Process
     |
     | 10. Update job status=running
     | 11. Write JobExecutionLog: STARTED
     |
     | 12. callLLM() (single place)
     | 13. Capture telemetry (tokens, latency)
     |
     | 14. Persist draft content (TopicNote)
     | 15. status=draft (never auto-approve)
     |
     | 16. Update job status=completed
     | 17. Write JobExecutionLog: COMPLETED
     v
Admin Dashboard
     |
     | 18. Job moves to COMPLETED
     | 19. Draft content appears in Moderation Queue
```

**Invariants**

- Job never jumps from pending → completed
- Worker never runs without job ownership
- Content always lands as draft

---

### 2. Moderation Lifecycle — Human-in-the-Loop

**Scenario:** Moderator reviews and approves/rejects content

```
Admin Moderator
     |
     | 1. Open Moderation Dashboard
     v
Admin API (/moderation/notes?status=draft)
     |
     | 2. Fetch draft notes with hierarchy context
     v
Moderator UI
     |
     | 3. Review content
     |
     |---- Approve ----|
     |                 |
     |---- Reject -----|
     v                 v
Approve API      Reject API
     |                 |
     | 4a. status=approved
     | 4b. status=rejected
     |
     | 5. Write AdminAuditLog
     | 6. Write JobExecutionLog (if linked)
     v
Content Store
     |
     | 7. Approved content becomes visible
     | 8. Rejected content is hidden but retained
```

**Invariants**

- No edits overwrite AI output without version bump
- Rejection never deletes content
- Approval is explicit, not inferred

---

## Copilot System Instructions (Drop-In)

**Put this in `/docs/COPILOT_RULES.md` and Copilot’s system prompt.**

### Copilot System Directive — AI Content Engine

**Global Principles (Non-Negotiable):**

- This is a job-based AI system
- No synchronous AI calls in API routes
- No LLM imports outside `lib/callLLM`
- No string-based hierarchy filtering
- IDs are the source of truth
- All content requires approval
- All failures must be observable

**Data & Schema Rules:**

- Board → ClassLevel → SubjectDef → ChapterDef → TopicDef is canonical
- Never add duplicate hierarchy paths
- Never persist boardName, subjectName, etc. without resolving IDs
- Use joins, not denormalized strings

**API Rules:**

- APIs must validate IDs and reject ambiguous input
- Never create content directly, only enqueue jobs

**Forbidden:**

- Direct LLM calls
- Direct Redis connections at import time
- Free-text hierarchy filters

**Worker Rules:**

- Workers own exactly one job at a time
- Update job status explicitly
- Emit telemetry for every LLM call
- Never approve content

**Hydrator Rules:**

- Only enqueue jobs
- Must be idempotent
- Must check DB before enqueue
- Never call AI

**UI Rules:**

- Must load hierarchy from `/api/admin/hierarchy`
- Must submit IDs only
- Must reset child selections on parent change
- Must show moderation status clearly

**Telemetry & Observability:**

- Every AI call must log latency, tokens, cost, success/failure
- Jobs stuck in pending or running > threshold are surfaced

**Copilot Hard Fail Conditions:**

If any of these appear, STOP and ASK:

- “Let’s just call OpenAI here”
- “We can skip the job”
- “We’ll auto-approve”
- “We can infer board from text”

---

## Admin Dashboard Wireframes (Textual)

### 1. Admin Home Dashboard

```
┌──────────────────────────────────────┐
│ Admin Control Center                 │
├──────────────────────────────────────┤
│ 🧭 Academic Explorer                 │
│ ⚙️  Job Monitor                      │
│ 📝 Moderation Queue                  │
│ 📊 Pipeline Health                   │
│ 📈 AI Telemetry                      │
└──────────────────────────────────────┘
```

### 2. Academic Hierarchy Explorer

```
Board: CBSE ▼
    Class 6
        Mathematics
            Chapter 1
                Topic A
                Topic B
        Science
    Class 7
        ...
[Generate Syllabus]
[Generate Content]
```
Purpose: Read-only navigation, context provider for all actions

### 3. Job Monitor Dashboard

```
┌──────────────────────────────────────────────┐
│ Job Monitor                                  │
├───────┬──────────┬────────┬────────┬────────┤
│ Type  │ Entity   │ Status │ Retries│ Actions│
├───────┼──────────┼────────┼────────┼────────┤
│ Notes │ Topic A  │ RUNNING│ 1      │ Cancel │
│ Test  │ Topic B  │ FAILED │ 2      │ Retry  │
└───────┴──────────┴────────┴────────┴────────┘
```

### 4. Moderation Queue

```
┌──────────────────────────────────────────────┐
│ Draft Notes (Topic: Fractions)               │
├──────────────────────────────────────────────┤
│ Title: Understanding Fractions               │
│ -------------------------------------------- │
│ [Rendered Content Preview]                   │
│                                              │
│ -------------------------------------------- │
│ [Approve]   [Reject]   [Edit + Approve]      │
└──────────────────────────────────────────────┘
```

### 5. Pipeline Health Dashboard

```
┌──────────────────────────────────────────────┐
│ Execution Pipeline Health                    │
├──────────────────────────────────────────────┤
│ Queue Connected: ✅                          │
│ Active Workers: 2                            │
│ Pending Jobs: 14                             │
│ Oldest Pending: 7m 12s ⚠️                    │
└──────────────────────────────────────────────┘
```

### 6. AI Telemetry Dashboard

```
┌──────────────────────────────────────────────┐
│ AI Telemetry                                 │
├──────────────────────────────────────────────┤
│ Avg Latency: 1.8s                            │
│ Failure Rate: 2.1%                           │
│ Cost (24h): $4.32                            │
│                                              │
│ [Latency Chart] [Cost Trend] [Failures]      │
└──────────────────────────────────────────────┘
```

---

## Final Architect Verdict

You now have:

- Deterministic hierarchy
- Observable execution
- Human approval gates
- Retry-safe pipelines
- Copilot-safe development rules
- Scalable admin UX

This is enterprise-ready, onboarding-safe, and future-proof.
