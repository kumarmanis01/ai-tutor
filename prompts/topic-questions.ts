/**
 * FILE OBJECTIVE:
 * - Template generator for multiple-choice question prompts (grades 6-12).
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/topic-questions-grammar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 * - 2026-05-19T00:00:00Z | claude        | feat: languageMeta routing to dedicated
 *     languageQuestionsPrompt; grammar question types + mandatory distribution;
 *     MCQ answer field aligned to use "answer" not "correctAnswer"
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
  /** Official NCERT chapter text from CurriculumChunk. When present questions must
   *  test ONLY concepts explicitly stated in this content. */
  ncertContext?: string
  /** Populated for language subjects. Switches the output schema to
   *  LanguageQuestionsSchema with both comprehensionQuestions and grammarQuestions. */
  languageMeta?: {
    language: string
    topicCategory: string
    grammarDomain?: string
    grammarLabel?: string
    examPatterns?: string[]
    board?: string
  }
}

export function topicQuestionsPrompt(params: TopicQuestionsParams): string {
  if (params.languageMeta) {
    return languageQuestionsPrompt(params)
  }
  return stemQuestionsPrompt(params)
}

function stemQuestionsPrompt(params: TopicQuestionsParams): string {
  const lang = params.language === 'hi' ? 'Hindi' : 'English'
  const contextParts: string[] = []
  if (params.board) contextParts.push(`Board: ${params.board}`)
  if (params.subject) contextParts.push(`Subject: ${params.subject}`)
  const contextLine = contextParts.length > 0 ? `\n${contextParts.join('\n')}` : ''

  const difficultyLine =
    params.difficulty && params.difficultyDescription
      ? `\nDifficulty: ${params.difficulty} -- ${params.difficultyDescription}. All ${params.count} questions MUST be ${params.difficulty} level.`
      : ''

  const ncertSection = params.ncertContext
    ? `Official NCERT Textbook Content (generate questions based ONLY on concepts explicitly stated here):\n---\n${params.ncertContext}\n---\n\n`
    : ''

  return `${ncertSection}Role: educational question writer for grade ${params.grade}.

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

function languageQuestionsPrompt(params: TopicQuestionsParams): string {
  const { languageMeta, topicName, grade, count, board, difficulty, ncertContext } = params
  if (!languageMeta) return stemQuestionsPrompt(params)

  const {
    language,
    topicCategory,
    grammarDomain,
    grammarLabel,
    examPatterns,
  } = languageMeta

  const boardName = board || languageMeta.board || 'CBSE'
  const difficultyLine = difficulty ? `\nTarget difficulty: ${difficulty}.` : ''
  const ncertSection = ncertContext
    ? `Chapter/passage content for grounding questions:\n---\n${ncertContext}\n---\n\n`
    : ''

  const grammarDomainLine = grammarLabel
    ? `Grammar domain: ${grammarLabel}${grammarDomain ? ` (${grammarDomain})` : ''}`
    : 'Grammar domain: infer from topic and chapter content.'

  const examPatternLine = examPatterns && examPatterns.length > 0
    ? `Typical ${boardName} exam patterns for this domain: ${examPatterns.join('; ')}.`
    : ''

  // Grammar questions always take priority; ensure the mandatory distribution floor (5) is met.
  // Comprehension questions are the remainder only after grammar is guaranteed.
  const MIN_GRAMMAR_QUESTIONS = 5
  const isGrammarPrimary = topicCategory === 'grammar'
  const contentQCount = isGrammarPrimary
    ? 0
    : Math.max(0, Math.min(Math.floor(count * 0.4), count - MIN_GRAMMAR_QUESTIONS))
  const grammarQCount = count - contentQCount

  return `${ncertSection}You are an expert ${language} language question writer for grade ${grade} (${boardName} board).

Topic: "${topicName}"
${grammarDomainLine}
${examPatternLine}
Topic category: ${topicCategory}${difficultyLine}

TASK:
Generate a question set for this language topic with TWO sections:
${contentQCount > 0 ? `(A) comprehensionQuestions -- ${contentQCount} questions on the prose/poetry/composition content.` : ''}
(B) grammarQuestions -- ${grammarQCount} questions testing the grammar domain.

GRAMMAR QUESTION TYPES -- use a mix of:
- "identify": "Identify the tense/voice/case in the following sentence: ..."
- "transform": "Change to passive voice / indirect speech / another tense: ..."
- "fill_in_blanks": fill a blank with the grammatically correct form (rule-based distractors)
- "error_correction": spot and fix the grammatical error in the sentence
- "match_the_column": match words/phrases to their grammatical category
- "rewrite_as_directed": CBSE/ICSE favourite -- "Rewrite using 'although' / in passive voice / ..."
- "sentence_formation": construct a sentence using a given grammar construct
- "chapter_context": grammar applied directly to a sentence from the chapter/topic text

MANDATORY grammar question distribution:
- At least 2 of type "identify" or "transform"
- At least 1 of type "error_correction"
- At least 1 of type "rewrite_as_directed"
- At least 1 of type "chapter_context" (MUST use a sentence from the chapter/topic)

STRICT RULES:
1. Return ONLY valid JSON. No markdown, no backticks, no commentary.
2. Each grammarQuestion MUST have: question, type, grammarDomain, answer, explanation, chapterLinked, markingHint.
3. "chapterLinked": true only when the question uses a sentence extracted from the chapter text.
4. "markingHint": what the board examiner looks for (concise, 1-2 sentences).
5. "explanation": why the answer is correct, minimum 20 words.
6. MCQ-type questions (identify, fill_in_blanks) MUST include "options" (4 strings); "answer" must be exactly one of the option strings.
7. Non-MCQ questions (transform, error_correction, rewrite_as_directed, sentence_formation, chapter_context) should NOT have options -- "answer" is the full corrected/transformed string.
8. "difficulty" MUST be "easy", "medium", or "hard".
9. Distractors must reflect genuine common student errors, not random wrong answers.

Required JSON format:
{
  ${contentQCount > 0 ? `"comprehensionQuestions": [
    {
      "question": "string",
      "type": "short_answer | mcq | fill_blank",
      "options": ["A", "B", "C", "D"] | undefined,
      "answer": "string",
      "explanation": "string",
      "difficulty": "easy | medium | hard"
    }
  ],` : ''}
  "grammarQuestions": [
    {
      "question": "string",
      "type": "identify | transform | fill_in_blanks | error_correction | match_the_column | rewrite_as_directed | sentence_formation | chapter_context",
      "grammarDomain": "string (e.g. active_passive_voice)",
      "options": ["A", "B", "C", "D"] | undefined,
      "answer": "string",
      "explanation": "string (min 20 words)",
      "chapterLinked": true | false,
      "markingHint": "string",
      "difficulty": "easy | medium | hard"
    }
  ]
}

Return ONLY the JSON object above. No other text.`
}
