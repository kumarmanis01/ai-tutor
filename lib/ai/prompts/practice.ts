/**
 * FILE OBJECTIVE:
 * - Practice/Questions generation prompt builder.
 * - Constructs structured prompts for generating adaptive questions.
 * - Enforces difficulty calibration and output schema.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/practice.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created practice prompt builder with schema-first approach
 */

import type {
  PracticeInputContract,
  PracticeOutputSchema,
  Difficulty,
  QuestionType,
} from './schemas';

/**
 * JSON schema definition for Practice output
 * Shared with LLM to ensure consistent structure
 */
export const PRACTICE_OUTPUT_SCHEMA = `{
  "questions": [
    {
      "id": "string - Unique identifier (use format: q1, q2, q3...)",
      "type": "mcq | short_answer | true_false | fill_blank",
      "question": "string - The question text",
      "options": ["string"] | null - Array of 4 options for MCQ, null for other types",
      "correctAnswer": "string - The correct answer (for MCQ, must match one option exactly)",
      "explanation": "string - Detailed explanation of why this is correct",
      "difficulty": "easy | medium | hard",
      "conceptTested": "string - The specific concept this question tests"
    }
  ]
}`;

/**
 * Difficulty calibration descriptions for prompt
 */
const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: `
EASY QUESTIONS:
- Definition-based, direct recall
- Single-step thinking required
- Answers can be found directly in notes
- Tests basic understanding and memory
- Example: "What is the formula for area of a circle?"`,

  medium: `
MEDIUM QUESTIONS:
- Requires reasoning and application
- Two-step thinking required
- May need to connect concepts
- Tests understanding through examples
- Example: "If a circle has radius 7cm, what is its area? Explain your calculation."`,

  hard: `
HARD QUESTIONS:
- Application in new contexts
- Multi-step problem solving
- Requires "why" understanding
- Tests deep conceptual grasp
- Example: "A circular garden has area 154 sq.m. Calculate the length of fencing needed to enclose it."`,
};

/**
 * Get question type specific guidelines
 */
function getQuestionTypeGuidelines(types: QuestionType[]): string {
  const guidelines: string[] = [];

  if (types.includes('mcq')) {
    guidelines.push(`
MCQ GUIDELINES:
- Provide exactly 4 options (A, B, C, D).
- Only ONE correct answer allowed.
- Distractors must be plausible but clearly incorrect.
- Avoid "All of the above" or "None of the above".
- Options should be roughly similar in length.`);
  }

  if (types.includes('short_answer')) {
    guidelines.push(`
SHORT ANSWER GUIDELINES:
- Question should have a specific, concise answer.
- Set options to null.
- correctAnswer should be the expected response.
- Allow for minor variations in wording in explanation.`);
  }

  if (types.includes('true_false')) {
    guidelines.push(`
TRUE/FALSE GUIDELINES:
- Statement must be clearly true or clearly false.
- Avoid tricky wording or double negatives.
- Set options to ["True", "False"].
- Explanation must clarify why the statement is true or false.`);
  }

  if (types.includes('fill_blank')) {
    guidelines.push(`
FILL IN THE BLANK GUIDELINES:
- Use _______ to indicate the blank.
- Only one blank per question.
- Set options to null.
- correctAnswer should be the exact word/phrase expected.`);
  }

  return guidelines.join('\n');
}

/**
 * Build the complete practice questions prompt
 * 
 * @param input - Practice input contract from backend
 * @returns Formatted prompt string for LLM
 */
export function buildPracticePrompt(input: PracticeInputContract): string {
  const difficultyDesc = DIFFICULTY_DESCRIPTIONS[input.difficulty];
  
  // Default to MCQ and short_answer if not specified
  const questionTypes = input.questionTypes ?? ['mcq', 'short_answer'];
  const typeGuidelines = getQuestionTypeGuidelines(questionTypes);

  // Calculate question distribution
  const typeDistribution = questionTypes.length > 1
    ? `Mix question types: approximately ${Math.ceil(input.questionCount / questionTypes.length)} of each type.`
    : `All questions should be of type: ${questionTypes[0]}.`;

  return `Create practice questions for a K–12 student preparing for their exams.

STUDENT PROFILE:
- Board: ${input.board}
- Grade: ${input.grade}
- Subject: ${input.subject}
- Chapter: ${input.chapter}
- Topic: ${input.topic}
- Language: ${input.language}

REQUIREMENTS:
- Difficulty level: ${input.difficulty.toUpperCase()}
- Total questions: ${input.questionCount}
- Question types allowed: ${questionTypes.join(', ')}
- ${typeDistribution}

${difficultyDesc}

${typeGuidelines}

QUESTION DESIGN PRINCIPLES:

1. CURRICULUM ALIGNMENT
   - Questions must be solvable with Grade ${input.grade} ${input.board} knowledge.
   - Do NOT test concepts beyond the specified topic.
   - Use terminology consistent with ${input.board} textbooks.

2. ORIGINALITY
   - Do NOT copy questions from textbooks verbatim.
   - Create original questions testing the same concepts.
   - Use fresh contexts and examples.

3. LEARNING VALUE
   - Every question should teach something when explained.
   - Explanations must help student understand, not just verify.
   - Include the "why" in explanations, not just the "what".

4. PROGRESSIVE DIFFICULTY
   - Within the ${input.difficulty} band, vary slightly.
   - First questions can be slightly easier to build confidence.
   - Last question can push the upper boundary of the difficulty.

5. INDIAN CONTEXT
   - Use Indian names, places, and contexts where appropriate.
   - Currency in INR, measurements in metric.
   - Reference familiar situations (school, home, sports).

6. CLARITY
   - Questions must be unambiguous.
   - Avoid trick questions or misleading wording.
   - For younger grades (1-5), keep language very simple.

CONCEPT COVERAGE:
- Ensure questions test different aspects of "${input.topic}".
- Do not repeat the same concept across multiple questions.
- Cover both conceptual understanding and practical application.

Return ONLY valid JSON matching this exact schema:
${PRACTICE_OUTPUT_SCHEMA}

Do NOT include any text before or after the JSON.
Do NOT wrap in markdown code blocks.
Ensure all ${input.questionCount} questions are included.`;
}

/**
 * Validate that a parsed response matches PracticeOutputSchema
 * Basic structural validation (detailed validation in validators.ts)
 */
export function isValidPracticeResponse(data: unknown): data is PracticeOutputSchema {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  if (!Array.isArray(obj.questions)) return false;
  
  // Validate each question has required fields
  return obj.questions.every((q: unknown) => {
    if (!q || typeof q !== 'object') return false;
    const question = q as Record<string, unknown>;
    
    return (
      typeof question.id === 'string' &&
      typeof question.type === 'string' &&
      typeof question.question === 'string' &&
      typeof question.correctAnswer === 'string' &&
      typeof question.explanation === 'string' &&
      typeof question.difficulty === 'string' &&
      typeof question.conceptTested === 'string'
    );
  });
}

/**
 * Generate unique question IDs for a batch
 */
export function generateQuestionIds(count: number, prefix: string = 'q'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}
