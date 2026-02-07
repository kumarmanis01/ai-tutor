/**
 * FILE OBJECTIVE:
 * - Barrel export for fallback/retry module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/prompts/fallbacks/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// Failure types and classification
export {
  FailureCategory,
  FailureReason,
  FallbackStrategy,
  type FailureDetails,
  type RetryDecision,
  FAILURE_STRATEGY_MAP,
  MAX_RETRIES,
  BASE_RETRY_DELAY,
  makeRetryDecision,
  classifyFailure,
} from './failureTypes';

// Fallback templates
export {
  type GradeBand,
  type FallbackTemplate,
  type ContentType,
  getGradeBand,
  JUNIOR_TEMPLATES,
  MIDDLE_TEMPLATES,
  SENIOR_TEMPLATES,
  FALLBACK_TEMPLATES,
  getContentTypeFallback,
  getFailureReasonFallback,
  getFallbackTemplate,
  formatFallbackMessage,
} from './templates';

// Retry logic
export {
  type RetryContext,
  type RetryResult,
  type RetryAuditEntry,
  MAX_RETRY_TIME_BY_GRADE,
  CONTENT_TYPE_PRIORITY,
  handleFailure,
  createRetryContext,
  updateRetryContext,
  canRetry,
  getSimplifiedPrompt,
} from './retryLogic';
