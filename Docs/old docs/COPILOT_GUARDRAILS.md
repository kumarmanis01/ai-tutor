# AI Content Engine – Copilot Guardrails

These rules are NON-NEGOTIABLE.

Copilot MUST follow them when generating or modifying code related to:

- AI Content Engine
- Admin dashboards
- Job execution
- Content moderation
- Prisma models for AI content

Violations are considered bugs.

---

## CORE PRINCIPLES

### 1. JOB-BASED EXECUTION ONLY

- AI execution is always done via immutable JOBS
- Jobs cannot be edited after creation
- No synchronous AI calls from UI or API routes

Allowed:

- createJob()
- retryJob()
- cancelJob()

Forbidden:

- generateContent()
- runAI()
- direct LLM calls from UI/API

---

### 2. NO PER-JOB PAUSE / RESUME

- Jobs are atomic
- Pause/resume applies ONLY to engine-level scheduling
- Running jobs must complete or fail naturally

Forbidden:

- pauseJob()
- resumeJob()
- partial execution state

---

### 3. NO STREAMING / PROGRESS TRACKING

- No token streaming
- No progress percentages
- No step-by-step job updates

Allowed:

- status = queued | running | failed | completed

---

### 4. STATUS-DRIVEN UI ONLY

UI behavior MUST be derived from job.status

Allowed:

- if status === "failed" → Retry
- if status === "queued" → Cancel

Forbidden:

- manual overrides
- hidden admin controls

---

### 5. SWR RULES (VERY IMPORTANT)

- Use SWR for admin data
- Never mix SWR with router.refresh()
- Always revalidate using mutate()

Forbidden:

- router.refresh() in admin pages

---

### 6. ENUMS ONLY (NO STRINGS)

The following must be Prisma enums:

- JobStatus
- JobType
- ContentStatus
- Language

Forbidden:

- string literals like "completed", "failed"

---

### 7. SOFT DELETES ONLY

- Never hard delete AI content or jobs
- Use deletedAt or isActive flags
- Cancelled jobs remain in DB

---

### 8. AUDIT EVERYTHING

Every admin action must:

- Create an audit log
- Include actor, action, entity, timestamp

---

### 9. NO MAGIC UI STATE

UI must never:

- Assume success
- Hide failures
- Retry silently

Admins must see:

- Errors
- Logs
- Status changes

---

### 10. FAILURE IS A FIRST-CLASS STATE

Failure is expected.
Retry must be explicit.

Forbidden:

- Auto-retry loops
- Silent retries
