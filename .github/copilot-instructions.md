consider yourself to be an Senior Enterprise Software Architect, who always writes production ready well documented safe code, creates approach documents that is always concrete in safety and SOLID principles, well commented & documented code ---

# HARD GUARDRAILS — Copilot Instructions

Copilot MUST obey these rules when generating or modifying code related to the AI Content Engine.

🔒 ABSOLUTE DO NOTs

❌ DO NOT call LLMs from:

- API routes
- UI components
- Server actions

❌ DO NOT introduce:

- String-based status fields
- Cascading deletes for academic or AI content
- In-memory job state
- Module-scope Redis or Queue connections

❌ DO NOT:

- Mutate completed jobs
- Retry jobs by editing existing rows
- Create workers per job
- Bypass moderation

✅ REQUIRED PATTERNS
Job Handling

- Always create `ExecutionJob`
- Always use enums for status
- Always lock jobs atomically
- Retry = new job

Worker Rules

- Lazy-initialize Redis/queues
- Emit lifecycle events
- Write audit logs
- Gracefully drain on shutdown

API Rules

- Accept and return IDs only
- Validate hierarchy existence
- Never assume Redis availability
- Write `AuditLog` for admin actions

Content Rules

- Version everything
- Soft delete only
- Approval required for visibility
- Every AI call logs `AIContentLog`

🧠 Mental Model Copilot Must Follow

“This is an enterprise academic content system, not a chat app.”

Deterministic

Auditable

Moderated

Cost-aware

Failure-tolerant

📌 If Copilot Is Unsure

Copilot MUST:

- Ask for clarification
- Default to safety
- Prefer DB truth over queues
- Prefer immutability over convenience

# 🛡️ AI Content Engine – Copilot Guardrails

> **Purpose**
> Prevent architectural regressions, unsafe AI execution patterns, and UI anti-patterns.

---

## 1️⃣ GLOBAL COPILOT INSTRUCTION (MANDATORY)

Create a file:

📄 **`/docs/COPILOT_GUARDRAILS.md`**

```md
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
```

---

## 2️⃣ INLINE FILE-LEVEL GUARDRAIL (TOP COMMENT)

Add this to **EVERY admin page / API route** related to AI:

```ts
/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */
```

Copilot reads comments first. This works.

---

## 3️⃣ PRISMA SCHEMA GUARDRAILS

Add this comment at top of `schema.prisma`:

```prisma
/// ⚠️ AI CONTENT ENGINE RULES
/// - JobStatus, JobType, ContentStatus MUST be enums
/// - No string status fields
/// - No cascading deletes for jobs or content
/// - Soft deletes only
```

---

## 4️⃣ TYPESCRIPT ENFORCEMENT (CRITICAL)

Create:

📄 **`/lib/ai-engine/types.ts`**

```ts
export type JobStatus = 'queued' | 'running' | 'failed' | 'completed' | 'cancelled';
export type JobType =
  | 'GENERATE_SYLLABUS'
  | 'GENERATE_NOTES'
  | 'GENERATE_TEST'
  | 'GENERATE_QUESTIONS';

export type EntityType = 'BOARD' | 'CLASS' | 'SUBJECT' | 'TOPIC';
export type Language = 'English' | 'Hindi';
```

Then enforce usage everywhere:

❌ Forbidden

```ts
status: 'done';
```

✅ Required

```ts
status: JobStatus.Completed;
```

---

## 5️⃣ ESLINT / CODE REVIEW RULES (OPTIONAL BUT POWERFUL)

Add to `.eslintrc.json`:

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/navigation",
            "importNames": ["useRouter"],
            "message": "Do not use router.refresh() in admin pages. Use SWR mutate()."
          }
        ]
      }
    ]
  }
}
```

This **literally prevents regression**.

---

## 6️⃣ COPILOT PROMPT TO USE BEFORE GENERATION

Paste this **before asking Copilot to generate code**:

```md
Follow the AI Content Engine Guardrails strictly.

Constraints:

- Job-based execution only
- No streaming
- No progress tracking
- No per-job pause/resume
- SWR mutate only (no router.refresh)
- Enum-based statuses only
- Soft deletes only
- Audit logs required for admin actions

If unsure, choose the safer, simpler design.
```

---

## 7️⃣ ARCHITECTURAL INVARIANTS (FINAL SAFETY NET)

These **must NEVER change**:

| Invariant               | Reason              |
| ----------------------- | ------------------- |
| Jobs are immutable      | Prevent corruption  |
| AI is async             | Prevent UI blocking |
| Failure is expected     | Prevent hacks       |
| Admin approval required | Trust boundary      |
| No streaming            | Determinism         |
| Retry > Resume          | Safety              |

---

## ✅ FINAL VERDICT

With these guardrails:

✔ Copilot cannot introduce unsafe patterns
✔ Junior devs cannot break architecture
✔ AI engine remains deterministic
✔ Admin UX remains honest
✔ Future scale is preserved

This is **production-grade governance**.

---

# AI Coding Agent Instructions for Spinzy Academy

Welcome to the Spinzy Academy codebase! This document provides essential guidelines for AI coding agents to be productive and aligned with the project's architecture, workflows, and conventions.

## Project Overview

Spinzy Academy is a multilingual, accessibility-focused educational platform built with Next.js. Key features include:

- Multilingual chat (English/Hindi)
- Speech capabilities (Text-to-Speech and microphone input)
- Integration with OpenAI APIs for AI-driven features
- Modular and scalable architecture

The project is structured as a monorepo with clear separation of concerns:

- **Frontend**: Located in the `app/` directory, built with Next.js.
- **Backend APIs**: Defined in the `app/api/` directory, following RESTful conventions.
- **Shared Components**: Reusable UI components in `components/`.
- **Utilities and Libraries**: Helper functions in `lib/`.
- **Database**: Prisma ORM with schema in `prisma/schema.prisma`.

## Developer Workflows

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) to view the app.

### Testing

- End-to-end tests are located in `tests/e2e/`.
- These tests validate critical user flows, such as authentication, chat functionality, and API integrations.
- Run tests with:
  ```bash
  npm test
  ```

### Database Migrations

- Prisma is used for database management.
- Apply migrations with:
  ```bash
  npx prisma migrate dev
  ```

## Project-Specific Conventions

### Component Structure

- Components are colocated with their styles and tests.
- Use TypeScript for type safety.
- Follow the folder structure in `components/` for organization.
- Communication between components often relies on `props`, as seen in `components/Chat/Controls.tsx`.

### API Design

- APIs are defined in `app/api/`.
- Use RESTful principles and ensure proper error handling.
- Example: The `/api/free-questions` endpoint is used in `Controls.tsx` to fetch the remaining free questions for non-premium users. Handle errors gracefully and log them for debugging.

### State Management

- Context API is used for global state management (e.g., `context/AuthProvider.tsx`).
- Local state is managed using React hooks like `useState` and `useEffect` in components.

### Styling

- Tailwind CSS is used for styling. Configuration is in `tailwind.config.js`.
- Maintain consistent design patterns across components.

## Integration Points

### OpenAI API

- Requires `OPENAI_API_KEY` in `.env.local`.
- Used for AI-driven features in `lib/aiContext.ts`.

### Speech and Multilingual Features

- The `SpeechInput` component in `components/Chat/` handles microphone input and integrates with the speech-to-text engine.
- The `LanguageSelector` component allows users to switch between supported languages dynamically.
- Ensure proper error handling for speech-related features, as seen in `Controls.tsx`.

### Database

- Prisma ORM is configured in `prisma/`.
- Database connection settings are in `.env.local`.

### External Libraries

- `next-auth` for authentication.
- `razorpay` for payment integration.
- `i18n` for internationalization.

## Examples

### Adding a New API Endpoint

1. Create a new folder in `app/api/` (e.g., `app/api/new-feature/`).
2. Define the endpoint in `route.ts`.
3. Use `lib/db.ts` for database interactions.

### Creating a New Component

1. Add the component in `components/`.
2. Include styles in the same folder.
3. Export the component for reuse.
4. Example: The `Controls` component in `components/Chat/` demonstrates how to manage user input, API calls, and dynamic UI updates.

---

For further questions, refer to the `README.md` or ask a team member.

### Creating/ Updating code

1. Always refer to this document before generating or modifying code.
2. Follow the established project structure and conventions.
3. Ensure all new code is well-documented and tested.
4. Maintain consistency with existing code patterns.
5. Use meaningful commit messages that reflect the changes made.
6. Review code for adherence to project guidelines before merging.
7. Keep dependencies up to date and avoid introducing unnecessary libraries.
8. Prioritize performance and scalability in your implementations.
9. Ensure accessibility standards are met in UI components.
10. Always "Why" about the purpose of the code you are writing or modifying.
11. When in doubt, consult with the team or refer to existing implementations for guidance.

```

```

---

## 8️⃣ LOGGING AND DOCUMENTATION INSTRUCTIONS

- Always use the project's logger utility for all logging purposes.
- Do NOT use `console.log`, `console.error`, or other console methods in production or development code.
- Ensure all log messages are meaningful and follow the project's logging conventions.

---

## 9️⃣ REFERENCE DOCUMENTATION

- Before generating or modifying any code, always read and consider the contents of `/docs/AI_CONTENT_INDEX.md`.
- Ensure your implementation aligns with the documentation and requirements described in `/docs/AI_CONTENT_INDEX.md`.
