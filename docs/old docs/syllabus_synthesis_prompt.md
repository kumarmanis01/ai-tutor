## Syllabus Synthesis Prompt Template

Context:
- Board: {boardName}
- Class / Grade: {grade}
- Subject: {subjectName}
- Language: {language}

Instructions for the LLM:
1. Produce a structured syllabus for the subject suitable for the given class/grade.
2. Return JSON only, with an array `chapters`.
3. Each chapter must have: `title`, `slug` (url-safe), `order` (1-based), and `topics` (array of topic objects).
4. Each topic object must have: `title`, `slug`, and `order`.
5. Keep output focused and concise. Provide 3-12 chapters, 3-8 topics per chapter depending on grade.
6. Do not include any HTML or markdown — JSON only.

Example output schema:

{
  "chapters": [
    {
      "title": "Number Systems",
      "slug": "number-systems",
      "order": 1,
      "topics": [
        { "title": "Place Value", "slug": "place-value", "order": 1 },
        { "title": "Comparing Numbers", "slug": "comparing-numbers", "order": 2 }
      ]
    }
  ]
}

Safety / Guardrails:
- Always create chapters/topics in `draft` status.
- Do not make assumptions about existing topics; return the canonical syllabus only.
- Keep language neutral and curriculum-focused.

Failure modes:
- If the LLM cannot produce JSON, return an error object with `error` and `message` fields.
