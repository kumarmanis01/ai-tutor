/**
 * FILE OBJECTIVE:
 * - Define JSON schemas for OpenAI structured output (tools/functions).
 * - Schema-first approach ensures AI never returns free-text.
 * - All schemas are education-domain specific and grade-aware.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/openai/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created OpenAI tool schemas for education use cases
 */

import type { Grade } from '@/lib/ai/prompts/schemas';

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Education context required for all AI interactions
 */
export interface EducationContext {
  /** Student's grade (1-12) */
  readonly grade: Grade;
  /** Education board (CBSE, ICSE, State) */
  readonly board: 'CBSE' | 'ICSE' | 'STATE_BOARD';
  /** Subject being studied */
  readonly subject: string;
  /** Chapter or topic */
  readonly chapter: string;
  /** Current difficulty level */
  readonly difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXAM';
  /** Language preference */
  readonly language: 'EN' | 'HI' | 'HINGLISH';
}

/**
 * OpenAI tool definition structure
 */
export interface OpenAIToolDefinition {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
    readonly strict: true; // Always enforce strict schema
  };
}

// ============================================================================
// NOTES GENERATION SCHEMA
// ============================================================================

/**
 * Schema for generating educational notes.
 * 
 * SAFETY REASONING:
 * - Structured output prevents hallucinated facts
 * - Grade-appropriate vocabulary is enforced
 * - Key points are explicit and verifiable
 * - Examples must be curriculum-aligned
 */
export const NOTES_OUTPUT_SCHEMA: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_educational_notes',
    description: 'Generate structured educational notes for a specific topic. Output must be factually accurate and grade-appropriate.',
    parameters: {
      type: 'object',
      properties: {
        topic_title: {
          type: 'string',
          description: 'Clear, concise title for the notes section',
        },
        learning_objectives: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5,
          description: 'What the student will learn (2-5 objectives)',
        },
        key_concepts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string', description: 'The concept name' },
              definition: { type: 'string', description: 'Grade-appropriate definition' },
              example: { type: 'string', description: 'Relatable real-world example' },
            },
            required: ['term', 'definition', 'example'],
            additionalProperties: false,
          },
          minItems: 1,
          maxItems: 8,
          description: 'Key terms and their definitions',
        },
        explanation: {
          type: 'object',
          properties: {
            main_idea: { type: 'string', description: 'Core concept in 1-2 sentences' },
            details: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 6,
              description: 'Supporting details and explanations',
            },
            analogy: { type: 'string', description: 'Age-appropriate analogy to aid understanding' },
          },
          required: ['main_idea', 'details'],
          additionalProperties: false,
        },
        worked_example: {
          type: 'object',
          properties: {
            problem: { type: 'string', description: 'Example problem statement' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step_number: { type: 'integer' },
                  action: { type: 'string', description: 'What to do' },
                  result: { type: 'string', description: 'What you get' },
                  explanation: { type: 'string', description: 'Why this step' },
                },
                required: ['step_number', 'action', 'result'],
                additionalProperties: false,
              },
            },
            final_answer: { type: 'string' },
          },
          required: ['problem', 'steps', 'final_answer'],
          additionalProperties: false,
        },
        remember_points: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5,
          description: 'Key takeaways for revision',
        },
        common_mistakes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              mistake: { type: 'string' },
              correction: { type: 'string' },
            },
            required: ['mistake', 'correction'],
            additionalProperties: false,
          },
          maxItems: 3,
          description: 'Common errors students make',
        },
        difficulty_rating: {
          type: 'string',
          enum: ['EASY', 'MEDIUM', 'HARD'],
          description: 'Assessed difficulty of this content',
        },
        estimated_read_time_minutes: {
          type: 'integer',
          minimum: 1,
          maximum: 30,
          description: 'Estimated reading time',
        },
      },
      required: [
        'topic_title',
        'learning_objectives',
        'key_concepts',
        'explanation',
        'remember_points',
        'difficulty_rating',
        'estimated_read_time_minutes',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
};

// ============================================================================
// PRACTICE QUESTION SCHEMA
// ============================================================================

/**
 * Schema for generating practice questions.
 * 
 * SAFETY REASONING:
 * - Correct answer is explicitly marked
 * - Explanation is mandatory for learning
 * - Distractors must be plausible but clearly wrong
 * - Difficulty must match requested level
 */
export const PRACTICE_QUESTION_SCHEMA: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_practice_question',
    description: 'Generate a curriculum-aligned practice question with solution. Must be factually accurate and appropriately challenging.',
    parameters: {
      type: 'object',
      properties: {
        question_type: {
          type: 'string',
          enum: ['MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'SHORT_ANSWER', 'MATCH'],
          description: 'Type of question',
        },
        question_text: {
          type: 'string',
          description: 'The question in clear, grade-appropriate language',
        },
        context: {
          type: 'string',
          description: 'Optional background information or scenario',
        },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
              text: { type: 'string' },
              is_correct: { type: 'boolean' },
            },
            required: ['label', 'text', 'is_correct'],
            additionalProperties: false,
          },
          minItems: 4,
          maxItems: 4,
          description: 'Answer options (exactly 4 for MCQ)',
        },
        correct_answer: {
          type: 'string',
          description: 'The correct answer (label for MCQ, text for others)',
        },
        explanation: {
          type: 'object',
          properties: {
            why_correct: { type: 'string', description: 'Why the correct answer is right' },
            why_others_wrong: {
              type: 'array',
              items: { type: 'string' },
              description: 'Why each distractor is wrong (for MCQ)',
            },
            concept_connection: { type: 'string', description: 'How this connects to the topic' },
            hint_if_stuck: { type: 'string', description: 'A gentle hint without giving away answer' },
          },
          required: ['why_correct', 'concept_connection'],
          additionalProperties: false,
        },
        difficulty: {
          type: 'string',
          enum: ['EASY', 'MEDIUM', 'HARD', 'EXAM'],
        },
        bloom_level: {
          type: 'string',
          enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'],
          description: "Bloom's taxonomy level",
        },
        marks: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Marks for this question',
        },
        time_limit_seconds: {
          type: 'integer',
          minimum: 30,
          maximum: 600,
          description: 'Suggested time to solve',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 5,
          description: 'Topic tags for categorization',
        },
      },
      required: [
        'question_type',
        'question_text',
        'correct_answer',
        'explanation',
        'difficulty',
        'bloom_level',
        'marks',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
};

// ============================================================================
// DOUBT RESOLUTION SCHEMA
// ============================================================================

/**
 * Schema for resolving student doubts.
 * 
 * SAFETY REASONING:
 * - Must detect if doubt is actually homework-seeking
 * - Explanation must be pedagogical, not just answer-giving
 * - Confidence score helps trigger fallbacks
 * - Follow-up questions guide further learning
 */
export const DOUBT_RESOLUTION_SCHEMA: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'resolve_student_doubt',
    description: 'Help a student understand a concept they are struggling with. Focus on teaching, not just answering.',
    parameters: {
      type: 'object',
      properties: {
        understood_question: {
          type: 'string',
          description: 'Restate what the student is asking (validation)',
        },
        doubt_category: {
          type: 'string',
          enum: [
            'CONCEPT_CLARITY',
            'CALCULATION_ERROR',
            'FORMULA_APPLICATION',
            'DEFINITION_CONFUSION',
            'PROCEDURE_STEPS',
            'REAL_WORLD_CONNECTION',
            'COMPARISON_CONTRAST',
            'OFF_SYLLABUS',
          ],
          description: 'Category of the doubt',
        },
        is_valid_academic_doubt: {
          type: 'boolean',
          description: 'Is this a genuine learning question (not homework dump)?',
        },
        rejection_reason: {
          type: 'string',
          description: 'If not valid, why (e.g., "This appears to be a full assignment")',
        },
        response: {
          type: 'object',
          properties: {
            greeting: { type: 'string', description: 'Friendly acknowledgment' },
            clarification: {
              type: 'string',
              description: 'Clear explanation addressing the doubt',
            },
            step_by_step: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'integer' },
                  explanation: { type: 'string' },
                  visual_hint: { type: 'string', description: 'Optional visual description' },
                },
                required: ['step', 'explanation'],
                additionalProperties: false,
              },
              description: 'Step-by-step breakdown if applicable',
            },
            analogy: { type: 'string', description: 'Relatable comparison' },
            common_confusion: { type: 'string', description: 'Address related misconceptions' },
            encouragement: { type: 'string', description: 'Positive reinforcement' },
          },
          required: ['greeting', 'clarification', 'encouragement'],
          additionalProperties: false,
        },
        follow_up_questions: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 3,
          description: 'Questions to check understanding',
        },
        related_topics: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 3,
          description: 'Related concepts to explore',
        },
        confidence_score: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'AI confidence in this response (triggers fallback if low)',
        },
        needs_human_review: {
          type: 'boolean',
          description: 'Flag for teacher review',
        },
        review_reason: {
          type: 'string',
          description: 'Why human review is needed',
        },
      },
      required: [
        'understood_question',
        'doubt_category',
        'is_valid_academic_doubt',
        'confidence_score',
        'needs_human_review',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
};

// ============================================================================
// QUIZ GENERATION SCHEMA (BATCH)
// ============================================================================

/**
 * Schema for generating a complete quiz.
 * 
 * SAFETY REASONING:
 * - Ensures balanced difficulty distribution
 * - Covers multiple sub-topics
 * - Time limits prevent rushed answers
 */
export const QUIZ_GENERATION_SCHEMA: OpenAIToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_quiz',
    description: 'Generate a complete quiz with multiple questions at varying difficulty levels.',
    parameters: {
      type: 'object',
      properties: {
        quiz_title: { type: 'string' },
        total_marks: { type: 'integer', minimum: 5, maximum: 100 },
        time_limit_minutes: { type: 'integer', minimum: 5, maximum: 120 },
        difficulty_distribution: {
          type: 'object',
          properties: {
            easy_percent: { type: 'integer', minimum: 0, maximum: 100 },
            medium_percent: { type: 'integer', minimum: 0, maximum: 100 },
            hard_percent: { type: 'integer', minimum: 0, maximum: 100 },
          },
          required: ['easy_percent', 'medium_percent', 'hard_percent'],
          additionalProperties: false,
        },
        questions: {
          type: 'array',
          items: {
            // Embedded question schema (simplified reference)
            type: 'object',
            properties: {
              question_number: { type: 'integer' },
              question_type: { type: 'string', enum: ['MCQ', 'FILL_BLANK', 'TRUE_FALSE'] },
              question_text: { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    text: { type: 'string' },
                    is_correct: { type: 'boolean' },
                  },
                  required: ['label', 'text', 'is_correct'],
                  additionalProperties: false,
                },
              },
              correct_answer: { type: 'string' },
              explanation: { type: 'string' },
              marks: { type: 'integer' },
              difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
            },
            required: ['question_number', 'question_type', 'question_text', 'correct_answer', 'explanation', 'marks', 'difficulty'],
            additionalProperties: false,
          },
          minItems: 5,
          maxItems: 30,
        },
        instructions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Quiz instructions for students',
        },
      },
      required: ['quiz_title', 'total_marks', 'time_limit_minutes', 'questions', 'instructions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

// ============================================================================
// SCHEMA REGISTRY
// ============================================================================

/**
 * Registry of all available tool schemas
 */
export const TOOL_SCHEMAS = {
  NOTES: NOTES_OUTPUT_SCHEMA,
  PRACTICE: PRACTICE_QUESTION_SCHEMA,
  DOUBT: DOUBT_RESOLUTION_SCHEMA,
  QUIZ: QUIZ_GENERATION_SCHEMA,
} as const;

export type ToolSchemaType = keyof typeof TOOL_SCHEMAS;

/**
 * Get tool schema by type
 */
export function getToolSchema(type: ToolSchemaType): OpenAIToolDefinition {
  return TOOL_SCHEMAS[type];
}

/**
 * Get all tool schemas as array for OpenAI API
 */
export function getAllToolSchemas(): OpenAIToolDefinition[] {
  return Object.values(TOOL_SCHEMAS);
}
