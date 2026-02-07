/**
 * FILE OBJECTIVE:
 * - Barrel export for expert review pipeline.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/expertReview/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// Schemas & Types
export {
  FlagReason,
  ReviewPriority,
  ReviewStatus,
  OutputType,
  ReviewQueueItemSchema,
  ReviewFeedbackSchema,
  CorrectionIngestionSchema,
  QueueStatisticsSchema,
  DEFAULT_REVIEW_CONFIG,
  type ReviewQueueItem,
  type ReviewFeedback,
  type CorrectionIngestion,
  type QueueStatistics,
  type ReviewQueueConfig,
} from './schemas';

// Pipeline
export {
  shouldFlagForReview,
  createReviewItem,
  processReviewFeedback,
  assignItemsToReviewer,
  createReportedReviewItem,
  type ReviewQueueStore,
  type AIOutputForReview,
} from './pipeline';
