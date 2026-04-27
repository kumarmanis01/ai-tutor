Phase 7 — AI Content Generation Engine (Lessons, Quizzes, Projects)

This is a documentation-style copy (doc) of PHASE_7.md for richer long-form reading. The canonical source remains `docs/PHASE_7.md`.

---

🟦 Phase 7.2 — Lesson Generator (Controlled AI)

Goal

Generate lessons per module from an approved syllabus.

Generator Contract

File: `lib/content/lesson/generator.ts`

Signature:

```
generateLessons({
  syllabusId,
  moduleId,
  moduleTitle,
  learningObjectives,
  lessonCount
}) → Lesson[]
```

AI Prompt Rules

- Output JSON only
- One lesson per response OR batched
- No markdown
- No explanations outside JSON

Prompt Builder (file: `lib/content/lesson/prompt.ts`)

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

Generator Logic (contract only)

```
const raw = await llm.generate(prompt)
const parsed = JSON.parse(raw)
const lessons = parsed.map(validateLesson)
return lessons
```

Notes:
- This document contains the contract and prompt guidance only. Do not implement generation logic yet.

---

(End of doc copy)
