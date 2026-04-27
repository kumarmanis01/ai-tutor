/**
 * FILE OBJECTIVE:
 * - Bilingual notes prompt template producing separate English and Hindi objects.
 * - Produces classroom-quality notes in both languages with full teaching depth.
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
 * - 2026-04-01T00:00:00Z | claude        | rewrite: classroom-teacher depth,
 *     multi-example requirement, aligned with topic-notes.ts standards
 */

export type BilingualNotesParams = {
  topicName: string
  grade: number
  maxWords?: number
}

export function bilingualNotesPrompt(params: BilingualNotesParams): string {
  const maxWords = params.maxWords ?? 1200
  return `You are an experienced ${params.grade <= 8 ? 'middle school' : 'senior school'} teacher with 20 years of classroom experience in Indian schools.

Task: Write classroom-quality study notes for "${params.topicName}" for Grade ${params.grade} students, in TWO languages: English ("en") and Hindi ("hi"). Each language version must be fully self-contained and independently complete.

--- WHAT "CLASSROOM QUALITY" MEANS ---
Write as if you are standing in front of a class of Grade ${params.grade} students and teaching this topic for the first time. Your notes should:
- Open by connecting the topic to something students already know or encounter in daily life.
- Build understanding step by step: intuition first, formal definition second.
- Use analogies drawn from things Indian students of Grade ${params.grade} genuinely relate to.
- Never state a rule without explaining why the rule is true.
- Never show an answer without explaining every step that leads to it.

--- FIELD INSTRUCTIONS (apply to BOTH "en" and "hi" objects) ---

concept (2-4 sentences):
  Introduce the topic the way a teacher opens a lesson. Why does this topic matter? Where does it appear in real life? End with a one-sentence definition.

explanation (target 500-700 words, minimum 400 words):
  Teach the concept in full paragraphs (no bullet points). Must include:
  1. A relatable real-world scenario or analogy appropriate for Indian Grade ${params.grade} students.
  2. How the concept works, broken into 3-5 clear stages or sub-ideas.
  3. Any important formula, rule, or property -- stated AND explained.
  4. One brief "What if...?" extension that encourages deeper thinking.

example (2-3 fully worked examples, minimum 200 words total):
  Format each example as:
  Example 1: [problem statement]
  Step 1: [action] -- [why this step]
  Step 2: [action] -- [why this step]
  Answer: [final answer with units]

  Example 2: [harder or different-context problem]
  ...same format...

  For descriptive topics, use two detailed case studies instead (80-100 words each).

keyPoints (5-6 items):
  Complete, memorable sentences. Include the key rule/definition, any formula, exam patterns, and one practical tip.

commonMistakes (3-4 items):
  Each item: what the mistake is + why students fall into it + how to avoid it.

--- LANGUAGE CONSTRAINTS ---
- "en" object: English only. Clear, age-appropriate for Grade ${params.grade}.
- "hi" object: Natural school Hindi. Avoid heavy Sanskrit. Technical terms may appear in English with a Hindi explanation alongside. Do NOT mix Hindi and English within a single sentence except for technical terms.
- Do NOT mix languages within the same object field.
- Each language object must independently conform to the notes schema.
- Word budget per language object: under ${maxWords} words -- but do NOT cut depth to meet the limit.

Output JSON Schema (return ONLY valid JSON with exactly two top-level keys):
{
  "en": {
    "title": string,
    "concept": string,
    "explanation": string,
    "example": string,
    "keyPoints": [string, string, string, string, string],
    "commonMistakes": [string, string, string]
  },
  "hi": {
    "title": string,
    "concept": string,
    "explanation": string,
    "example": string,
    "keyPoints": [string, string, string, string, string],
    "commonMistakes": [string, string, string]
  }
}

Validation Constraints:
- Return ONLY a single JSON object with exactly two keys: "en" and "hi".
- Each language value must match the notes schema above.
- All text fields: plain text only, no HTML, no markdown markers.
- If unable to produce valid content for a language, set that language value to '{}' (an empty object).

Strict Output Instruction: Return ONLY valid JSON with top-level keys "en" and "hi" matching the schema; nothing else.`
}
