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
