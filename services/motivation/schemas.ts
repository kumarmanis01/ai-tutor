/**
 * FILE OBJECTIVE:
 * - Define motivation message schemas and types.
 * - Grade-aware, effort-focused motivation signals.
 * - Never competitive, always encouraging.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/motivation/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created motivation schemas
 */

import { z } from 'zod';

// ============================================================================
// MOTIVATION FOCUS TYPES
// ============================================================================

/**
 * What the motivation message focuses on.
 * NEVER use competitive metrics (ranks, comparisons).
 */
export enum MotivationFocus {
  /** Student showed improvement from previous session */
  IMPROVEMENT = 'IMPROVEMENT',
  /** Student put in consistent effort */
  EFFORT = 'EFFORT',
  /** Student maintained learning streak */
  CONSISTENCY = 'CONSISTENCY',
  /** Student overcame a difficult concept */
  PERSEVERANCE = 'PERSEVERANCE',
  /** Student asked good questions */
  CURIOSITY = 'CURIOSITY',
  /** Student completed practice thoroughly */
  THOROUGHNESS = 'THOROUGHNESS',
  /** General encouragement for session completion */
  COMPLETION = 'COMPLETION',
}

/**
 * Tone of the motivation message (grade-dependent).
 */
export enum MotivationTone {
  /** Playful, emoji-rich for Grades 1-3 */
  PLAYFUL = 'PLAYFUL',
  /** Encouraging and supportive for Grades 4-7 */
  SUPPORTIVE = 'SUPPORTIVE',
  /** Respectful and acknowledging for Grades 8-12 */
  RESPECTFUL = 'RESPECTFUL',
}

/**
 * When to show the motivation message.
 */
export enum MotivationTrigger {
  /** After completing a session */
  SESSION_END = 'SESSION_END',
  /** After a learning milestone */
  MILESTONE = 'MILESTONE',
  /** After returning from absence */
  RETURN_VISIT = 'RETURN_VISIT',
  /** During a struggle (encouragement) */
  STRUGGLE_SUPPORT = 'STRUGGLE_SUPPORT',
}

// ============================================================================
// LEARNING ANALYTICS INPUT
// ============================================================================

/**
 * Analytics data used to generate motivation signals.
 * All metrics are relative to student's own history (never comparative).
 */
export const LearningAnalyticsSchema = z.object({
  /** Student's grade level */
  grade: z.number().int().min(1).max(12),
  
  /** Preferred language */
  language: z.enum(['en', 'hi', 'hinglish']),
  
  /** Current session metrics */
  currentSession: z.object({
    /** Duration in minutes */
    durationMinutes: z.number().min(0),
    /** Number of concepts covered */
    conceptsCovered: z.number().int().min(0),
    /** Number of practice questions attempted */
    questionsAttempted: z.number().int().min(0),
    /** Number of questions answered correctly */
    questionsCorrect: z.number().int().min(0),
    /** Number of doubts asked */
    doubtsAsked: z.number().int().min(0),
    /** Number of hints used */
    hintsUsed: z.number().int().min(0),
    /** Did student complete planned activity? */
    completedPlannedActivity: z.boolean(),
  }),
  
  /** Historical metrics for comparison */
  history: z.object({
    /** Total sessions completed */
    totalSessions: z.number().int().min(0),
    /** Current streak (consecutive days) */
    currentStreak: z.number().int().min(0),
    /** Average accuracy over last 7 days */
    recentAccuracy: z.number().min(0).max(1),
    /** Accuracy improvement vs previous week */
    accuracyTrend: z.number(), // Can be negative
    /** Average session duration (minutes) */
    avgSessionDuration: z.number().min(0),
    /** Days since last session */
    daysSinceLastSession: z.number().int().min(0),
  }),
  
  /** Confidence metrics */
  confidence: z.object({
    /** Current confidence score (0-1) */
    current: z.number().min(0).max(1),
    /** Confidence trend (+/- from last week) */
    trend: z.number(),
  }),
});

export type LearningAnalytics = z.infer<typeof LearningAnalyticsSchema>;

// ============================================================================
// MOTIVATION MESSAGE OUTPUT
// ============================================================================

/**
 * Generated motivation message.
 */
export const MotivationMessageSchema = z.object({
  /** Unique message ID for tracking */
  id: z.string(),
  
  /** Primary motivation focus */
  focus: z.nativeEnum(MotivationFocus),
  
  /** Message tone (grade-appropriate) */
  tone: z.nativeEnum(MotivationTone),
  
  /** When to show this message */
  trigger: z.nativeEnum(MotivationTrigger),
  
  /** Primary message (1-2 sentences) */
  primaryMessage: z.string().min(10).max(200),
  
  /** Optional secondary message */
  secondaryMessage: z.string().max(150).optional(),
  
  /** Optional emoji for junior grades */
  emoji: z.string().optional(),
  
  /** Specific achievement highlighted (if any) */
  achievement: z.object({
    type: z.string(),
    value: z.string(),
    isPersonalBest: z.boolean(),
  }).optional(),
  
  /** Suggested next action (non-mandatory) */
  suggestedAction: z.object({
    label: z.string(),
    actionType: z.enum(['continue', 'practice', 'rest', 'explore']),
  }).optional(),
  
  /** Metadata for analytics */
  metadata: z.object({
    generatedAt: z.string().datetime(),
    analyticsSnapshot: z.object({
      sessionDuration: z.number(),
      questionsAttempted: z.number(),
      accuracy: z.number(),
      streak: z.number(),
    }),
  }),
});

export type MotivationMessage = z.infer<typeof MotivationMessageSchema>;

// ============================================================================
// GRADE BAND CONFIGURATION
// ============================================================================

/**
 * Configuration for motivation messages by grade band.
 */
export interface GradeMotivationConfig {
  /** Grade range */
  grades: number[];
  /** Default tone */
  tone: MotivationTone;
  /** Use emojis? */
  useEmojis: boolean;
  /** Max message length */
  maxMessageLength: number;
  /** Preferred focuses */
  preferredFocuses: MotivationFocus[];
  /** Avoid these focuses */
  avoidFocuses: MotivationFocus[];
}

export const GRADE_MOTIVATION_CONFIG: Record<string, GradeMotivationConfig> = {
  junior: {
    grades: [1, 2, 3],
    tone: MotivationTone.PLAYFUL,
    useEmojis: true,
    maxMessageLength: 100,
    preferredFocuses: [
      MotivationFocus.EFFORT,
      MotivationFocus.COMPLETION,
      MotivationFocus.CURIOSITY,
    ],
    avoidFocuses: [
      MotivationFocus.IMPROVEMENT, // Too abstract for young kids
    ],
  },
  middle: {
    grades: [4, 5, 6, 7],
    tone: MotivationTone.SUPPORTIVE,
    useEmojis: true,
    maxMessageLength: 150,
    preferredFocuses: [
      MotivationFocus.IMPROVEMENT,
      MotivationFocus.EFFORT,
      MotivationFocus.PERSEVERANCE,
    ],
    avoidFocuses: [],
  },
  senior: {
    grades: [8, 9, 10, 11, 12],
    tone: MotivationTone.RESPECTFUL,
    useEmojis: false,
    maxMessageLength: 200,
    preferredFocuses: [
      MotivationFocus.IMPROVEMENT,
      MotivationFocus.CONSISTENCY,
      MotivationFocus.PERSEVERANCE,
    ],
    avoidFocuses: [],
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get motivation config for a grade.
 */
export function getMotivationConfig(grade: number): GradeMotivationConfig {
  if (grade <= 3) return GRADE_MOTIVATION_CONFIG.junior;
  if (grade <= 7) return GRADE_MOTIVATION_CONFIG.middle;
  return GRADE_MOTIVATION_CONFIG.senior;
}

/**
 * Get tone for a grade.
 */
export function getToneForGrade(grade: number): MotivationTone {
  return getMotivationConfig(grade).tone;
}
