/**
 * FILE OBJECTIVE:
 * - Define expert review queue schemas.
 * - Support approve/correct/escalate actions.
 * - Low-cost, async review pipeline.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/expertReview/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created expert review schemas
 */

import { z } from 'zod';

// ============================================================================
// REVIEW TYPES
// ============================================================================

/**
 * Why this AI output was flagged for review.
 */
export enum FlagReason {
  /** AI confidence was low */
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  /** Potential hallucination detected */
  HALLUCINATION_RISK = 'HALLUCINATION_RISK',
  /** Content safety concern */
  SAFETY_CONCERN = 'SAFETY_CONCERN',
  /** Curriculum alignment unclear */
  CURRICULUM_MISMATCH = 'CURRICULUM_MISMATCH',
  /** Student explicitly reported issue */
  STUDENT_REPORT = 'STUDENT_REPORT',
  /** Parent reported issue */
  PARENT_REPORT = 'PARENT_REPORT',
  /** Automated quality check failed */
  QUALITY_CHECK_FAILED = 'QUALITY_CHECK_FAILED',
  /** Random sampling for quality assurance */
  RANDOM_SAMPLE = 'RANDOM_SAMPLE',
}

/**
 * Priority of review item.
 */
export enum ReviewPriority {
  /** Review within 1 hour */
  CRITICAL = 'CRITICAL',
  /** Review within 24 hours */
  HIGH = 'HIGH',
  /** Review within 3 days */
  MEDIUM = 'MEDIUM',
  /** Review when available */
  LOW = 'LOW',
}

/**
 * Current status of review item.
 */
export enum ReviewStatus {
  /** Waiting for review */
  PENDING = 'PENDING',
  /** Currently being reviewed */
  IN_REVIEW = 'IN_REVIEW',
  /** Approved as-is */
  APPROVED = 'APPROVED',
  /** Corrected and approved */
  CORRECTED = 'CORRECTED',
  /** Escalated to higher authority */
  ESCALATED = 'ESCALATED',
  /** Rejected (should not have been shown) */
  REJECTED = 'REJECTED',
}

/**
 * Type of AI output being reviewed.
 */
export enum OutputType {
  NOTES = 'NOTES',
  PRACTICE_QUESTION = 'PRACTICE_QUESTION',
  DOUBT_RESPONSE = 'DOUBT_RESPONSE',
  QUIZ = 'QUIZ',
  EXPLANATION = 'EXPLANATION',
}

// ============================================================================
// REVIEW QUEUE ITEM SCHEMA
// ============================================================================

/**
 * An item in the expert review queue.
 * Note: Contains NO raw student data for privacy.
 */
export const ReviewQueueItemSchema = z.object({
  /** Unique review ID */
  id: z.string(),
  
  /** Type of AI output */
  outputType: z.nativeEnum(OutputType),
  
  /** Why it was flagged */
  flagReason: z.nativeEnum(FlagReason),
  
  /** Review priority */
  priority: z.nativeEnum(ReviewPriority),
  
  /** Current status */
  status: z.nativeEnum(ReviewStatus),
  
  /** The AI output content (sanitized, no student PII) */
  aiOutput: z.object({
    /** Main content generated */
    content: z.unknown(), // Flexible based on output type
    /** AI model used */
    model: z.string(),
    /** AI confidence score */
    confidence: z.number().min(0).max(1),
    /** Generation timestamp */
    generatedAt: z.string().datetime(),
  }),
  
  /** Context (anonymized) */
  context: z.object({
    /** Grade level */
    grade: z.number().int().min(1).max(12),
    /** Subject */
    subject: z.string(),
    /** Topic */
    topic: z.string(),
    /** Board/curriculum */
    board: z.string().optional(),
    /** Original prompt (sanitized) */
    sanitizedPrompt: z.string(),
  }),
  
  /** Automated checks that triggered flag */
  automatedFlags: z.array(z.object({
    check: z.string(),
    result: z.string(),
    severity: z.enum(['info', 'warning', 'error']),
  })).optional(),
  
  /** Created timestamp */
  createdAt: z.string().datetime(),
  
  /** Assigned reviewer (if any) */
  assignedTo: z.string().optional(),
  
  /** Assigned timestamp */
  assignedAt: z.string().datetime().optional(),
  
  /** Due date for review */
  dueAt: z.string().datetime().optional(),
});

export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

// ============================================================================
// REVIEW FEEDBACK SCHEMA
// ============================================================================

/**
 * Feedback from expert reviewer.
 */
export const ReviewFeedbackSchema = z.object({
  /** Review item ID */
  reviewItemId: z.string(),
  
  /** Reviewer ID */
  reviewerId: z.string(),
  
  /** Action taken */
  action: z.enum(['APPROVE', 'CORRECT', 'ESCALATE', 'REJECT']),
  
  /** Overall quality rating (1-5) */
  qualityRating: z.number().int().min(1).max(5),
  
  /** Is content factually accurate? */
  isFactuallyAccurate: z.boolean(),
  
  /** Is content grade-appropriate? */
  isGradeAppropriate: z.boolean(),
  
  /** Is content curriculum-aligned? */
  isCurriculumAligned: z.boolean(),
  
  /** Correction details (if action is CORRECT) */
  correction: z.object({
    /** What was wrong */
    issue: z.string(),
    /** Corrected content */
    correctedContent: z.unknown(),
    /** Explanation of correction */
    explanation: z.string(),
  }).optional(),
  
  /** Escalation details (if action is ESCALATE) */
  escalation: z.object({
    /** Why escalating */
    reason: z.string(),
    /** Who to escalate to */
    escalateTo: z.enum(['senior_reviewer', 'curriculum_head', 'safety_team']),
    /** Urgency */
    urgency: z.nativeEnum(ReviewPriority),
  }).optional(),
  
  /** Rejection details (if action is REJECT) */
  rejection: z.object({
    /** Why rejected */
    reason: z.string(),
    /** Should student be shown alternative? */
    showAlternative: z.boolean(),
  }).optional(),
  
  /** Notes for system improvement */
  systemNotes: z.string().max(1000).optional(),
  
  /** Suggested prompt improvement */
  promptImprovement: z.string().max(500).optional(),
  
  /** Completed timestamp */
  completedAt: z.string().datetime(),
  
  /** Time spent reviewing (seconds) */
  reviewDurationSeconds: z.number().int(),
});

export type ReviewFeedback = z.infer<typeof ReviewFeedbackSchema>;

// ============================================================================
// CORRECTION INGESTION SCHEMA
// ============================================================================

/**
 * Corrections to be fed back into the system.
 */
export const CorrectionIngestionSchema = z.object({
  /** Correction batch ID */
  batchId: z.string(),
  
  /** Corrections in this batch */
  corrections: z.array(z.object({
    /** Original review item ID */
    reviewItemId: z.string(),
    /** Output type */
    outputType: z.nativeEnum(OutputType),
    /** Grade/subject/topic context */
    context: z.object({
      grade: z.number().int(),
      subject: z.string(),
      topic: z.string(),
    }),
    /** The issue identified */
    issue: z.object({
      type: z.enum([
        'factual_error',
        'grade_inappropriate',
        'curriculum_mismatch',
        'incomplete_explanation',
        'confusing_language',
        'missing_example',
        'wrong_difficulty',
      ]),
      description: z.string(),
    }),
    /** How to correct */
    correctionRule: z.object({
      /** Rule type */
      ruleType: z.enum([
        'add_to_prompt',
        'add_example',
        'avoid_phrase',
        'require_check',
        'adjust_difficulty',
      ]),
      /** Rule content */
      content: z.string(),
      /** Confidence in rule (from reviewer) */
      confidence: z.number().min(0).max(1),
    }),
  })),
  
  /** Created timestamp */
  createdAt: z.string().datetime(),
  
  /** Approved by */
  approvedBy: z.string(),
});

export type CorrectionIngestion = z.infer<typeof CorrectionIngestionSchema>;

// ============================================================================
// QUEUE STATISTICS
// ============================================================================

/**
 * Statistics for the review queue.
 */
export const QueueStatisticsSchema = z.object({
  /** Total pending items */
  pendingCount: z.number().int(),
  
  /** Items by priority */
  byPriority: z.object({
    critical: z.number().int(),
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
  }),
  
  /** Items by flag reason */
  byFlagReason: z.record(z.string(), z.number().int()),
  
  /** Average review time (seconds) */
  avgReviewTimeSeconds: z.number(),
  
  /** Approval rate */
  approvalRate: z.number().min(0).max(1),
  
  /** Correction rate */
  correctionRate: z.number().min(0).max(1),
  
  /** Escalation rate */
  escalationRate: z.number().min(0).max(1),
  
  /** Items reviewed today */
  reviewedToday: z.number().int(),
  
  /** Updated timestamp */
  updatedAt: z.string().datetime(),
});

export type QueueStatistics = z.infer<typeof QueueStatisticsSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Review queue configuration.
 */
export interface ReviewQueueConfig {
  /** Auto-flag threshold for low confidence */
  lowConfidenceThreshold: number;
  /** Random sampling rate (0-1) */
  randomSampleRate: number;
  /** Priority escalation after hours */
  priorityEscalationHours: Record<ReviewPriority, number>;
  /** Max items per reviewer per day */
  maxItemsPerReviewerPerDay: number;
}

export const DEFAULT_REVIEW_CONFIG: ReviewQueueConfig = {
  lowConfidenceThreshold: 0.6,
  randomSampleRate: 0.02, // 2% random sampling
  priorityEscalationHours: {
    [ReviewPriority.CRITICAL]: 1,
    [ReviewPriority.HIGH]: 24,
    [ReviewPriority.MEDIUM]: 72,
    [ReviewPriority.LOW]: 168, // 1 week
  },
  maxItemsPerReviewerPerDay: 50,
};
