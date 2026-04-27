/**
 * FILE OBJECTIVE:
 * - Prompt template to generate detailed chapter list (title, order, short summary, topics).
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/chapters.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export type ChaptersParams = {
  subject: string
  grade: number
  chapterCount: number
  language?: 'en' | 'hi'
}

export function chaptersPrompt(params: ChaptersParams): string {
  return `Role: chapter planner for subject "${params.subject}" grade ${params.grade}.

Task: Generate exactly ${params.chapterCount} chapters. For each chapter provide title, order (1..${params.chapterCount}), a one-sentence summary (<=20 words), and an ordered list of concise topics (each <=6 words).

Constraints:
- Produce exactly ${params.chapterCount} chapters; do not add extras.
- Titles: <=8 words. Summaries: <=20 words.
- Topics per chapter: 3-8 items, each with title and order starting at 1.
- Language: ${params.language === 'hi' ? 'Hindi' : 'English'} only.
- No assessments, no activities, no external references.

Output JSON Schema (RETURN ONLY valid JSON array):
[
  {
    "title": string,
    "order": number,
    "summary": string,
    "topics": [ { "title": string, "order": number } ]
  }
]

Validation Constraints:
- Return ONLY a JSON array with exactly ${params.chapterCount} chapter objects.
- Orders must be sequential and start at 1.
- If unable to produce, return an empty array '[]'.

Strict Output Instruction: Return ONLY valid JSON that exactly matches the schema above.`
}
