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
  /** Board (e.g. CBSE). Optional context. */
  board?: string
  /** Subject name. Optional context. */
  subject?: string
  /** Difficulty level for this batch. When set, all questions must be this level. */
  difficulty?: 'easy' | 'medium' | 'hard'
  /** Human-readable description of the difficulty level. */
  difficultyDescription?: string
}

export function topicQuestionsPrompt(params: TopicQuestionsParams): string {
  const lang = params.language === 'hi' ? 'Hindi' : 'English'
  const contextParts: string[] = []
  if (params.board) contextParts.push(`Board: ${params.board}`)
  if (params.subject) contextParts.push(`Subject: ${params.subject}`)
  const contextLine = contextParts.length > 0 ? `\n${contextParts.join('\n')}` : ''

  const difficultyLine =
    params.difficulty && params.difficultyDescription
      ? `\nDifficulty: ${params.difficulty} — ${params.difficultyDescription}. All ${params.count} questions MUST be ${params.difficulty} level.`
      : ''

  return `Role: educational question writer for grade ${params.grade}.

Task: Generate exactly ${params.count} multiple-choice questions for topic "${params.topicName}" in ${lang}.${contextLine}${difficultyLine}

STRICT RULES:
1. Return ONLY valid JSON. No markdown, no backticks, no commentary.
2. "options" MUST be an array of exactly 4 strings.
3. "correctAnswer" MUST be exactly one of the strings in "options".
4. "difficulty" MUST be one of: "easy", "medium", "hard".
5. "explanation" MUST be a concise reason (<=80 words) why the answer is correct.
6. Each question must be clear, unambiguous, and age-appropriate.
7. Distractors must be plausible and distinct; tie at least one to a common mistake.

Required JSON format:
{
  "questions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "string",
      "difficulty": "easy"
    }
  ]
}

Example (grade 8 Science):
{
  "questions": [
    {
      "question": "What is the SI unit of force?",
      "options": ["Newton", "Joule", "Watt", "Pascal"],
      "correctAnswer": "Newton",
      "explanation": "Force is measured in Newtons (N), named after Sir Isaac Newton.",
      "difficulty": "easy"
    }
  ]
}

Return ONLY the JSON object above with exactly ${params.count} questions. No other text.`
}
