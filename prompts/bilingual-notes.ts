/**
 * FILE OBJECTIVE:
 * - Bilingual notes prompt template producing separate English and Hindi objects.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/bilingual-notes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export type BilingualNotesParams = {
  topicName: string
  grade: number
  maxWords?: number
}

export function bilingualNotesPrompt(params: BilingualNotesParams): string {
  const maxWords = params.maxWords ?? 400
  return `Role: bilingual educational content generator for grade ${params.grade}.

Task: Produce study notes for "${params.topicName}" as two separate language objects: "en" and "hi". Each object must independently conform to the notes schema.

Constraints:
- Top-level keys: exactly "en" and "hi".
- Do NOT mix languages in the same paragraph.
- Hindi: use natural, conversational Hindi suitable for middle/high school (avoid heavy Sanskrit).
- Word limits per language object: <= ${maxWords} words.
- No markdown, commentary, extra fields, or cross-language merging.

Notes Schema (for each "en" and "hi"):
{
  "title": string,
  "concept": string,
  "explanation": string,
  "example": string,
  "keyPoints": [string,string,string],
  "commonMistakes": [string]
}

Validation Constraints:
- Return ONLY a single JSON object with exactly two keys: "en" and "hi".
- Each language value must match the notes schema above and respect word limits.
- If unable to produce valid content for a language, set that language value to `{}`.

Strict Output Instruction: Return ONLY valid JSON with top-level keys "en" and "hi" matching the schema; nothing else.`
}
