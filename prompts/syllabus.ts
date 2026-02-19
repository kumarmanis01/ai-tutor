/**
 * FILE OBJECTIVE:
 * - Prompt template to generate a deterministic syllabus (ordered chapters and topics).
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/syllabus.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export type SyllabusParams = {
  board: string
  grade: number
  subject: string
  language?: 'en' | 'hi'
  maxChapters?: number
}

export function syllabusPrompt(params: SyllabusParams): string {
  const maxChapters = params.maxChapters ?? 12
  return `Role: curriculum generator for board ${params.board}, grade ${params.grade}.

Task: Produce an ordered syllabus for subject "${params.subject}" in ${params.language === 'hi' ? 'Hindi' : 'English'}.

Constraints:
- Chapters: 1..${maxChapters}, ordered by ` + "`order`" + ` ascending.
- Each chapter: title (<=8 words), order (integer), topics array.
- Each topic: title (<=6 words), order (integer). Topics must be concise and non-overlapping.
- Do NOT include assessments, activities, subtopics, or external references.
- Language: produce text in requested language only.

Output JSON Schema (RETURN ONLY valid JSON):
{
  "chapters": [
    {
      "title": string,
      "order": number,
      "topics": [ { "title": string, "order": number } ]
    }
  ]
}

Validation Constraints:
- Return EXACTLY the JSON object matching the schema above. No markdown, no commentary, no extra fields.
- Chapter and topic orders must be sequential starting at 1.
// If unable to produce, return the empty-syllabus object as a JSON string.
- If unable to produce, return '{ "chapters": [] }'.

Strict Output Instruction: Return ONLY valid JSON matching the schema above, nothing else.`
}
