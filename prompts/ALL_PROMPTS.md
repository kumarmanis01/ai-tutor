# Consolidated AI Prompt Templates

This file collects the primary prompt templates used to generate AI content in the repo. Use this to review and refine prompts.

---

## 1) lib/content/lesson/prompt.ts
Path: lib/content/lesson/prompt.ts

```text
You are generating structured course lessons.

Rules:
- Output ONLY valid JSON
- Match the provided schema exactly
- Do not add extra fields
- Depth must match professional education quality

Input:
${JSON.stringify(input, null, 2)}

Return an array of Lesson objects.
```

---

## 2) prompts/syllabus_worker_prompt.md
Path: prompts/syllabus_worker_prompt.md

```text
You are an expert curriculum designer.

Generate an academic syllabus strictly aligned to:
Board: {{board}}
Grade: {{grade}}
Subject: {{subject}}
Language: {{language}}

Rules:
- Output JSON ONLY
- No explanations
- Chapters must be ordered
- Topics must be ordered
- Topics must be concise, age-appropriate, and non-overlapping
- Do NOT include assessments or activities
- Do NOT include subtopics
- Do NOT invent extra subjects

JSON Schema:
{
  "chapters": [
    {
      "title": "string",
      "order": number,
      "topics": [
        { "title": "string", "order": number }
      ]
    }
  ]
}

Version: 1.0
```

---

## 3) worker/services/syllabusWorker.ts
Path: worker/services/syllabusWorker.ts

```text
You are an expert curriculum designer.

Generate an academic syllabus strictly aligned to:
Board: ${board}
Grade: ${grade}
Subject: ${subjectName}
Language: ${language}

Rules:
- Output JSON ONLY
- No explanations
- Chapters must be ordered
- Topics must be ordered
- Topics must be concise, age-appropriate, and non-overlapping
- Do NOT include assessments or activities
- Do NOT include subtopics
- Do NOT invent extra subjects

JSON Schema:
{
  "chapters": [
    {
      "title": "string",
      "order": number,
      "topics": [
        { "title": "string", "order": number }
      ]
    }
  ]
}
```

---

## 4) worker/services/notesWorker.ts
Path: worker/services/notesWorker.ts

```text
You are an expert ${board} educator creating study material for Class ${grade} students.

Create comprehensive, engaging study notes for:
Topic: ${topic.name}
Subject: ${subjectName}
Board: ${board}
Grade: ${grade}
Language: ${language}

AUDIENCE: ${grade}th grade students (age ~${studentAge} years)

REQUIREMENTS:
- Use simple, age-appropriate language
- Include relatable real-world examples
- Make abstract concepts concrete
- Anticipate common student confusions
- Align strictly to ${board} curriculum standards

OUTPUT: JSON ONLY (no markdown, no explanations outside JSON)

JSON Schema:
{ ... large schema including title, content.introduction, learningObjectives, sections, keyTerms, realWorldExamples, practiceQuestions, commonMistakes, summary, funFact, relatedTopics, studyTips }

QUALITY GUIDELINES:
- Sections: 2-4 sections covering the topic comprehensively
- Key Terms: 3-8 essential vocabulary words
- Practice Questions: 3-5 questions across difficulty levels
- Real World Examples: 2-3 relatable scenarios
- Common Mistakes: 2-3 typical student errors
```

---

## 5) worker/services/questionsWorker.ts
Path: worker/services/questionsWorker.ts

Representative per-difficulty prompt (constructed inside `generateQuestionsForDifficulty`):

```text
You are an expert educator and assessment designer.

Generate 5 ${difficulty.toUpperCase()} level questions for students on:
Topic: ${topic.name}
Board: ${board}
Grade: ${grade}
Subject: ${subjectName}
Language: ${language}

Difficulty Description: ${difficultyDescriptions[difficulty]}

Rules:
- Output JSON ONLY
- No explanations outside the JSON
- Questions should be age-appropriate and curriculum-aligned
- Include a mix of MCQ and short answer questions
- Provide correct answers for each question
- For ${difficulty} level: ${difficultyDescriptions[difficulty]}

JSON Schema:
{
  "questions": [
    {
      "type": "mcq" | "short_answer",
      "question": "string",
      "options": ["string"] (for MCQ only, 4 options),
      "answer": "string",
      "explanation": "string"
    }
  ]
}
```

---

## Notes & Next Steps
- These are the main prompt sources for syllabus, notes, lessons, and questions.
- If you want, I can:
  - Extract exact prompt strings into separate numbered files for editing.
  - Create a PR that centralizes and documents each prompt with versioning and test cases.
  - Run a quick lint to identify any dynamic values not safely escaped.

Tell me which next step you prefer (extract, centralize into src/prompts, or open a PR with edits).