/**
 * FILE OBJECTIVE:
 * - Expert review pipeline for flagged AI outputs.
 * - Supports approve/correct/escalate actions.
 * - Feeds corrections back into prompt rules.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/expertReview/pipeline.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created expert review pipeline
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FlagReason,
  ReviewPriority,
  ReviewStatus,
  OutputType,
  DEFAULT_REVIEW_CONFIG,
  type ReviewQueueItem,
  type ReviewFeedback,
  type CorrectionIngestion,
  type QueueStatistics,
  type ReviewQueueConfig,
} from './schemas';

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Interface for review queue storage.
 */
export interface ReviewQueueStore {
  /** Add item to queue */
  addItem(item: ReviewQueueItem): Promise<void>;
  /** Get item by ID */
  getItem(id: string): Promise<ReviewQueueItem | null>;
  /** Update item */
  updateItem(id: string, updates: Partial<ReviewQueueItem>): Promise<void>;
  /** Get pending items by priority */
  getPendingItems(priority?: ReviewPriority, limit?: number): Promise<ReviewQueueItem[]>;
  /** Get items for reviewer */
  getItemsForReviewer(reviewerId: string): Promise<ReviewQueueItem[]>;
  /** Save feedback */
  saveFeedback(feedback: ReviewFeedback): Promise<void>;
  /** Get queue statistics */
  getStatistics(): Promise<QueueStatistics>;
}

// ============================================================================
// FLAGGING ENGINE
// ============================================================================

export interface AIOutputForReview {
  /** Output type */
  type: OutputType;
  /** The generated content */
  content: unknown;
  /** AI confidence score */
  confidence: number;
  /** Model used */
  model: string;
  /** Generation timestamp */
  generatedAt: string;
  /** Context (anonymized) */
  context: {
    grade: number;
    subject: string;
    topic: string;
    board?: string;
    sanitizedPrompt: string;
  };
  /** Automated check results */
  automatedChecks?: {
    check: string;
    result: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}

/**
 * Determine if an AI output should be flagged for review.
 */
export function shouldFlagForReview(
  output: AIOutputForReview,
  config: ReviewQueueConfig = DEFAULT_REVIEW_CONFIG
): { shouldFlag: boolean; reason?: FlagReason; priority?: ReviewPriority } {
  // Low confidence
  if (output.confidence < config.lowConfidenceThreshold) {
    return {
      shouldFlag: true,
      reason: FlagReason.LOW_CONFIDENCE,
      priority: output.confidence < 0.4 ? ReviewPriority.HIGH : ReviewPriority.MEDIUM,
    };
  }
  
  // Check automated flags
  if (output.automatedChecks) {
    const errors = output.automatedChecks.filter(c => c.severity === 'error');
    const warnings = output.automatedChecks.filter(c => c.severity === 'warning');
    
    // Hallucination risk
    if (errors.some(e => e.check.includes('hallucination'))) {
      return {
        shouldFlag: true,
        reason: FlagReason.HALLUCINATION_RISK,
        priority: ReviewPriority.CRITICAL,
      };
    }
    
    // Safety concern
    if (errors.some(e => e.check.includes('safety'))) {
      return {
        shouldFlag: true,
        reason: FlagReason.SAFETY_CONCERN,
        priority: ReviewPriority.CRITICAL,
      };
    }
    
    // Quality check failed
    if (errors.length > 0) {
      return {
        shouldFlag: true,
        reason: FlagReason.QUALITY_CHECK_FAILED,
        priority: ReviewPriority.HIGH,
      };
    }
    
    // Multiple warnings
    if (warnings.length >= 2) {
      return {
        shouldFlag: true,
        reason: FlagReason.QUALITY_CHECK_FAILED,
        priority: ReviewPriority.MEDIUM,
      };
    }
  }
  
  // Random sampling
  if (Math.random() < config.randomSampleRate) {
    return {
      shouldFlag: true,
      reason: FlagReason.RANDOM_SAMPLE,
      priority: ReviewPriority.LOW,
    };
  }
  
  return { shouldFlag: false };
}

/**
 * Create a review queue item from flagged output.
 */
export function createReviewItem(
  output: AIOutputForReview,
  reason: FlagReason,
  priority: ReviewPriority
): ReviewQueueItem {
  return {
    id: uuidv4(),
    outputType: output.type,
    flagReason: reason,
    priority,
    status: ReviewStatus.PENDING,
    aiOutput: {
      content: output.content,
      model: output.model,
      confidence: output.confidence,
      generatedAt: output.generatedAt,
    },
    context: output.context,
    automatedFlags: output.automatedChecks,
    createdAt: new Date().toISOString(),
    dueAt: calculateDueDate(priority),
  };
}

/**
 * Calculate due date based on priority.
 */
function calculateDueDate(priority: ReviewPriority): string {
  const hours = DEFAULT_REVIEW_CONFIG.priorityEscalationHours[priority];
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + hours);
  return dueDate.toISOString();
}

// ============================================================================
// REVIEW PROCESSING
// ============================================================================

/**
 * Process expert feedback and update system.
 */
export async function processReviewFeedback(
  feedback: ReviewFeedback,
  store: ReviewQueueStore,
  onCorrectionReady?: (correction: CorrectionIngestion) => Promise<void>
): Promise<void> {
  // Update item status
  let newStatus: ReviewStatus;
  switch (feedback.action) {
    case 'APPROVE':
      newStatus = ReviewStatus.APPROVED;
      break;
    case 'CORRECT':
      newStatus = ReviewStatus.CORRECTED;
      break;
    case 'ESCALATE':
      newStatus = ReviewStatus.ESCALATED;
      break;
    case 'REJECT':
      newStatus = ReviewStatus.REJECTED;
      break;
  }
  
  await store.updateItem(feedback.reviewItemId, { status: newStatus });
  await store.saveFeedback(feedback);
  
  // If correction provided, prepare for ingestion
  if (feedback.action === 'CORRECT' && feedback.correction && onCorrectionReady) {
    const item = await store.getItem(feedback.reviewItemId);
    if (item) {
      const ingestion = createCorrectionIngestion(item, feedback);
      await onCorrectionReady(ingestion);
    }
  }
}

/**
 * Create correction ingestion from feedback.
 */
function createCorrectionIngestion(
  item: ReviewQueueItem,
  feedback: ReviewFeedback
): CorrectionIngestion {
  if (!feedback.correction) {
    throw new Error('Correction details required');
  }
  
  // Map issue to correction type
  const issueType = mapIssueToType(feedback.correction.issue);
  const ruleType = mapIssueToRuleType(issueType);
  
  return {
    batchId: uuidv4(),
    corrections: [{
      reviewItemId: item.id,
      outputType: item.outputType,
      context: {
        grade: item.context.grade,
        subject: item.context.subject,
        topic: item.context.topic,
      },
      issue: {
        type: issueType,
        description: feedback.correction.issue,
      },
      correctionRule: {
        ruleType,
        content: feedback.correction.explanation,
        confidence: feedback.qualityRating / 5,
      },
    }],
    createdAt: new Date().toISOString(),
    approvedBy: feedback.reviewerId,
  };
}

function mapIssueToType(issue: string): CorrectionIngestion['corrections'][0]['issue']['type'] {
  const issueLower = issue.toLowerCase();
  if (issueLower.includes('fact') || issueLower.includes('wrong') || issueLower.includes('incorrect')) {
    return 'factual_error';
  }
  if (issueLower.includes('grade') || issueLower.includes('age') || issueLower.includes('level')) {
    return 'grade_inappropriate';
  }
  if (issueLower.includes('curriculum') || issueLower.includes('syllabus')) {
    return 'curriculum_mismatch';
  }
  if (issueLower.includes('incomplete') || issueLower.includes('missing')) {
    return 'incomplete_explanation';
  }
  if (issueLower.includes('confus') || issueLower.includes('unclear')) {
    return 'confusing_language';
  }
  if (issueLower.includes('example')) {
    return 'missing_example';
  }
  if (issueLower.includes('difficult') || issueLower.includes('easy') || issueLower.includes('hard')) {
    return 'wrong_difficulty';
  }
  return 'incomplete_explanation'; // Default
}

function mapIssueToRuleType(
  issueType: CorrectionIngestion['corrections'][0]['issue']['type']
): CorrectionIngestion['corrections'][0]['correctionRule']['ruleType'] {
  const mapping: Record<typeof issueType, typeof issueType extends any ? CorrectionIngestion['corrections'][0]['correctionRule']['ruleType'] : never> = {
    'factual_error': 'require_check',
    'grade_inappropriate': 'add_to_prompt',
    'curriculum_mismatch': 'add_to_prompt',
    'incomplete_explanation': 'add_to_prompt',
    'confusing_language': 'avoid_phrase',
    'missing_example': 'add_example',
    'wrong_difficulty': 'adjust_difficulty',
  };
  return mapping[issueType];
}

// ============================================================================
// REVIEWER ASSIGNMENT
// ============================================================================

/**
 * Assign pending items to available reviewers.
 */
export async function assignItemsToReviewer(
  reviewerId: string,
  store: ReviewQueueStore,
  config: ReviewQueueConfig = DEFAULT_REVIEW_CONFIG
): Promise<ReviewQueueItem[]> {
  // Get reviewer's current assignments
  const currentAssignments = await store.getItemsForReviewer(reviewerId);
  
  // Check daily limit
  const todayAssignments = currentAssignments.filter(item => {
    const assignedDate = item.assignedAt ? new Date(item.assignedAt) : null;
    const today = new Date();
    return assignedDate && 
           assignedDate.getDate() === today.getDate() &&
           assignedDate.getMonth() === today.getMonth() &&
           assignedDate.getFullYear() === today.getFullYear();
  });
  
  const remaining = config.maxItemsPerReviewerPerDay - todayAssignments.length;
  if (remaining <= 0) {
    return [];
  }
  
  // Get pending items by priority
  const criticalItems = await store.getPendingItems(ReviewPriority.CRITICAL, remaining);
  const highItems = await store.getPendingItems(ReviewPriority.HIGH, remaining - criticalItems.length);
  
  const itemsToAssign = [...criticalItems, ...highItems].slice(0, remaining);
  
  // Assign items
  const now = new Date().toISOString();
  for (const item of itemsToAssign) {
    await store.updateItem(item.id, {
      status: ReviewStatus.IN_REVIEW,
      assignedTo: reviewerId,
      assignedAt: now,
    });
  }
  
  return itemsToAssign;
}

// ============================================================================
// USER/PARENT REPORTING
// ============================================================================

/**
 * Create a review item from student/parent report.
 */
export function createReportedReviewItem(
  output: AIOutputForReview,
  reportType: 'student' | 'parent',
  reportDetails: string
): ReviewQueueItem {
  const reason = reportType === 'student' 
    ? FlagReason.STUDENT_REPORT 
    : FlagReason.PARENT_REPORT;
  
  const item = createReviewItem(output, reason, ReviewPriority.HIGH);
  
  // Add report details to automated flags
  item.automatedFlags = [
    ...(item.automatedFlags || []),
    {
      check: `${reportType}_report`,
      result: reportDetails,
      severity: 'warning',
    },
  ];
  
  return item;
}
