# Phase 7 — AI Content Generation Engine (Lessons, Quizzes, Projects)

Principle:
Phase 7 generates content, but never structure.
All structure comes from Phase 6 (Approved Syllabus).

🎯 Phase 7 Goal (What & Why)
What we want to achieve

Transform an APPROVED syllabus into:

- Structured lessons
- Knowledge checks (MCQs)
- Practical assignments / projects

All content must be:

- Schema-validated
- Versioned
- Reviewable
- Regeneratable

Why this phase exists

To prevent:

- Hallucinated lesson structures
- Inconsistent depth
- Non-reviewable AI output
- Content drift over time

🧠 Phase 7 Core Rules (Non-Negotiable)

- No syllabus → no content
- Only APPROVED syllabus can generate content
- Each content type has its own schema
- AI outputs JSON only
- All content is persisted & versioned
- Approval gate before publishing

🧱 Phase 7 Sub-Phases (Execution Order)
Phase 7
 ├─ 7.1 Lesson Schema
 ├─ 7.2 Lesson Generator
 ├─ 7.3 Quiz Schema + Generator
 ├─ 7.4 Project / Assignment Generator
 ├─ 7.5 Content Approval Workflow
 └─ 7.6 Content Packaging (Course View)

Each sub-phase is independently testable.

🟦 Phase 7.1 — Lesson Schema (FOUNDATION)
🎯 Goal

Define what a lesson is — before generating any content.

Lesson Schema Design

Conceptual model

Course
 └─ Module
     └─ Lesson
         ├─ Explanation
         ├─ Examples
         ├─ Key Takeaways
         ├─ Practice Prompt

TypeScript Types

📄 lib/content/lesson/types.ts

```ts
export interface Lesson {
  id: string
  syllabusId: string
  moduleId: string
  lessonIndex: number

  title: string
  durationMinutes: number

  objectives: string[]

  explanation: {
    overview: string
    concepts: {
      title: string
      explanation: string
      example?: string
    }[]
  }

  keyTakeaways: string[]

  practice: {
    prompt: string
    expectedOutcome: string
  }

  metadata: {
    level: "beginner" | "intermediate" | "advanced"
    prerequisites?: string[]
  }
}
```

Zod Schema

📄 lib/content/lesson/schema.ts

```ts
import { z } from "zod"

export const LessonSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  moduleId: z.string(),
  lessonIndex: z.number().int(),

  title: z.string().min(5),
  durationMinutes: z.number().int().min(5),

  objectives: z.array(z.string()).min(1),

  explanation: z.object({
    overview: z.string().min(50),
    concepts: z.array(
      z.object({
        title: z.string(),
        explanation: z.string().min(50),
        example: z.string().optional()
      })
    ).min(1)
  }),

  keyTakeaways: z.array(z.string()).min(2),

  practice: z.object({
    prompt: z.string().min(30),
    expectedOutcome: z.string().min(30)
  }),

  metadata: z.object({
    level: z.enum(["beginner", "intermediate", "advanced"]),
    prerequisites: z.array(z.string()).optional()
  })
})
```

🟦 Phase 7.2 — Lesson Generator (Controlled AI)
🎯 Goal

Generate lessons per module from an approved syllabus.

Generator Contract

📄 lib/content/lesson/generator.ts

```ts
generateLessons({
  syllabusId,
  moduleId,
  moduleTitle,
  learningObjectives,
  lessonCount
}) → Lesson[]
```

AI Prompt Rules

- JSON only

- One lesson per response OR batched

- No markdown

- No explanations outside JSON

Prompt Builder

📄 lib/content/lesson/prompt.ts

```ts
export function buildLessonPrompt(input) {
  return `
You are generating structured course lessons.

Rules:
- Output ONLY valid JSON
- Match the provided schema exactly
- Do not add extra fields
- Depth must match professional education quality

Input:
${JSON.stringify(input, null, 2)}

Return an array of Lesson objects.
`
}
```

Generator Logic

📄 generator.ts

```ts
const raw = await llm.generate(prompt)
const parsed = JSON.parse(raw)
const lessons = parsed.map(validateLesson)
return lessons
```

Notes:
- Do not implement generation logic yet — this section is the contract and prompt guidance only.

🟦 Phase 7.3 — Quiz Generator

🎯 Goal

Generate MCQs per lesson.

Quiz Schema (Simple & Safe)

```ts
export interface Quiz {
  lessonId: string
  questions: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
}
```

Zod enforces:
1. 4 options
2. correctIndex ∈ [0–3]

🟦 Phase 7.4 — Projects / Assignments Generator

🎯 Purpose (Copilot must understand this)

Projects are:

- Practical application of multiple lessons

- NOT quizzes

- NOT free-form text

- Evaluated via a clear rubric

Projects must be:

- Deterministic

- Schema-validated

- Reviewable

- Regeneratable

🧱 Phase 7.4 — Data Model
Conceptual Structure
Course
 └─ Module
   └─ Project / Assignment
     ├─ Problem Statement
     ├─ Constraints
     ├─ Deliverables
     ├─ Evaluation Rubric

🔷 Phase 7.5 — Content Approval Workflow (Critical Gate)

🎯 Purpose (Very Important)

Phase 7.5 is the safety gate.

Nothing becomes:
1. Publishable
2. Persistent
3. Visible to users

Unless it is:
1. Explicitly approved
2. Audited
3. Immutable after approval

Notes:
- Approval is an explicit admin action that records `approvedBy`, `approvedAt`, and an immutable snapshot of the content JSON.
- All attempts to modify an `APPROVED` artifact must be rejected; retries should create new draft artifacts instead.
- Every approval action must create an `AuditLog` entry that includes actor, timestamp, entity id, and a brief rationale.
- The UI and API MUST only surface `APPROVED` content to end-users; drafts are visible only to reviewers and admins.

Design Rules (Copilot must obey)

- Lessons, Quizzes, Projects start as `DRAFT`.
- Only `APPROVED` content can be published.
- Approved content is immutable.
- Approval requires: `approver`, `timestamp`, and an optional `note`.
- All approval actions are audited (create `AuditLog` entries including actor, timestamp, entity id, and rationale).



🟦 Phase 7.6 — Course Packaging

Assemble:

Course
 ├─ Syllabus
 ├─ Lessons
 ├─ Quizzes
 └─ Projects

No AI here — pure composition.

🧠 Why This Prevents Rework & Tech Debt
Risk	How Phase 7 avoids it
AI hallucinations	Schema + validation
Content drift	Versioning
Inconsistent quality	Fixed prompt contracts
Unreviewable output	Approval gates
Cost explosions	Deterministic generation

**Phase 7 Summary**

- **Goal:** Transform an APPROVED syllabus into validated, versioned, reviewable content (lessons, quizzes, projects) while preventing hallucination, drift, and inconsistent quality.
- **Completed so far:**
  - Formalized Phase 7 design and sub-phases (7.1–7.3)
  - Implemented `Lesson` types and Zod schema (`lib/content/lesson/types.ts`, `schema.ts`) with unit tests
  - Added lesson generator contract, prompt builder, mock LLM adapter, and unit tests (no generation logic that writes data)
  - Implemented Quiz types and Zod schema (`lib/content/quiz/schema.ts`) with generator contract and tests

- **Pending / Next:**
  - Implement Project / Assignment schema and generators (7.4)
  - Implement approval workflow for generated content (7.5) including audit logs and `approvedBy` metadata
  - Course packaging logic (7.6) and UI/CLI to assemble and publish packages
  - Integration tests connecting Phase 6 approved syllabus → Phase 7 generators

This summary reflects the Phase 7 contract-focused deliverables: schema, prompt contracts, generator contracts, and test harnesses. Implementation of persistent storage and publishing is intentionally deferred until approval workflow and auditability are finalized.

🔷 Where You Are Now (State Check)

You currently have:

✅ Approved syllabus (Phase 6)
✅ Lesson / Quiz / Project generators with strict schemas (7.1–7.4)
✅ Approval workflow with immutability + audit (7.5)

What you do NOT have yet (by design):

- No packaging
- No publishing
- No learner-facing output
- No persistence coupling

This is correct.

🔶 What Comes Next (High-Level Roadmap)
Phase	Purpose
7.6	Course Packaging (assemble approved content)
8.0	Persistence + Versioning
8.1	Publish API (read-only, immutable)
8.2	Regeneration + diffing
9.0	Delivery (UI, LMS, exports)

We now proceed one irreversible phase at a time.

🟣 Phase 7.6 — Course Packaging (NEXT)
🎯 Objective

Create a publishable course package that:

- Pulls only APPROVED content

- Freezes versions

- Is deterministic

- Is schema-validated

- Is immutable once built

No AI here. No generation. Only assembly.

🧱 Conceptual Model
Approved Syllabus
 + Approved Lessons
 + Approved Quizzes
 + Approved Projects
 --------------------------------
 → CoursePackage (versioned, frozen)



