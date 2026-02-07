/**
 * FILE OBJECTIVE:
 * - Retry decision logic for AI failures.
 * - Determines when to retry, fallback, or escalate.
 * - Grade-aware retry strategies.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/prompts/fallbacks/retryLogic.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created retry decision logic
 */

import type { Grade } from '@/lib/ai/prompts/schemas';
import {
  type FailureDetails,
  type RetryDecision,
  FailureCategory,
  FailureReason,
  FallbackStrategy,
  makeRetryDecision,
  classifyFailure,
} from './failureTypes';
import {
  type FallbackTemplate,
  type ContentType,
  getFallbackTemplate,
  formatFallbackMessage,
} from './templates';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Complete retry context
 */
export interface RetryContext {
  /** Request ID for tracing */
  readonly requestId: string;
  /** Student's grade */
  readonly grade: Grade;
  /** Content type being processed */
  readonly contentType: ContentType;
  /** Original request parameters */
  readonly originalRequest: Record<string, unknown>;
  /** Number of attempts so far */
  readonly attemptNumber: number;
  /** Total time spent on retries (ms) */
  readonly totalRetryTimeMs: number;
  /** Maximum total retry time allowed (ms) */
  readonly maxRetryTimeMs: number;
  /** History of failures encountered during retries */
  readonly failures?: FailureDetails[];
  /** Context start time (ms since epoch) */
  readonly startTime?: number;
  /** Last failure category seen */
  readonly lastFailureCategory?: FailureCategory;
}

/**
 * Complete retry result
 */
export interface RetryResult {
  /** The decision made */
  readonly decision: RetryDecision;
  /** User-facing fallback message if not retrying */
  readonly fallbackMessage?: string;
  /** Fallback template if not retrying */
  readonly fallbackTemplate?: FallbackTemplate;
  /** Modified request for retry */
  readonly modifiedRequest?: Record<string, unknown>;
  /** Whether to show retry button to user */
  readonly showRetryButton: boolean;
  /** Whether to offer human help */
  readonly offerHumanHelp: boolean;
  /** Audit log entry */
  readonly auditEntry: RetryAuditEntry;
}

/**
 * Audit entry for retry decisions
 */
export interface RetryAuditEntry {
  readonly timestamp: Date;
  readonly requestId: string;
  readonly grade: Grade;
  readonly contentType: ContentType;
  readonly failureCategory: FailureCategory;
  readonly failureReason: FailureReason;
  readonly strategy: FallbackStrategy;
  readonly decision: 'RETRY' | 'FALLBACK' | 'ESCALATE';
  readonly attemptNumber: number;
  readonly reasoning: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum retry time by grade band.
 * 
 * REASONING:
 * - Junior students have less patience
 * - Senior students can wait longer for complex queries
 */
export const MAX_RETRY_TIME_BY_GRADE: Record<number, number> = {
  1: 5000,   // 5 seconds max for Grade 1
  2: 5000,
  3: 5000,
  4: 8000,   // 8 seconds for middle school
  5: 8000,
  6: 8000,
  7: 8000,
  8: 12000,  // 12 seconds for senior
  9: 12000,
  10: 15000, // 15 seconds for Grade 10 (board exam prep)
  11: 15000,
  12: 15000,
};

/**
 * Content type priority for retries.
 * Higher priority = more retries allowed.
 */
export const CONTENT_TYPE_PRIORITY: Record<ContentType, number> = {
  DOUBT: 3,    // Highest - student actively asking
  PRACTICE: 2, // Medium - can show different question
  QUIZ: 1,     // Low - can regenerate
  NOTES: 1,    // Low - can show cached/simpler version
};

// ============================================================================
// MAIN RETRY HANDLER
// ============================================================================

/**
 * Process a failure and determine retry/fallback action.
 * 
 * @param error - The error or failure that occurred
 * @param context - Complete retry context
 * @returns Complete retry result with decision and messages
 */
export function handleFailure(input: any, ...rest: any[]): RetryResult {
  // Support two call styles: tests provide a single object { requestId, feature, grade, failure, context }
  const isRequestShape = input && typeof input === 'object' && (input.failure || input.context || input.feature);

  let failureArg: any;
  let ctxArg: any;
  let requestId: string | undefined;
  let grade: Grade | undefined;
  let contentType: ContentType | undefined;

  if (isRequestShape) {
    failureArg = input.failure || input.failureDetails || input.error;
    ctxArg = input.context;
    requestId = input.requestId || ctxArg?.requestId;
    grade = input.grade ?? ctxArg?.grade;
    contentType = (input.feature || ctxArg?.contentType || 'NOTES').toString().toUpperCase() as ContentType;
  } else {
    // legacy signature: handleFailure(error, context?)
    failureArg = input;
    ctxArg = rest[0];
    requestId = ctxArg?.requestId;
    grade = ctxArg?.grade;
    contentType = ctxArg?.contentType;
  }

  const normalizedRequestId = requestId ?? 'unknown';
  const normalizedGrade = grade ?? (6 as any);
  const normalizedContentType = contentType ?? ('NOTES' as any);
  const attemptNumber = ctxArg?.attemptNumber ?? ctxArg?.attemptCount ?? 0;
  const totalRetryTimeMs = ctxArg?.totalRetryTimeMs ?? 0;

  const normalizedContext: RetryContext = {
    requestId: normalizedRequestId,
    grade: normalizedGrade,
    contentType: normalizedContentType,
    originalRequest: ctxArg?.originalRequest ?? {},
    attemptNumber,
    totalRetryTimeMs,
    maxRetryTimeMs: ctxArg?.maxRetryTimeMs ?? MAX_RETRY_TIME_BY_GRADE[normalizedGrade] ?? 10000,
    failures: ctxArg?.failures ?? [],
    startTime: ctxArg?.startTime ?? Date.now(),
    lastFailureCategory: ctxArg?.lastFailureCategory,
  } as RetryContext;

  // If caller provided a canonical failure object, use it directly; otherwise classify
  let failure: FailureDetails;
  if (failureArg && typeof failureArg === 'object' && typeof failureArg.category !== 'undefined') {
    failure = {
      category: failureArg.category,
      reason: failureArg.reason ?? (failureArg.aiConfidence ? FailureReason.CONFIDENCE_BELOW_THRESHOLD : FailureReason.API_TIMEOUT),
      description: failureArg.description ?? '',
      originalError: failureArg.originalError ?? (failureArg.error instanceof Error ? failureArg.error : undefined),
      confidenceScore: failureArg.aiConfidence ?? failureArg.confidenceScore,
      details: failureArg.details ?? failureArg.validationErrors ? { validationErrors: failureArg.validationErrors } : undefined,
      // Use explicit attemptNumber when provided by context so exhausted attempts are recognized
      retryCount: typeof failureArg.retryCount === 'number' ? failureArg.retryCount : (typeof failureArg.attemptNumber === 'number' ? failureArg.attemptNumber : attemptNumber),
      timestamp: failureArg.timestamp ? new Date(failureArg.timestamp) : new Date(),
      requestId: failureArg.requestId ?? normalizedContext.requestId,
    } as FailureDetails;
  } else {
    // Classify the failure
    failure = classifyFailure(failureArg, normalizedRequestId, attemptNumber);
  }

  // Make base retry decision
  const baseDecision = makeRetryDecision(failure);

  // Apply grade-specific adjustments
  const adjustedDecision = applyGradeAdjustments(baseDecision, normalizedContext, failure);

  // Apply time budget check
  const finalDecision = applyTimeBudget(adjustedDecision, normalizedContext);

  // Generate fallback message if not retrying
  let fallbackMessage: string | undefined;
  let fallbackTemplate: FallbackTemplate | undefined;
  if (!finalDecision.shouldRetry) {
    const strategy = finalDecision.strategy;
    fallbackTemplate = getFallbackTemplate(normalizedGrade, strategy, normalizedContentType, failure.reason);
    fallbackMessage = formatFallbackMessage(fallbackTemplate);
  }

  // Build modified request for retry
  let modifiedRequest: Record<string, unknown> | undefined;
  if (finalDecision.shouldRetry && finalDecision.modifiedParams) {
    modifiedRequest = {
      ...(normalizedContext.originalRequest || {}),
      ...finalDecision.modifiedParams,
      _retryAttempt: normalizedContext.attemptNumber + 1,
    };
  }

  // Create audit entry
  const auditEntry: RetryAuditEntry = {
    timestamp: new Date(),
    requestId: normalizedContext.requestId,
    grade: normalizedContext.grade,
    contentType: normalizedContext.contentType,
    failureCategory: failure.category,
    failureReason: failure.reason,
    strategy: finalDecision.strategy,
    decision: finalDecision.shouldRetry ? 'RETRY' : finalDecision.strategy === FallbackStrategy.HUMAN_ESCALATION ? 'ESCALATE' : 'FALLBACK',
    attemptNumber: normalizedContext.attemptNumber + 1,
    reasoning: finalDecision.reasoning,
  };

  // Return shape expected by tests
  const action = auditEntry.decision;
  return {
    decision: finalDecision,
    fallbackMessage,
    fallbackTemplate,
    modifiedRequest,
    showRetryButton: fallbackTemplate?.showRetry ?? false,
    offerHumanHelp: fallbackTemplate?.offerHumanHelp ?? false,
    auditEntry,
    // test-friendly aliases
    action,
    retryConfig: finalDecision,
    audit: auditEntry,
  } as unknown as RetryResult;
}

/**
 * Apply grade-specific adjustments to retry decision.
 */
function applyGradeAdjustments(
  decision: RetryDecision,
  context: RetryContext,
  failure: FailureDetails
): RetryDecision {
  // Junior grades (1-3): Be more protective
  if (context.grade <= 3) {
    // Don't retry more than once for junior students (reduces confusion)
    if (context.attemptNumber >= 1) {
      return {
        ...decision,
        shouldRetry: false,
        strategy: FallbackStrategy.SAFE_RESPONSE,
        reasoning: `${decision.reasoning} [Adjusted: Junior grade max 1 retry]`,
      };
    }
    
    // Always use safe response for content issues (never show confusing content)
    if (failure.category === FailureCategory.CONTENT_ISSUE) {
      return {
        ...decision,
        shouldRetry: false,
        strategy: FallbackStrategy.SAFE_RESPONSE,
        reasoning: `${decision.reasoning} [Adjusted: Junior grade content protection]`,
      };
    }
  }
  
  // Senior grades (8+): Allow more retries for exam prep
  if (context.grade >= 8 && context.contentType === 'PRACTICE') {
    // Double max retries for practice questions
    return {
      ...decision,
      maxRetries: decision.maxRetries * 2,
      reasoning: `${decision.reasoning} [Adjusted: Senior grade practice priority]`,
    };
  }
  
  return decision;
}

/**
 * Apply time budget constraints to retry decision.
 */
function applyTimeBudget(
  decision: RetryDecision,
  context: RetryContext
): RetryDecision {
  const maxTime = MAX_RETRY_TIME_BY_GRADE[context.grade] ?? 10000;
  const remainingTime = maxTime - context.totalRetryTimeMs;
  
  // Not enough time for retry
  if (decision.shouldRetry && decision.delayMs > remainingTime) {
    return {
      ...decision,
      shouldRetry: false,
      strategy: FallbackStrategy.SAFE_RESPONSE,
      reasoning: `${decision.reasoning} [Adjusted: Time budget exceeded (${context.totalRetryTimeMs}ms/${maxTime}ms)]`,
    };
  }
  
  // Total time would exceed budget
  if (decision.shouldRetry && context.totalRetryTimeMs + decision.delayMs > maxTime) {
    return {
      ...decision,
      shouldRetry: false,
      strategy: FallbackStrategy.SAFE_RESPONSE,
      reasoning: `${decision.reasoning} [Adjusted: Would exceed time budget]`,
    };
  }
  
  return decision;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create initial retry context
 */
export function createRetryContext(opts: { requestId: string; feature: string; grade: Grade; originalRequest?: Record<string, unknown> }): RetryContext {
  const contentType = (opts.feature || 'notes').toString().toUpperCase() as ContentType;
  const grade = opts.grade;
  return {
    requestId: opts.requestId,
    grade,
    contentType,
    originalRequest: opts.originalRequest ?? {},
    attemptNumber: 0,
    totalRetryTimeMs: 0,
    maxRetryTimeMs: MAX_RETRY_TIME_BY_GRADE[grade] ?? 10000,
    failures: [],
    startTime: Date.now(),
    lastFailureCategory: undefined,
  } as RetryContext;
}

/**
 * Update retry context after an attempt
 */
export function updateRetryContext(
  context: RetryContext,
  failure: FailureDetails
): RetryContext {
  const nextFailures = (context.failures || []).concat(failure);
  return {
    ...context,
    attemptNumber: (context.attemptNumber || 0) + 1,
    failures: nextFailures,
    lastFailureCategory: failure.category,
  } as RetryContext;
}

/**
 * Check if retry is still possible
 */
export function canRetry(context: RetryContext): boolean {
  const maxTime = MAX_RETRY_TIME_BY_GRADE[context.grade] ?? 10000;
  return context.totalRetryTimeMs < maxTime;
}

/**
 * Get simplified prompt for retry
 */
export function getSimplifiedPrompt(
  originalPrompt: string,
  grade: Grade
): string {
  // Remove complex instructions for junior grades
  if (grade <= 3) {
    return originalPrompt
      .replace(/detailed|comprehensive|extensive/gi, 'simple')
      .replace(/analyze|evaluate|synthesize/gi, 'explain')
      .substring(0, 500); // Limit length
  }
  
  // Moderate simplification for middle grades
  if (grade <= 7) {
    return originalPrompt
      .replace(/comprehensive/gi, 'clear')
      .substring(0, 800);
  }
  
  // Minimal simplification for senior grades
  return originalPrompt.substring(0, 1200);
}
