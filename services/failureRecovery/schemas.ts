/**
 * FILE OBJECTIVE:
 * - Define stuck-state detection schemas.
 * - Recovery action types and mappings.
 * - Grade-aware recovery configuration.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/failureRecovery/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created failure recovery schemas
 */

import { z } from 'zod';

// ============================================================================
// STUCK STATE INDICATORS
// ============================================================================

/**
 * Indicators that a student might be stuck.
 */
export enum StuckIndicator {
  /** Multiple retry attempts */
  MULTIPLE_RETRIES = 'MULTIPLE_RETRIES',
  /** Low confidence on recent answers */
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  /** Long time on single question */
  LONG_TIME = 'LONG_TIME',
  /** Multiple hints requested */
  MANY_HINTS = 'MANY_HINTS',
  /** Repeated wrong answers */
  REPEATED_WRONG = 'REPEATED_WRONG',
  /** Skipping multiple questions */
  SKIPPING = 'SKIPPING',
  /** Long idle time */
  IDLE = 'IDLE',
  /** Explicit help request */
  HELP_REQUESTED = 'HELP_REQUESTED',
}

/**
 * Severity of stuck state.
 */
export enum StuckSeverity {
  /** Mild frustration, might self-resolve */
  MILD = 'MILD',
  /** Moderate difficulty, needs intervention */
  MODERATE = 'MODERATE',
  /** High frustration, immediate intervention */
  HIGH = 'HIGH',
  /** Critical - risk of abandonment */
  CRITICAL = 'CRITICAL',
}

// ============================================================================
// RECOVERY ACTIONS
// ============================================================================

/**
 * Actions to help a stuck student.
 */
export enum RecoveryAction {
  /** Provide a simpler explanation */
  SIMPLER_EXPLANATION = 'SIMPLER_EXPLANATION',
  /** Show an alternate example */
  ALTERNATE_EXAMPLE = 'ALTERNATE_EXAMPLE',
  /** Suggest reviewing prerequisites */
  SUGGEST_REVISION = 'SUGGEST_REVISION',
  /** Break down into smaller steps */
  BREAK_DOWN_STEPS = 'BREAK_DOWN_STEPS',
  /** Offer easier practice */
  EASIER_PRACTICE = 'EASIER_PRACTICE',
  /** Provide visual aid */
  VISUAL_AID = 'VISUAL_AID',
  /** Suggest taking a break */
  SUGGEST_BREAK = 'SUGGEST_BREAK',
  /** Offer to switch topics */
  SWITCH_TOPIC = 'SWITCH_TOPIC',
  /** Show worked solution */
  SHOW_SOLUTION = 'SHOW_SOLUTION',
  /** Connect to human help */
  HUMAN_HELP = 'HUMAN_HELP',
  /** Encouraging message only */
  ENCOURAGE = 'ENCOURAGE',
}

// ============================================================================
// STUDENT STATE SCHEMA
// ============================================================================

/**
 * Current state metrics for stuck detection.
 */
export const StudentStateSchema = z.object({
  /** Current session ID */
  sessionId: z.string(),
  
  /** Student grade */
  grade: z.number().int().min(1).max(12),
  
  /** Current topic */
  currentTopic: z.string(),
  
  /** Current question/concept (if any) */
  currentItem: z.string().optional(),
  
  /** Time on current item (seconds) */
  timeOnCurrentItem: z.number().min(0),
  
  /** Expected time for this type of item (seconds) */
  expectedTime: z.number().min(0),
  
  /** Retry count on current item */
  retryCount: z.number().int().min(0),
  
  /** Hints used on current item */
  hintsUsed: z.number().int().min(0),
  
  /** Recent answer confidence scores */
  recentConfidences: z.array(z.number().min(0).max(1)),
  
  /** Recent answer correctness */
  recentCorrectness: z.array(z.boolean()),
  
  /** Questions skipped in session */
  skippedCount: z.number().int().min(0),
  
  /** Idle time (seconds since last interaction) */
  idleTime: z.number().min(0),
  
  /** Has student explicitly asked for help? */
  helpRequested: z.boolean(),
  
  /** Session duration so far (seconds) */
  sessionDuration: z.number().min(0),
  
  /** Mood indicator (if captured) */
  mood: z.enum(['motivated', 'focused', 'uncertain', 'anxious', 'neutral']).optional(),
});

export type StudentState = z.infer<typeof StudentStateSchema>;

// ============================================================================
// STUCK DETECTION RESULT
// ============================================================================

/**
 * Result of stuck state detection.
 */
export const StuckDetectionResultSchema = z.object({
  /** Is student stuck? */
  isStuck: z.boolean(),
  
  /** Detected indicators */
  indicators: z.array(z.nativeEnum(StuckIndicator)),
  
  /** Overall severity */
  severity: z.nativeEnum(StuckSeverity).optional(),
  
  /** Confidence in detection (0-1) */
  confidence: z.number().min(0).max(1),
  
  /** Primary suspected cause */
  primaryCause: z.string().optional(),
  
  /** Detection timestamp */
  detectedAt: z.string().datetime(),
});

export type StuckDetectionResult = z.infer<typeof StuckDetectionResultSchema>;

// ============================================================================
// RECOVERY PLAN
// ============================================================================

/**
 * A recovery plan for a stuck student.
 */
export const RecoveryPlanSchema = z.object({
  /** Detection that triggered this */
  detection: StuckDetectionResultSchema,
  
  /** Recommended primary action */
  primaryAction: z.nativeEnum(RecoveryAction),
  
  /** Alternative actions if primary doesn't help */
  alternativeActions: z.array(z.nativeEnum(RecoveryAction)),
  
  /** Message to show student (grade-appropriate, encouraging!) */
  studentMessage: z.string().max(300),
  
  /** Action button text */
  actionButtonText: z.string().max(50),
  
  /** Secondary option text (optional) */
  secondaryOption: z.string().max(100).optional(),
  
  /** Should show encouragement? */
  showEncouragement: z.boolean(),
  
  /** Estimated recovery time (seconds) */
  estimatedRecoveryTime: z.number().int().optional(),
  
  /** Track if student dismisses */
  trackDismissal: z.boolean(),
});

export type RecoveryPlan = z.infer<typeof RecoveryPlanSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Detection thresholds.
 */
export interface DetectionThresholds {
  /** Retries before flagging */
  retryThreshold: number;
  /** Time multiplier (vs expected) before flagging */
  timeMultiplierThreshold: number;
  /** Hints before flagging */
  hintThreshold: number;
  /** Recent wrong answers before flagging */
  wrongAnswerThreshold: number;
  /** Skips before flagging */
  skipThreshold: number;
  /** Idle seconds before flagging */
  idleThreshold: number;
  /** Low confidence threshold */
  lowConfidenceThreshold: number;
}

/**
 * Grade-specific configuration.
 */
export interface GradeRecoveryConfig {
  /** Grades in this band */
  grades: number[];
  /** Detection thresholds */
  thresholds: DetectionThresholds;
  /** Preferred recovery actions (in order) */
  preferredActions: RecoveryAction[];
  /** Message tone */
  messageTone: 'playful' | 'supportive' | 'focused';
  /** Use emojis in messages? */
  useEmojis: boolean;
  /** Max message length */
  maxMessageLength: number;
}

export const GRADE_RECOVERY_CONFIG: Record<string, GradeRecoveryConfig> = {
  junior: {
    grades: [1, 2, 3],
    thresholds: {
      retryThreshold: 2, // More lenient
      timeMultiplierThreshold: 2.5,
      hintThreshold: 3,
      wrongAnswerThreshold: 2,
      skipThreshold: 2,
      idleThreshold: 120, // 2 minutes
      lowConfidenceThreshold: 0.5,
    },
    preferredActions: [
      RecoveryAction.ENCOURAGE,
      RecoveryAction.VISUAL_AID,
      RecoveryAction.SIMPLER_EXPLANATION,
      RecoveryAction.SUGGEST_BREAK,
    ],
    messageTone: 'playful',
    useEmojis: true,
    maxMessageLength: 150,
  },
  middle: {
    grades: [4, 5, 6, 7],
    thresholds: {
      retryThreshold: 3,
      timeMultiplierThreshold: 2.0,
      hintThreshold: 4,
      wrongAnswerThreshold: 3,
      skipThreshold: 3,
      idleThreshold: 180, // 3 minutes
      lowConfidenceThreshold: 0.4,
    },
    preferredActions: [
      RecoveryAction.ALTERNATE_EXAMPLE,
      RecoveryAction.BREAK_DOWN_STEPS,
      RecoveryAction.SIMPLER_EXPLANATION,
      RecoveryAction.EASIER_PRACTICE,
    ],
    messageTone: 'supportive',
    useEmojis: true,
    maxMessageLength: 200,
  },
  senior: {
    grades: [8, 9, 10, 11, 12],
    thresholds: {
      retryThreshold: 3,
      timeMultiplierThreshold: 1.8,
      hintThreshold: 5,
      wrongAnswerThreshold: 3,
      skipThreshold: 4,
      idleThreshold: 240, // 4 minutes
      lowConfidenceThreshold: 0.35,
    },
    preferredActions: [
      RecoveryAction.BREAK_DOWN_STEPS,
      RecoveryAction.SUGGEST_REVISION,
      RecoveryAction.ALTERNATE_EXAMPLE,
      RecoveryAction.SHOW_SOLUTION,
    ],
    messageTone: 'focused',
    useEmojis: false,
    maxMessageLength: 250,
  },
};

/**
 * Get recovery config for a grade.
 */
export function getRecoveryConfig(grade: number): GradeRecoveryConfig {
  if (grade <= 3) return GRADE_RECOVERY_CONFIG.junior;
  if (grade <= 7) return GRADE_RECOVERY_CONFIG.middle;
  return GRADE_RECOVERY_CONFIG.senior;
}
