/**
 * FILE OBJECTIVE:
 * - Define diagnostic onboarding schemas.
 * - Adaptive question flow for cold start.
 * - Scoring rules for difficulty/confidence baseline.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/diagnostic/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created diagnostic schemas
 */

import { z } from 'zod';

// ============================================================================
// DIAGNOSTIC QUESTION TYPES
// ============================================================================

/**
 * Difficulty level for diagnostic questions.
 */
export enum DiagnosticDifficulty {
  /** Grade-2 level equivalent */
  FOUNDATION = 'FOUNDATION',
  /** Grade-appropriate basic */
  BASIC = 'BASIC',
  /** Grade-appropriate medium */
  INTERMEDIATE = 'INTERMEDIATE',
  /** Grade-appropriate advanced */
  ADVANCED = 'ADVANCED',
  /** Above grade level */
  CHALLENGE = 'CHALLENGE',
}

/**
 * Question type in diagnostic.
 */
export enum DiagnosticQuestionType {
  /** Multiple choice (4 options) */
  MCQ = 'MCQ',
  /** True/False */
  TRUE_FALSE = 'TRUE_FALSE',
  /** Fill in the blank */
  FILL_BLANK = 'FILL_BLANK',
  /** Short numeric answer */
  NUMERIC = 'NUMERIC',
}

/**
 * Cognitive skill being assessed.
 */
export enum CognitiveSkill {
  /** Basic recall */
  RECALL = 'RECALL',
  /** Understanding concepts */
  COMPREHENSION = 'COMPREHENSION',
  /** Applying knowledge */
  APPLICATION = 'APPLICATION',
  /** Analyzing information */
  ANALYSIS = 'ANALYSIS',
}

// ============================================================================
// QUESTION SCHEMA
// ============================================================================

/**
 * A single diagnostic question.
 */
export const DiagnosticQuestionSchema = z.object({
  /** Unique question ID */
  id: z.string(),
  
  /** Subject area */
  subject: z.string(),
  
  /** Topic within subject */
  topic: z.string(),
  
  /** Question difficulty */
  difficulty: z.nativeEnum(DiagnosticDifficulty),
  
  /** Question type */
  type: z.nativeEnum(DiagnosticQuestionType),
  
  /** Cognitive skill assessed */
  skill: z.nativeEnum(CognitiveSkill),
  
  /** The question text (NO test-like language) */
  questionText: z.string().min(10).max(500),
  
  /** Options for MCQ/TRUE_FALSE */
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCorrect: z.boolean(),
  })).optional(),
  
  /** Correct answer for FILL_BLANK/NUMERIC */
  correctAnswer: z.string().optional(),
  
  /** Acceptable variations of answer */
  acceptableAnswers: z.array(z.string()).optional(),
  
  /** Hint text (friendly, not giving away) */
  hintText: z.string().max(200).optional(),
  
  /** Expected time in seconds */
  expectedTimeSeconds: z.number().int().min(10).max(180),
  
  /** Curriculum alignment (optional) */
  curriculumRef: z.string().optional(),
});

export type DiagnosticQuestion = z.infer<typeof DiagnosticQuestionSchema>;

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

/**
 * Student's response to a diagnostic question.
 */
export const DiagnosticResponseSchema = z.object({
  /** Question ID */
  questionId: z.string(),
  
  /** Selected option ID (for MCQ/TRUE_FALSE) */
  selectedOptionId: z.string().optional(),
  
  /** Text answer (for FILL_BLANK/NUMERIC) */
  textAnswer: z.string().optional(),
  
  /** Time taken in seconds */
  timeTakenSeconds: z.number().int().min(0),
  
  /** Was a hint requested? */
  hintRequested: z.boolean(),
  
  /** Did student skip? */
  skipped: z.boolean(),
  
  /** Timestamp */
  answeredAt: z.string().datetime(),
});

export type DiagnosticResponse = z.infer<typeof DiagnosticResponseSchema>;

// ============================================================================
// DIAGNOSTIC SESSION SCHEMA
// ============================================================================

/**
 * Complete diagnostic session.
 */
export const DiagnosticSessionSchema = z.object({
  /** Session ID */
  sessionId: z.string(),
  
  /** Student grade */
  grade: z.number().int().min(1).max(12),
  
  /** Subject being diagnosed */
  subject: z.string(),
  
  /** Board (for curriculum alignment) */
  board: z.string().optional(),
  
  /** Questions asked */
  questions: z.array(DiagnosticQuestionSchema),
  
  /** Responses received */
  responses: z.array(DiagnosticResponseSchema),
  
  /** Session started at */
  startedAt: z.string().datetime(),
  
  /** Session completed at */
  completedAt: z.string().datetime().optional(),
  
  /** Was session terminated early? */
  terminatedEarly: z.boolean(),
  
  /** Reason for early termination */
  terminationReason: z.enum([
    'CONFIDENCE_CLEAR',
    'STUDENT_SKIPPED',
    'TIME_LIMIT',
    'STUDENT_EXIT',
  ]).optional(),
});

export type DiagnosticSession = z.infer<typeof DiagnosticSessionSchema>;

// ============================================================================
// DIAGNOSTIC OUTPUT SCHEMA
// ============================================================================

/**
 * Output from diagnostic analysis.
 */
export const DiagnosticOutputSchema = z.object({
  /** Session ID */
  sessionId: z.string(),
  
  /** Recommended starting difficulty */
  recommendedDifficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  
  /** Confidence in recommendation (0-1) */
  recommendationConfidence: z.number().min(0).max(1),
  
  /** Student's baseline confidence score (0-1) */
  baselineConfidence: z.number().min(0).max(1),
  
  /** Skill breakdown */
  skillBreakdown: z.object({
    recall: z.number().min(0).max(1),
    comprehension: z.number().min(0).max(1),
    application: z.number().min(0).max(1),
    analysis: z.number().min(0).max(1),
  }),
  
  /** Topic-specific scores */
  topicScores: z.array(z.object({
    topic: z.string(),
    score: z.number().min(0).max(1),
    questionsAnswered: z.number().int(),
  })),
  
  /** Identified knowledge gaps (if any) */
  knowledgeGaps: z.array(z.string()),
  
  /** Identified strengths */
  strengths: z.array(z.string()),
  
  /** Personalized message for student (encouraging!) */
  studentMessage: z.string().max(300),
  
  /** Metadata */
  metadata: z.object({
    totalQuestions: z.number().int(),
    correctAnswers: z.number().int(),
    averageTimeSeconds: z.number(),
    hintsUsed: z.number().int(),
    diagnosticDuration: z.number().int(), // seconds
  }),
});

export type DiagnosticOutput = z.infer<typeof DiagnosticOutputSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Diagnostic configuration by grade band.
 */
export interface DiagnosticConfig {
  /** Grades in this band */
  grades: number[];
  /** Minimum questions */
  minQuestions: number;
  /** Maximum questions */
  maxQuestions: number;
  /** Starting difficulty */
  startDifficulty: DiagnosticDifficulty;
  /** Time limit per question (seconds) */
  timeLimitSeconds: number;
  /** Allow skipping? */
  allowSkip: boolean;
  /** UI style */
  uiStyle: 'playful' | 'friendly' | 'focused';
  /** Framing text (NO "test" language!) */
  framingText: string;
}

export const DIAGNOSTIC_CONFIG: Record<string, DiagnosticConfig> = {
  junior: {
    grades: [1, 2, 3],
    minQuestions: 5,
    maxQuestions: 5, // Keep it short
    startDifficulty: DiagnosticDifficulty.FOUNDATION,
    timeLimitSeconds: 60,
    allowSkip: true, // No pressure
    uiStyle: 'playful',
    framingText: "Let's play a quick game! Answer a few fun questions so I can help you better! 🎮",
  },
  middle: {
    grades: [4, 5, 6, 7],
    minQuestions: 5,
    maxQuestions: 7,
    startDifficulty: DiagnosticDifficulty.BASIC,
    timeLimitSeconds: 90,
    allowSkip: true,
    uiStyle: 'friendly',
    framingText: "Let me ask you a few quick questions to understand what you already know. This helps me teach you better!",
  },
  senior: {
    grades: [8, 9, 10, 11, 12],
    minQuestions: 5,
    maxQuestions: 7,
    startDifficulty: DiagnosticDifficulty.INTERMEDIATE,
    timeLimitSeconds: 120,
    allowSkip: true,
    uiStyle: 'focused',
    framingText: "I'll ask a few questions to understand your current level. This helps personalize your learning experience.",
  },
};

/**
 * Get diagnostic config for a grade.
 */
export function getDiagnosticConfig(grade: number): DiagnosticConfig {
  if (grade <= 3) return DIAGNOSTIC_CONFIG.junior;
  if (grade <= 7) return DIAGNOSTIC_CONFIG.middle;
  return DIAGNOSTIC_CONFIG.senior;
}
