/**
 * FILE OBJECTIVE:
 * - Template generator for topic notes prompts (grades 6-12).
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/topic-notes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export type TopicNotesParams = {
  topicName: string
  grade: number // 6-12
  maxWords?: number
  language?: 'en' | 'hi' // single-language template
  /** Official NCERT chapter text from CurriculumChunk. When present the LLM must
   *  ground its output in this content and not introduce extra concepts. */
  ncertContext?: string
}

export function topicNotesPrompt(params: TopicNotesParams): string {
  const maxWords = params.maxWords ?? 400

  const ncertSection = params.ncertContext
    ? `Official NCERT Textbook Content (primary source — base all notes on this text only):\n---\n${params.ncertContext}\n---\n\n`
    : ''

  const taskLine = params.ncertContext
    ? `Task: Based ONLY on the NCERT content above, produce concise study notes for topic "${params.topicName}" in ${params.language === 'hi' ? 'Hindi' : 'English'}. Do not introduce concepts not present in the NCERT text.`
    : `Task: Produce concise, concept-first study notes for topic "${params.topicName}" in ${params.language === 'hi' ? 'Hindi' : 'English'}.`

  return `${ncertSection}Role: educational content generator for grade ${params.grade}.

${taskLine}

Constraints:
- Audience: grade ${params.grade} (6-12). Use age-appropriate vocabulary.
- Structure: concept, explanation, one worked example, keyPoints, commonMistakes.
- Word limits: title <= 10 words; concept <= 40 words; explanation <= 200 words; example <= 80 words; whole content <= ${maxWords} words.
- keyPoints: 3-6 items. commonMistakes: 0-4 items.
- Do NOT use advanced jargon; if necessary, define the term in one sentence.
- No storytelling, no motivational language, no external references.

Output JSON Schema (RETURN ONLY valid JSON matching this EXACT structure):
{
  "title": string,
  "concept": string,
  "explanation": string,
  "example": string,
  "keyPoints": [string,string,string],
  "commonMistakes": [string]
}

Validation Constraints:
- Return EXACTLY the JSON object above. Do NOT include markdown, comments, extra fields, or trailing commas.
- All text fields: plain text only, no HTML or markup.
- Arrays: JSON arrays of plain strings only; respect min/max counts.
- Be deterministic: do not randomize ordering or phrasing styles.
- Do not invent external citations or metadata.
- If unable to produce valid output, return '{}' (an empty JSON object).

Strict Output Instruction: Return ONLY valid JSON that exactly matches the schema above, nothing else.`
}
