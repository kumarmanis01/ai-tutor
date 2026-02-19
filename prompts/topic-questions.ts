/**
 * FILE OBJECTIVE:
 * - Template generator for multiple-choice question prompts (grades 6-12).
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/topic-questions.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export type TopicQuestionsParams = {
  topicName: string
  grade: number // 6-12
  count: number // exact number of questions required
  language?: 'en' | 'hi'
}

export function topicQuestionsPrompt(params: TopicQuestionsParams): string {
  return `Role: educational question writer for grade ${params.grade}.

Task: Generate exactly ${params.count} multiple-choice questions for topic "${params.topicName}" in ${params.language === 'hi' ? 'Hindi' : 'English'}.

Constraints:
- Produce exactly ${params.count} questions (no extras).
- Each item: clear, unambiguous, age-appropriate; avoid trick wording.
- Options: exactly 4 strings per question.
- 'correctOptionIndex': integer 0-3 pointing to the correct option.
- 'difficulty': "easy" | "medium" | "hard".
- 'explanation': concise (<=80 words). 'solutionSteps': 1-6 ordered steps, each <=30 words.
- Distractors: plausible and distinct; tie at least one distractor to a common mistake. Do NOT randomize ordering.

Output JSON Schema (RETURN ONLY valid JSON array with exactly ${params.count} entries):
[
  {
    "question": string,
    "options": [string,string,string,string],
    "correctOptionIndex": number,
    "difficulty": "easy" | "medium" | "hard",
    "explanation": string,
    "solutionSteps": [string]
  }
]

Validation Constraints:
- Return ONLY the JSON array described above. No markdown, no commentary, no extra fields.
- Respect field sizes and counts strictly. Use plain text only.
-- If unable to generate valid output, return '[]' (empty array).

Strict Output Instruction: Return ONLY valid JSON that exactly matches the schema above, nothing else.`
}
