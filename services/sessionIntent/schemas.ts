/**
 * FILE OBJECTIVE:
 * - Define session intent types and schemas.
 * - Capture why a student is learning today.
 * - Session-scoped only (no persistence).
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/sessionIntent/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created session intent schemas
 */

import { z } from 'zod';

// ============================================================================
// SESSION INTENT TYPES
// ============================================================================

/**
 * Why is the student here today?
 * Determines AI prompt depth, tone, and content type.
 */
export enum SessionIntent {
  /** Learn a new concept from scratch */
  LEARN_CONCEPT = 'LEARN_CONCEPT',
  /** Practice with questions/problems */
  PRACTICE = 'PRACTICE',
  /** Revise/review previously learned material */
  REVISE = 'REVISE',
  /** Build confidence before test/exam */
  BUILD_CONFIDENCE = 'BUILD_CONFIDENCE',
  /** Focused exam preparation */
  EXAM_PREP = 'EXAM_PREP',
  /** Just exploring/browsing */
  EXPLORE = 'EXPLORE',
  /** Get help with homework */
  HOMEWORK_HELP = 'HOMEWORK_HELP',
}

/**
 * How urgent is the student's need?
 */
export enum IntentUrgency {
  /** Just browsing, no time pressure */
  LOW = 'LOW',
  /** Regular learning pace */
  NORMAL = 'NORMAL',
  /** Test coming up soon */
  HIGH = 'HIGH',
  /** Exam tomorrow/today */
  CRITICAL = 'CRITICAL',
}

/**
 * Student's current mood/readiness.
 */
export enum StudentMood {
  /** Excited to learn */
  MOTIVATED = 'MOTIVATED',
  /** Calm, ready to work */
  FOCUSED = 'FOCUSED',
  /** Feeling unsure */
  UNCERTAIN = 'UNCERTAIN',
  /** Stressed or anxious */
  ANXIOUS = 'ANXIOUS',
  /** Just want to get it done */
  NEUTRAL = 'NEUTRAL',
}

// ============================================================================
// INTENT PROMPT CONFIGURATION
// ============================================================================

/**
 * How each intent modifies AI behavior.
 */
export interface IntentPromptModifiers {
  /** Depth of explanation (1-5) */
  explanationDepth: 1 | 2 | 3 | 4 | 5;
  /** Include examples? */
  includeExamples: boolean;
  /** Example count if included */
  exampleCount: number;
  /** Include practice questions? */
  includePractice: boolean;
  /** Practice difficulty bias */
  difficultyBias: 'easier' | 'balanced' | 'harder';
  /** Tone adjustment */
  toneAdjustment: 'encouraging' | 'neutral' | 'focused';
  /** Response length preference */
  responseLength: 'concise' | 'balanced' | 'detailed';
  /** Include memory tips? */
  includeMemoryTips: boolean;
  /** Include exam tips? */
  includeExamTips: boolean;
  /** Time estimate per response */
  expectedTimeMinutes: number;
}

/**
 * Modifier configuration by intent.
 */
export const INTENT_MODIFIERS: Record<SessionIntent, IntentPromptModifiers> = {
  [SessionIntent.LEARN_CONCEPT]: {
    explanationDepth: 4,
    includeExamples: true,
    exampleCount: 2,
    includePractice: true,
    difficultyBias: 'easier',
    toneAdjustment: 'encouraging',
    responseLength: 'detailed',
    includeMemoryTips: true,
    includeExamTips: false,
    expectedTimeMinutes: 10,
  },
  [SessionIntent.PRACTICE]: {
    explanationDepth: 2,
    includeExamples: false,
    exampleCount: 0,
    includePractice: true,
    difficultyBias: 'balanced',
    toneAdjustment: 'neutral',
    responseLength: 'concise',
    includeMemoryTips: false,
    includeExamTips: false,
    expectedTimeMinutes: 5,
  },
  [SessionIntent.REVISE]: {
    explanationDepth: 3,
    includeExamples: true,
    exampleCount: 1,
    includePractice: true,
    difficultyBias: 'balanced',
    toneAdjustment: 'neutral',
    responseLength: 'balanced',
    includeMemoryTips: true,
    includeExamTips: false,
    expectedTimeMinutes: 7,
  },
  [SessionIntent.BUILD_CONFIDENCE]: {
    explanationDepth: 3,
    includeExamples: true,
    exampleCount: 2,
    includePractice: true,
    difficultyBias: 'easier', // Start easy to build confidence
    toneAdjustment: 'encouraging',
    responseLength: 'balanced',
    includeMemoryTips: true,
    includeExamTips: true,
    expectedTimeMinutes: 8,
  },
  [SessionIntent.EXAM_PREP]: {
    explanationDepth: 4,
    includeExamples: true,
    exampleCount: 3,
    includePractice: true,
    difficultyBias: 'harder', // Exam-level difficulty
    toneAdjustment: 'focused',
    responseLength: 'detailed',
    includeMemoryTips: true,
    includeExamTips: true,
    expectedTimeMinutes: 12,
  },
  [SessionIntent.EXPLORE]: {
    explanationDepth: 2,
    includeExamples: true,
    exampleCount: 1,
    includePractice: false,
    difficultyBias: 'balanced',
    toneAdjustment: 'encouraging',
    responseLength: 'concise',
    includeMemoryTips: false,
    includeExamTips: false,
    expectedTimeMinutes: 5,
  },
  [SessionIntent.HOMEWORK_HELP]: {
    explanationDepth: 3,
    includeExamples: true,
    exampleCount: 1,
    includePractice: false, // Don't give more work
    difficultyBias: 'balanced',
    toneAdjustment: 'encouraging',
    responseLength: 'balanced',
    includeMemoryTips: false,
    includeExamTips: false,
    expectedTimeMinutes: 6,
  },
};

// ============================================================================
// SESSION INTENT SCHEMA
// ============================================================================

/**
 * Session intent data captured at session start.
 */
export const SessionIntentSchema = z.object({
  /** Primary learning intent */
  intent: z.nativeEnum(SessionIntent),
  
  /** Urgency level */
  urgency: z.nativeEnum(IntentUrgency).default(IntentUrgency.NORMAL),
  
  /** Current mood (optional) */
  mood: z.nativeEnum(StudentMood).optional(),
  
  /** Specific topic focus (optional) */
  topicFocus: z.string().max(200).optional(),
  
  /** Upcoming exam/test date (optional) */
  examDate: z.string().datetime().optional(),
  
  /** Time available for this session (minutes) */
  availableMinutes: z.number().int().min(5).max(180).optional(),
  
  /** Student's self-reported confidence (1-5) */
  selfConfidence: z.number().int().min(1).max(5).optional(),
  
  /** Captured at session start */
  capturedAt: z.string().datetime(),
  
  /** Session ID (for tracking, not persistence) */
  sessionId: z.string(),
});

export type SessionIntentData = z.infer<typeof SessionIntentSchema>;

// ============================================================================
// GRADE-BASED INTENT CONFIGURATION
// ============================================================================

/**
 * Intent configuration by grade band.
 */
export interface GradeIntentConfig {
  /** Grades in this band */
  grades: number[];
  /** Is intent capture mandatory? */
  intentRequired: boolean;
  /** Show intent prompt at session start? */
  showPrompt: boolean;
  /** Default intent if not specified */
  defaultIntent: SessionIntent;
  /** Available intents for this grade */
  availableIntents: SessionIntent[];
  /** Prompt style */
  promptStyle: 'visual' | 'text' | 'minimal';
}

export const GRADE_INTENT_CONFIG: Record<string, GradeIntentConfig> = {
  junior: {
    grades: [1, 2, 3],
    intentRequired: false, // Optional for young kids
    showPrompt: false, // Auto-detect instead
    defaultIntent: SessionIntent.LEARN_CONCEPT,
    availableIntents: [
      SessionIntent.LEARN_CONCEPT,
      SessionIntent.PRACTICE,
      SessionIntent.EXPLORE,
    ],
    promptStyle: 'visual',
  },
  middle: {
    grades: [4, 5, 6, 7],
    intentRequired: false, // Soft prompt
    showPrompt: true,
    defaultIntent: SessionIntent.LEARN_CONCEPT,
    availableIntents: [
      SessionIntent.LEARN_CONCEPT,
      SessionIntent.PRACTICE,
      SessionIntent.REVISE,
      SessionIntent.BUILD_CONFIDENCE,
      SessionIntent.HOMEWORK_HELP,
      SessionIntent.EXPLORE,
    ],
    promptStyle: 'visual',
  },
  senior: {
    grades: [8, 9, 10, 11, 12],
    intentRequired: true, // Mandatory soft-prompt
    showPrompt: true,
    defaultIntent: SessionIntent.LEARN_CONCEPT,
    availableIntents: Object.values(SessionIntent), // All intents
    promptStyle: 'text',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get intent config for a grade.
 */
export function getIntentConfig(grade: number): GradeIntentConfig {
  if (grade <= 3) return GRADE_INTENT_CONFIG.junior;
  if (grade <= 7) return GRADE_INTENT_CONFIG.middle;
  return GRADE_INTENT_CONFIG.senior;
}

/**
 * Get prompt modifiers for an intent.
 */
export function getIntentModifiers(intent: SessionIntent): IntentPromptModifiers {
  return INTENT_MODIFIERS[intent];
}

/**
 * Check if intent is valid for grade.
 */
export function isIntentValidForGrade(intent: SessionIntent, grade: number): boolean {
  const config = getIntentConfig(grade);
  return config.availableIntents.includes(intent);
}
