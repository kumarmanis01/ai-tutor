# 📘 AI Content Engine – Architecture, Governance & Copilot Guidance

**Spinzy Academy | Senior Architect Document**

**Version:** 1.0  
**Audience:** Engineering, Product, AI Assistants (Copilot / Cursor / ChatGPT)  
**Status:** Canonical Source of Truth

---

## 1. PURPOSE OF THIS DOCUMENT

This document defines:

* The **architecture** of the AI Content Engine
* The **operating model** (job-based, not interactive)
* The **admin workflows** for AI moderation
* The **analytics & audit expectations**
* The **rules that AI coding assistants MUST follow**

> ❗ Any code, UI, API, or migration that violates this document is considered **incorrect by design**.

---

## 2. SYSTEM OVERVIEW (HIGH-LEVEL)

### What problem are we solving?

We want to **generate syllabus-aligned educational content** (notes, tests, questions) across:

* Boards: CBSE, ICSE, IB
* Grades: 1–12
* Subjects
* Languages: English, Hindi

…using AI, **safely, reviewably, and scalably**.

---

## 3. CORE ARCHITECTURAL DECISION (MOST IMPORTANT)

### ✅ The AI Content Engine is **JOB-BASED**

It is NOT:

* A streaming system
* A long-running interactive process
* A per-job pause/resume engine

It IS:

* Intent-driven
* Queue-based
* State-machine controlled
* Admin-governed

---

## 4. MENTAL MODEL (MANDATORY)

### Correct model:

```
Admin Action
    → Create ContentGenerationJob
          → Worker picks job
                 → Atomic AI call
                        → Validate JSON
                              → Persist content
                                     → Mark job completed/failed
```

### Incorrect model (DO NOT IMPLEMENT):

```
UI Button
    → Start AI
          → Partial output
                 → Pause
                        → Resume
                              → Progress bar
```

---

## 5. DOMAIN MODELS (CANONICAL)

### 5.1 Content Generation Job

```prisma
model ContentGenerationJob {
  id         String   @id @default(cuid())
  jobType    JobType
  entityType EntityType
  entityId   String?
  language   String?
  status     JobStatus
  priority   Int      @default(5)
  retries    Int      @default(0)
  error      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum JobStatus {
  queued
  running
  completed
  failed
  cancelled
}
```

> ❗ No other job/session/progress model is allowed.

---

### 5.2 Content Status & Moderation

```prisma
enum ContentStatus {
  pending
  approved
  rejected
  archived
}
```

All AI-generated content:

* Starts as `pending`
* Is invisible to students
* Requires admin approval

---

### 5.3 Approval Audit Trail (MANDATORY)

```prisma
model ContentApprovalLog {
  id          String   @id @default(cuid())
  entityType  EntityType
  entityId    String
  action      ApprovalAction
  adminId     String
  comment     String?
  createdAt   DateTime @default(now())
}

enum ApprovalAction {
  approved
  rejected
  rolled_back
}
```

---

## 6. STATE MACHINES (STRICT)

### 6.1 Job State Machine

Allowed transitions:

```
queued → running
running → completed
running → failed
queued → cancelled
failed → queued (manual retry)
```

Forbidden:

```
running → paused ❌
paused → resumed ❌
completed → resumed ❌
```

---

### 6.2 Content State Machine

```
generated → pending → approved → visible
                      ↘ rejected → hidden
```

Rollback = **new version**, never overwrite.

---

## 7. “PAUSE / RESUME” — CLARIFIED (VERY IMPORTANT)

### ❌ There is NO per-job pause/resume.

### ✅ Pause is **GLOBAL ENGINE PAUSE**

```prisma
model SystemConfig {
  key   String @id
  value String
}
```

Example:

```
key = "CONTENT_ENGINE_PAUSED"
value = "true"
```

Workers must check this before picking new jobs.

> Running jobs are **never interrupted**.

---

## 8. API DESIGN (CANONICAL)

### 8.1 Intent APIs (Create Jobs)

```
POST /api/admin/content-engine/jobs
```

Payload:

```json
{
  "jobType": "GENERATE_NOTES",
  "entityType": "TOPIC",
  "entityId": "topic_id",
  "language": "hi"
}
```

---

### 8.2 Control APIs (GLOBAL ONLY)

```
POST /api/admin/content-engine/pause
POST /api/admin/content-engine/resume
```

---

### 8.3 Job Management APIs

```
POST /api/admin/content-engine/jobs/{id}/cancel
POST /api/admin/content-engine/jobs/{id}/retry
```

---

### 🚫 Forbidden APIs (DO NOT GENERATE)

```
/start
/pause/{jobId}
/resume/{jobId}
/progress
/stream
```

---

## 9. ADMIN UI REQUIREMENTS

### Admin Dashboard MUST SHOW:

* Job table

  * Job Type
  * Entity
  * Language
  * Status
  * Created At
* Actions:

  * Retry (failed)
  * Cancel (queued)

### Global Controls:

* Pause Engine
* Resume Engine

---

### Admin UI MUST NOT:

* Show progress bars
* Show percentages
* Show timers
* Show partial content
* Allow resume of running jobs

---

## 10. AI EXECUTION RULES (NON-NEGOTIABLE)

Every AI call must:

* Be **atomic**
* Return **full JSON**
* Be **schema-validated**
* Be **retryable**
* Log to `AIContentLog`

### Logging example:

```prisma
model AIContentLog {
  id         String   @id @default(cuid())
  promptType String
  input      Json
  output     Json?
  success    Boolean
  error      String?
  createdAt  DateTime @default(now())
}
```

---

## 11. PROMPT GOVERNANCE

### Prompts must be:

* Versioned
* Deterministic
* JSON-only

Example:

```txt
SYSTEM:
You are an NCERT-aligned content generator.

USER:
Generate Class 6 CBSE Maths notes for "Fractions".
Return STRICT JSON matching schema v1.2.
```

---

## 12. ANALYTICS STRATEGY

### 12.1 Do NOT use GTM for:

* AI usage
* Job execution
* Content moderation

### 12.2 Log internally:

* Job lifecycle
* AI calls
* Approval actions

External tools (GA, PostHog) only for:

* UI clicks
* Admin navigation
* Funnel metrics

---

## 13. SOFT DELETES (PRISMA-LEVEL)

All content models must include:

```prisma
isDeleted Boolean @default(false)
deletedAt DateTime?
```

Never hard-delete educational content.

---

## 14. MIGRATION SAFETY RULES

* Additive migrations only
* Never drop columns without archive
* Approval logs are append-only
* Rollback = new record, not overwrite

---

## 15. COPILOT / AI ASSISTANT RULES (READ CAREFULLY)

### Copilot MUST:

* Use job-based orchestration
* Respect state machines
* Avoid progress tracking
* Avoid streaming logic
* Use enums, not strings
* Ask before inventing abstractions

### Copilot MUST NOT:

* Implement pause/resume per job
* Add WebSockets
* Add background loops in API routes
* Chunk AI output
* Store partial content

---

## 16. REQUIRED CODE COMMENT (PASTE IN FILES)

```ts
/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */
```

---

## 17. WHY THIS DOCUMENT EXISTS (META)

This document exists because:

* Humans infer intent
* AI assistants do not
* Ambiguity causes architectural drift

This is the **single source of truth**.

---

## 18. FINAL GUARANTEE

If this document is followed:

✅ Copilot generates correct code  
✅ Admin workflows stay clean  
✅ AI content is safe & auditable  
✅ System scales without rewrites


## 🧩 ADMIN UI WIREFRAMES

### AI Content Engine Moderation & Control

> **Design philosophy:** Clarity > Control > Auditability  
> _No animations, no progress bars, no real-time streaming._
> modular, plug & play, follow SOLID principles
---

#### 1. **Job Table**

| Job Type         | Entity         | Language | Status    | Created At         | Actions         |
|------------------|---------------|----------|-----------|--------------------|-----------------|
| GENERATE_NOTES   | Topic: Fractions | Hindi    | queued    | 2024-06-01 10:00   | Cancel          |
| GENERATE_TEST    | Chapter: Algebra | English  | failed    | 2024-06-01 09:45   | Retry           |
| GENERATE_QUESTIONS | Topic: Photosynthesis | Hindi    | completed | 2024-06-01 09:30   | -               |

- **Actions:**  
    - **Retry** (only for failed jobs)  
    - **Cancel** (only for queued jobs)

---

#### 2. **Global Controls**

| [Pause Engine] | [Resume Engine] |

- Only one is enabled at a time, reflecting current engine state.

---

#### 3. **Content Moderation Table**

| Content ID | Type    | Status   | Language | Created At         | Actions                |
|------------|---------|----------|----------|--------------------|------------------------|
| 12345      | Notes   | pending  | Hindi    | 2024-06-01 10:05   | Approve / Reject       |
| 12346      | Test    | approved | English  | 2024-06-01 09:50   | -                      |
| 12347      | Notes   | rejected | Hindi    | 2024-06-01 09:40   | -                      |

---

#### 4. **Approval Audit Trail**

| Action      | Admin      | Entity         | Comment         | Timestamp            |
|-------------|------------|----------------|-----------------|----------------------|
| approved    | admin@xyz  | Notes: 12345   | Looks good      | 2024-06-01 10:10     |
| rejected    | admin@xyz  | Test: 12346    | Needs revision  | 2024-06-01 09:55     |

---

#### 5. **No Progress Indicators**

- No progress bars, percentages, or timers.
- No partial content display.
- No per-job pause/resume controls.

---

#### 6. **Wireframe Sketches (ASCII)**

```
+-------------------------------------------------------------+
| AI Content Engine – Admin Dashboard                         |
+-------------------------------------------------------------+
| [Pause Engine] [Resume Engine]                              |
+-------------------------------------------------------------+
| Jobs                                                       |
|-------------------------------------------------------------|
| Type        | Entity      | Lang | Status   | Created   | A |
|-------------|-------------|------|----------|-----------|---|
| ...         | ...         | ...  | ...      | ...       |...|
+-------------------------------------------------------------+
| Content Moderation                                          |
|-------------------------------------------------------------|
| ID   | Type  | Status   | Lang | Created   | Actions    |
|------|-------|----------|------|-----------|------------|
| ...  | ...   | ...      | ...  | ...       | ...        |
+-------------------------------------------------------------+
| Approval Audit Trail                                        |
|-------------------------------------------------------------|
| Action   | Admin   | Entity   | Comment   | Timestamp   |
|----------|---------|----------|-----------|-------------|
| ...      | ...     | ...      | ...       | ...         |
+-------------------------------------------------------------+
```