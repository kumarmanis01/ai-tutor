/**
 * FILE OBJECTIVE:
 * - Define schemas for retention metrics tracking.
 * - Track Day-1 to Day-7 retention, session completion, doubts/session, confidence trends.
 * - Define red flags and churn indicators.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/retention/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created retention metrics schemas
 */

import { z } from 'zod';

// ============================================================================
// CORE METRIC TYPES
// ============================================================================

/**
 * Retention window periods to track.
 */
export enum RetentionWindow {
  DAY_1 = 'day_1',
  DAY_3 = 'day_3',
  DAY_7 = 'day_7',
  DAY_14 = 'day_14',
  DAY_30 = 'day_30',
}

/**
 * Metric categories for tracking.
 */
export enum MetricCategory {
  ENGAGEMENT = 'engagement',
  LEARNING = 'learning',
  CONFIDENCE = 'confidence',
  PARENT_INVOLVEMENT = 'parent_involvement',
  USAGE_PATTERN = 'usage_pattern',
}

/**
 * Risk level for churn prediction.
 */
export enum ChurnRisk {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Red flag types indicating potential churn.
 */
export enum RedFlag {
  HIGH_DOUBTS_LOW_CONFIDENCE = 'high_doubts_low_confidence',
  FLAT_DIFFICULTY_3_WEEKS = 'flat_difficulty_3_weeks',
  NO_PARENT_VIEWS = 'no_parent_views',
  DECLINING_SESSION_LENGTH = 'declining_session_length',
  INCREASING_SKIP_RATE = 'increasing_skip_rate',
  NO_RETURN_AFTER_STRUGGLE = 'no_return_after_struggle',
  LOW_COMPLETION_RATE = 'low_completion_rate',
  NEGATIVE_CONFIDENCE_TREND = 'negative_confidence_trend',
  ABANDONED_DIAGNOSTIC = 'abandoned_diagnostic',
  STUCK_WITHOUT_RECOVERY = 'stuck_without_recovery',
}

// ============================================================================
// METRIC SCHEMAS
// ============================================================================

/**
 * Daily engagement metrics for a student.
 */
export const DailyEngagementSchema = z.object({
  studentId: z.string(),
  date: z.string().datetime(),
  
  // Session metrics
  sessionsStarted: z.number().int().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  totalTimeMinutes: z.number().nonnegative(),
  avgSessionLengthMinutes: z.number().nonnegative(),
  
  // Learning metrics
  questionsAttempted: z.number().int().nonnegative(),
  questionsCorrect: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  doubtsAsked: z.number().int().nonnegative(),
  topicsExplored: z.number().int().nonnegative(),
  
  // Skip/abandon metrics
  questionsSkipped: z.number().int().nonnegative(),
  sessionsAbandoned: z.number().int().nonnegative(),
});

export type DailyEngagement = z.infer<typeof DailyEngagementSchema>;

/**
 * Confidence tracking over time.
 */
export const ConfidenceTrendSchema = z.object({
  studentId: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  
  // Confidence snapshots
  confidenceScores: z.array(z.object({
    date: z.string().datetime(),
    score: z.number().min(0).max(1),
    topic: z.string().optional(),
  })),
  
  // Calculated trend
  trend: z.enum(['improving', 'stable', 'declining', 'volatile']),
  averageConfidence: z.number().min(0).max(1),
  volatility: z.number().nonnegative(), // Standard deviation
});

export type ConfidenceTrend = z.infer<typeof ConfidenceTrendSchema>;

/**
 * Difficulty progression tracking.
 */
export const DifficultyProgressionSchema = z.object({
  studentId: z.string(),
  subject: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  
  // Difficulty snapshots
  difficultyLevels: z.array(z.object({
    date: z.string().datetime(),
    level: z.number().min(1).max(10),
  })),
  
  // Calculated metrics
  startLevel: z.number().min(1).max(10),
  endLevel: z.number().min(1).max(10),
  isFlat: z.boolean(), // No change over period
  weeksFlat: z.number().int().nonnegative(),
});

export type DifficultyProgression = z.infer<typeof DifficultyProgressionSchema>;

/**
 * Parent involvement tracking.
 */
export const ParentInvolvementSchema = z.object({
  studentId: z.string(),
  parentId: z.string().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  
  // Engagement metrics
  dashboardViews: z.number().int().nonnegative(),
  reportViews: z.number().int().nonnegative(),
  messagesRead: z.number().int().nonnegative(),
  settingsChanged: z.number().int().nonnegative(),
  lastActiveAt: z.string().datetime().optional(),
  
  // Calculated
  isActive: z.boolean(),
  daysSinceActive: z.number().int().nonnegative(),
});

export type ParentInvolvement = z.infer<typeof ParentInvolvementSchema>;

// ============================================================================
// RETENTION TRACKING
// ============================================================================

/**
 * Retention status for a cohort window.
 */
export const RetentionStatusSchema = z.object({
  studentId: z.string(),
  cohortDate: z.string().datetime(), // Sign-up date
  window: z.nativeEnum(RetentionWindow),
  
  // Status
  isRetained: z.boolean(),
  returnedAt: z.string().datetime().optional(),
  
  // Context
  sessionsInWindow: z.number().int().nonnegative(),
  minutesInWindow: z.number().nonnegative(),
});

export type RetentionStatus = z.infer<typeof RetentionStatusSchema>;

/**
 * Cohort retention summary.
 */
export const CohortRetentionSchema = z.object({
  cohortDate: z.string().datetime(),
  cohortSize: z.number().int().positive(),
  grade: z.number().int().min(1).max(12).optional(),
  
  // Retention by window
  retentionRates: z.object({
    day_1: z.number().min(0).max(1),
    day_3: z.number().min(0).max(1),
    day_7: z.number().min(0).max(1),
    day_14: z.number().min(0).max(1),
    day_30: z.number().min(0).max(1),
  }),
  
  // Benchmarks
  targetRates: z.object({
    day_1: z.number().min(0).max(1),
    day_3: z.number().min(0).max(1),
    day_7: z.number().min(0).max(1),
    day_14: z.number().min(0).max(1),
    day_30: z.number().min(0).max(1),
  }),
  
  // Meeting targets?
  meetsTargets: z.object({
    day_1: z.boolean(),
    day_3: z.boolean(),
    day_7: z.boolean(),
    day_14: z.boolean(),
    day_30: z.boolean(),
  }),
});

export type CohortRetention = z.infer<typeof CohortRetentionSchema>;

// ============================================================================
// CHURN PREDICTION
// ============================================================================

/**
 * Red flag detection result.
 */
export const RedFlagDetectionSchema = z.object({
  studentId: z.string(),
  flag: z.nativeEnum(RedFlag),
  severity: z.nativeEnum(ChurnRisk),
  detectedAt: z.string().datetime(),
  
  // Evidence
  evidence: z.object({
    metric: z.string(),
    currentValue: z.number(),
    threshold: z.number(),
    periodDays: z.number().int().positive(),
  }),
  
  // Recommended action
  suggestedIntervention: z.string(),
});

export type RedFlagDetection = z.infer<typeof RedFlagDetectionSchema>;

/**
 * Student churn risk assessment.
 */
export const ChurnRiskAssessmentSchema = z.object({
  studentId: z.string(),
  assessedAt: z.string().datetime(),
  
  // Overall risk
  overallRisk: z.nativeEnum(ChurnRisk),
  riskScore: z.number().min(0).max(100),
  
  // Red flags
  activeRedFlags: z.array(RedFlagDetectionSchema),
  resolvedRedFlags: z.array(z.string()), // Flag IDs
  
  // Prediction
  churnProbability30Day: z.number().min(0).max(1),
  confidenceInterval: z.object({
    lower: z.number().min(0).max(1),
    upper: z.number().min(0).max(1),
  }),
  
  // Key factors
  topChurnFactors: z.array(z.object({
    factor: z.string(),
    impact: z.number(), // -1 to 1, negative = increases churn
    description: z.string(),
  })),
  
  // Recommendations
  interventions: z.array(z.object({
    priority: z.number().int().min(1).max(5),
    action: z.string(),
    expectedImpact: z.string(),
    owner: z.enum(['system', 'parent', 'teacher', 'admin']),
  })),
});

export type ChurnRiskAssessment = z.infer<typeof ChurnRiskAssessmentSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Retention targets by grade band.
 */
export const RETENTION_TARGETS: Record<string, CohortRetention['targetRates']> = {
  junior: {
    day_1: 0.80,
    day_3: 0.65,
    day_7: 0.50,
    day_14: 0.40,
    day_30: 0.30,
  },
  middle: {
    day_1: 0.75,
    day_3: 0.60,
    day_7: 0.45,
    day_14: 0.35,
    day_30: 0.25,
  },
  senior: {
    day_1: 0.70,
    day_3: 0.55,
    day_7: 0.40,
    day_14: 0.30,
    day_30: 0.22,
  },
};

/**
 * Red flag thresholds.
 */
export interface RedFlagThresholds {
  highDoubtsMinimum: number;
  lowConfidenceThreshold: number;
  flatDifficultyWeeks: number;
  parentInactiveDays: number;
  sessionLengthDeclinePercent: number;
  skipRateThreshold: number;
  completionRateThreshold: number;
  confidenceDeclineThreshold: number;
}

export const DEFAULT_RED_FLAG_THRESHOLDS: RedFlagThresholds = {
  highDoubtsMinimum: 5, // 5+ doubts per session
  lowConfidenceThreshold: 0.4, // Below 40%
  flatDifficultyWeeks: 3, // No change in 3 weeks
  parentInactiveDays: 14, // No parent activity in 14 days
  sessionLengthDeclinePercent: 30, // 30% decline
  skipRateThreshold: 0.25, // Skipping 25%+ questions
  completionRateThreshold: 0.6, // Below 60% completion
  confidenceDeclineThreshold: 0.15, // 15%+ decline
};

/**
 * Intervention templates for each red flag.
 */
export const RED_FLAG_INTERVENTIONS: Record<RedFlag, string> = {
  [RedFlag.HIGH_DOUBTS_LOW_CONFIDENCE]: 
    'Enable additional scaffolding and reduce difficulty temporarily',
  [RedFlag.FLAT_DIFFICULTY_3_WEEKS]: 
    'Review learning path and consider diagnostic reassessment',
  [RedFlag.NO_PARENT_VIEWS]: 
    'Send parent engagement reminder with progress highlights',
  [RedFlag.DECLINING_SESSION_LENGTH]: 
    'Increase gamification elements and add session milestones',
  [RedFlag.INCREASING_SKIP_RATE]: 
    'Adjust difficulty downward and add more visual aids',
  [RedFlag.NO_RETURN_AFTER_STRUGGLE]: 
    'Send motivational outreach with easy win opportunity',
  [RedFlag.LOW_COMPLETION_RATE]: 
    'Shorten sessions and add more checkpoints',
  [RedFlag.NEGATIVE_CONFIDENCE_TREND]: 
    'Increase encouragement frequency and celebrate small wins',
  [RedFlag.ABANDONED_DIAGNOSTIC]: 
    'Offer simplified onboarding and skip to personalized content',
  [RedFlag.STUCK_WITHOUT_RECOVERY]: 
    'Trigger immediate recovery flow with human escalation option',
};

/**
 * Get retention targets for a grade.
 */
export function getRetentionTargets(grade: number): CohortRetention['targetRates'] {
  if (grade <= 3) return RETENTION_TARGETS.junior;
  if (grade <= 7) return RETENTION_TARGETS.middle;
  return RETENTION_TARGETS.senior;
}
