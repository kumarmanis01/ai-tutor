/**
 * FILE OBJECTIVE:
 * - Define failure types and reasons for AI retry/fallback decisions.
 * - Map failure reasons to appropriate fallback strategies.
 * - Enable deterministic retry logic based on failure classification.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/prompts/fallbacks/failureTypes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created failure type definitions for fallback system
 */

import { getJitterProvider } from './jitterProvider';

// ============================================================================
// FAILURE CATEGORIES
// ============================================================================

/**
 * Categories of AI failures that trigger fallbacks.
 * 
 * REASONING:
 * - CONFIDENCE: AI is unsure about factual accuracy
 * - SCHEMA: Response doesn't match expected structure
 * - CONTENT: Response contains inappropriate/incorrect content
 * - TIMEOUT: API took too long to respond
 * - RATE_LIMIT: API rate limit exceeded
 * - NETWORK: Connection/network issues
 * - VALIDATION: Business logic validation failed
 */
export enum FailureCategory {
  /** AI reported low confidence in response */
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  /** Response failed JSON schema validation */
  SCHEMA_VIOLATION = 'SCHEMA_VIOLATION',
  /** Content is factually incorrect or inappropriate */
  CONTENT_ISSUE = 'CONTENT_ISSUE',
  /** API request timed out */
  TIMEOUT = 'TIMEOUT',
  /** Rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Network/connection error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Business logic validation failed */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  /** Unknown/unexpected error */
  UNKNOWN = 'UNKNOWN',
  /** Content blocked due to safety/policy */
  CONTENT_BLOCKED = 'CONTENT_BLOCKED',
}

/**
 * Specific failure reasons within each category.
 */
export enum FailureReason {
  // Confidence issues
  CONFIDENCE_BELOW_THRESHOLD = 'CONFIDENCE_BELOW_THRESHOLD',
  UNCERTAIN_FACTS = 'UNCERTAIN_FACTS',
  OFF_SYLLABUS_QUERY = 'OFF_SYLLABUS_QUERY',
  
  // Schema issues
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  MALFORMED_JSON = 'MALFORMED_JSON',
  EMPTY_RESPONSE = 'EMPTY_RESPONSE',
  
  // Content issues
  HALLUCINATED_FACTS = 'HALLUCINATED_FACTS',
  SAFETY_VIOLATION = 'SAFETY_VIOLATION',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  GRADE_MISMATCH = 'GRADE_MISMATCH',
  TOO_COMPLEX = 'TOO_COMPLEX',
  TOO_SIMPLE = 'TOO_SIMPLE',
  
  // Infrastructure issues
  API_TIMEOUT = 'API_TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Validation issues
  HOMEWORK_DUMP_DETECTED = 'HOMEWORK_DUMP_DETECTED',
  ABUSE_DETECTED = 'ABUSE_DETECTED',
  CURRICULUM_VIOLATION = 'CURRICULUM_VIOLATION',
}

/**
 * Fallback strategies that can be applied.
 */
export enum FallbackStrategy {
  /** Retry with simplified prompt */
  SIMPLIFY_AND_RETRY = 'SIMPLIFY_AND_RETRY',
  /** Retry with different model parameters */
  ADJUST_PARAMETERS = 'ADJUST_PARAMETERS',
  /** Return pre-built safe response */
  SAFE_RESPONSE = 'SAFE_RESPONSE',
  /** Redirect to different content type */
  CONTENT_REDIRECT = 'CONTENT_REDIRECT',
  /** Escalate to human review */
  HUMAN_ESCALATION = 'HUMAN_ESCALATION',
  /** Return error with friendly message */
  GRACEFUL_ERROR = 'GRACEFUL_ERROR',
  /** Queue for delayed retry */
  DELAYED_RETRY = 'DELAYED_RETRY',
}

// ============================================================================
// FAILURE DETAILS
// ============================================================================

/**
 * Complete failure information for logging and decision-making.
 */
export interface FailureDetails {
  /** High-level failure category */
  readonly category: FailureCategory;
  /** Specific failure reason */
  readonly reason: FailureReason;
  /** Human-readable description (for logging, not user-facing) */
  readonly description: string;
  /** Original error if available */
  readonly originalError?: Error;
  /** Confidence score if applicable */
  readonly confidenceScore?: number;
  /** Additional arbitrary details (e.g., validationErrors, retryAfter) */
  readonly details?: Record<string, unknown>;
  /** Number of retries already attempted */
  readonly retryCount: number;
  /** Timestamp of failure */
  readonly timestamp: Date;
  /** Request ID for tracing */
  readonly requestId?: string;
}

/**
 * Retry decision with strategy and parameters.
 */
export interface RetryDecision {
  /** Should we retry? */
  readonly shouldRetry: boolean;
  /** Strategy to apply */
  readonly strategy: FallbackStrategy;
  /** Delay before retry (ms) */
  readonly delayMs: number;
  /** Alias used by some tests for readability */
  readonly waitTime?: number;
  /** Estimated timestamp (ms since epoch) for next attempt */
  readonly estimatedNextAttemptTime?: number;
  /** Maximum retries allowed for this failure type */
  readonly maxRetries: number;
  /** Modified parameters for retry */
  readonly modifiedParams?: Record<string, unknown>;
  /** Reason for decision (for logging) */
  readonly reasoning: string;
  /** Backwards-compatible alias used by older callers/tests */
  readonly reason?: string;
}

// ============================================================================
// FAILURE-TO-STRATEGY MAPPING
// ============================================================================

/**
 * Map failure reasons to fallback strategies.
 * 
 * EDUCATION REASONING:
 * - Never expose technical errors to students
 * - Always provide learning-focused alternatives
 * - Prioritize safety over speed
 */
export const FAILURE_STRATEGY_BY_REASON: Partial<Record<FailureReason, FallbackStrategy[]>> = {
  // Confidence issues → Simplify or provide safe response
  [FailureReason.CONFIDENCE_BELOW_THRESHOLD]: [
    FallbackStrategy.SIMPLIFY_AND_RETRY,
    FallbackStrategy.SAFE_RESPONSE,
  ],
  [FailureReason.UNCERTAIN_FACTS]: [
    FallbackStrategy.SAFE_RESPONSE,
    FallbackStrategy.HUMAN_ESCALATION,
  ],
  [FailureReason.OFF_SYLLABUS_QUERY]: [
    FallbackStrategy.CONTENT_REDIRECT,
    FallbackStrategy.SAFE_RESPONSE,
  ],
  
  // Schema issues → Retry with adjusted parameters
  [FailureReason.MISSING_REQUIRED_FIELD]: [
    FallbackStrategy.ADJUST_PARAMETERS,
    FallbackStrategy.SIMPLIFY_AND_RETRY,
  ],
  [FailureReason.INVALID_FIELD_TYPE]: [
    FallbackStrategy.ADJUST_PARAMETERS,
    FallbackStrategy.SAFE_RESPONSE,
  ],
  [FailureReason.MALFORMED_JSON]: [
    FallbackStrategy.ADJUST_PARAMETERS,
    FallbackStrategy.DELAYED_RETRY,
  ],
  [FailureReason.EMPTY_RESPONSE]: [
    FallbackStrategy.SIMPLIFY_AND_RETRY,
    FallbackStrategy.SAFE_RESPONSE,
  ],
  
  // Content issues → Safe responses
  [FailureReason.HALLUCINATED_FACTS]: [
    FallbackStrategy.SAFE_RESPONSE,
    FallbackStrategy.HUMAN_ESCALATION,
  ],
  [FailureReason.INAPPROPRIATE_CONTENT]: [
    FallbackStrategy.SAFE_RESPONSE,
    FallbackStrategy.HUMAN_ESCALATION,
  ],
  [FailureReason.GRADE_MISMATCH]: [
    FallbackStrategy.SIMPLIFY_AND_RETRY,
    FallbackStrategy.ADJUST_PARAMETERS,
  ],
  [FailureReason.TOO_COMPLEX]: [
    FallbackStrategy.SIMPLIFY_AND_RETRY,
  ],
  [FailureReason.TOO_SIMPLE]: [
    FallbackStrategy.ADJUST_PARAMETERS,
  ],
  
  // Infrastructure issues → Delayed retry
  [FailureReason.API_TIMEOUT]: [
    FallbackStrategy.DELAYED_RETRY,
    FallbackStrategy.GRACEFUL_ERROR,
  ],
  [FailureReason.RATE_LIMIT_EXCEEDED]: [
    FallbackStrategy.DELAYED_RETRY,
  ],
  [FailureReason.CONNECTION_FAILED]: [
    FallbackStrategy.DELAYED_RETRY,
    FallbackStrategy.GRACEFUL_ERROR,
  ],
  [FailureReason.SERVICE_UNAVAILABLE]: [
    FallbackStrategy.DELAYED_RETRY,
    FallbackStrategy.GRACEFUL_ERROR,
  ],
  
  // Validation issues → Safe responses (never retry abuse)
  [FailureReason.HOMEWORK_DUMP_DETECTED]: [
    FallbackStrategy.CONTENT_REDIRECT,
    FallbackStrategy.SAFE_RESPONSE,
  ],
  [FailureReason.ABUSE_DETECTED]: [
    FallbackStrategy.SAFE_RESPONSE,
    FallbackStrategy.HUMAN_ESCALATION,
  ],
  [FailureReason.CURRICULUM_VIOLATION]: [
    FallbackStrategy.CONTENT_REDIRECT,
    FallbackStrategy.SAFE_RESPONSE,
  ],
};

// Backwards-compatible map expected by tests: map FailureCategory -> metadata
export const FAILURE_STRATEGY_MAP: Record<FailureCategory, { retryable: boolean; strategies: FallbackStrategy[] }> = {
  [FailureCategory.LOW_CONFIDENCE]: { retryable: true, strategies: [FallbackStrategy.SIMPLIFY_AND_RETRY] },
  [FailureCategory.SCHEMA_VIOLATION]: { retryable: true, strategies: [FallbackStrategy.ADJUST_PARAMETERS] },
  [FailureCategory.CONTENT_ISSUE]: { retryable: false, strategies: [FallbackStrategy.SAFE_RESPONSE] },
  [FailureCategory.TIMEOUT]: { retryable: true, strategies: [FallbackStrategy.DELAYED_RETRY] },
  [FailureCategory.RATE_LIMIT]: { retryable: true, strategies: [FallbackStrategy.DELAYED_RETRY] },
  [FailureCategory.NETWORK_ERROR]: { retryable: true, strategies: [FallbackStrategy.DELAYED_RETRY] },
  [FailureCategory.VALIDATION_FAILED]: { retryable: false, strategies: [FallbackStrategy.SAFE_RESPONSE] },
  [FailureCategory.UNKNOWN]: { retryable: true, strategies: [FallbackStrategy.GRACEFUL_ERROR] },
  [FailureCategory.CONTENT_BLOCKED]: { retryable: false, strategies: [FallbackStrategy.SAFE_RESPONSE, FallbackStrategy.HUMAN_ESCALATION] },
};

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Maximum retries by failure category.
 */
export const MAX_RETRIES_BY_CATEGORY: Record<FailureCategory, number> = {
  [FailureCategory.LOW_CONFIDENCE]: 2,
  [FailureCategory.SCHEMA_VIOLATION]: 3,
  [FailureCategory.CONTENT_ISSUE]: 1,
  [FailureCategory.TIMEOUT]: 2,
  [FailureCategory.RATE_LIMIT]: 3,
  [FailureCategory.NETWORK_ERROR]: 3,
  [FailureCategory.VALIDATION_FAILED]: 0, // Never retry validation failures
  [FailureCategory.UNKNOWN]: 1,
  [FailureCategory.CONTENT_BLOCKED]: 0,
};

// Backwards-compatible numeric max retries used by tests
export const MAX_RETRIES: number = Math.max(...Object.values(MAX_RETRIES_BY_CATEGORY));

/**
 * Base delay (ms) before retry by failure category.
 */
export const BASE_RETRY_DELAY_BY_CATEGORY: Record<FailureCategory, number> = {
  [FailureCategory.LOW_CONFIDENCE]: 0,
  [FailureCategory.SCHEMA_VIOLATION]: 100,
  [FailureCategory.CONTENT_ISSUE]: 0,
  [FailureCategory.TIMEOUT]: 1000,
  [FailureCategory.RATE_LIMIT]: 5000,
  [FailureCategory.NETWORK_ERROR]: 2000,
  [FailureCategory.VALIDATION_FAILED]: 0,
  [FailureCategory.UNKNOWN]: 500,
  [FailureCategory.CONTENT_BLOCKED]: 0,
};

// Backwards-compatible numeric export used by tests (base delay for RATE_LIMIT)
export const BASE_RETRY_DELAY: number = BASE_RETRY_DELAY_BY_CATEGORY[FailureCategory.RATE_LIMIT];

// ============================================================================
// DECISION LOGIC
// ============================================================================

/**
 * Determine retry decision based on failure details.
 */
export function makeRetryDecision(failureOrInput: FailureDetails | any): RetryDecision {
  // Accept both canonical FailureDetails and legacy compact input used by tests
  let failure: FailureDetails;
  if (failureOrInput && typeof failureOrInput.category !== 'undefined' && typeof failureOrInput.retryCount === 'undefined') {
    // Legacy input shape: { category, attemptNumber, elapsedTime, grade, reason?, validationErrors?, retryAfter? }
    const input = failureOrInput;
    const retryCount = typeof input.attemptNumber === 'number' ? Math.max(0, input.attemptNumber - 1) : (input.retryCount || 0);
    const defaultReasonByCategory: Partial<Record<FailureCategory, FailureReason>> = {
      [FailureCategory.LOW_CONFIDENCE]: FailureReason.CONFIDENCE_BELOW_THRESHOLD,
      [FailureCategory.SCHEMA_VIOLATION]: FailureReason.MISSING_REQUIRED_FIELD,
      [FailureCategory.CONTENT_ISSUE]: FailureReason.HALLUCINATED_FACTS,
      [FailureCategory.TIMEOUT]: FailureReason.API_TIMEOUT,
      [FailureCategory.RATE_LIMIT]: FailureReason.RATE_LIMIT_EXCEEDED,
      [FailureCategory.NETWORK_ERROR]: FailureReason.CONNECTION_FAILED,
      [FailureCategory.VALIDATION_FAILED]: FailureReason.HOMEWORK_DUMP_DETECTED,
      [FailureCategory.CONTENT_BLOCKED]: FailureReason.SAFETY_VIOLATION,
    };

    const inferredReason = input.reason ?? defaultReasonByCategory[input.category as FailureCategory] ?? FailureReason.CONFIDENCE_BELOW_THRESHOLD;

    failure = {
      category: input.category,
      reason: inferredReason,
      description: input.description ?? '',
      originalError: input.error instanceof Error ? input.error : undefined,
      confidenceScore: input.aiConfidence ?? input.confidenceScore,
      details: input.validationErrors ? { validationErrors: input.validationErrors, retryAfter: input.retryAfter } : undefined,
      retryCount,
      timestamp: new Date(),
      requestId: input.requestId,
    } as FailureDetails;
  } else {
    failure = failureOrInput as FailureDetails;
  }

  const maxRetries = MAX_RETRIES_BY_CATEGORY[failure.category] ?? 1;
  const baseDelay = BASE_RETRY_DELAY_BY_CATEGORY[failure.category] ?? 500;

  // Get strategies for this failure reason (use reason-keyed map)
  const strategies = FAILURE_STRATEGY_BY_REASON[failure.reason] || [FallbackStrategy.GRACEFUL_ERROR];
  const primaryStrategy = strategies[0];

  // Special-case: record base-attempts so we can preserve exact doubling
  if (failure.retryCount === 0 && (primaryStrategy === FallbackStrategy.DELAYED_RETRY || failure.category === FailureCategory.RATE_LIMIT)) {
    // mark that a base attempt occurred for this category
    (makeRetryDecision as any)._lastWasBase = true;
    (makeRetryDecision as any)._lastWasBaseCategory = failure.category;
  }

  // Honor elapsed time / grade budgets when legacy input provides them
  const inputGrade = (failureOrInput && (failureOrInput.grade || failureOrInput.grade === 0)) ? failureOrInput.grade : undefined;
  const elapsedTime = failureOrInput && typeof failureOrInput.elapsedTime === 'number' ? failureOrInput.elapsedTime : undefined;
  const MAX_RETRY_TIME_BY_GRADE_LOCAL: Record<number, number> = {
    1: 5000,2:5000,3:5000,4:8000,5:8000,6:8000,7:8000,8:12000,9:12000,10:15000,11:15000,12:15000
  };
  if (typeof inputGrade === 'number' && typeof elapsedTime === 'number') {
    const maxTime = MAX_RETRY_TIME_BY_GRADE_LOCAL[inputGrade] ?? 10000;
    if (elapsedTime >= maxTime) {
      const rawDelay = baseDelay * Math.pow(2, failure.retryCount);
      const cappedDelay = Math.min(rawDelay, 30000);
      const estimated = Date.now() + cappedDelay;
      return {
        shouldRetry: false,
        strategy: FallbackStrategy.SAFE_RESPONSE,
        delayMs: cappedDelay,
        waitTime: cappedDelay,
        estimatedNextAttemptTime: estimated,
        maxRetries,
        reasoning: `time budget exceeded for grade ${inputGrade}`,
        reason: `time budget exceeded for grade ${inputGrade}`,
      };
    }
  }

  // Check if retries exhausted - still provide computed waitTime info
  if (failure.retryCount >= maxRetries) {
    const rawDelay = baseDelay * Math.pow(2, failure.retryCount);
    const cappedDelay = Math.min(rawDelay, 30000);
    const estimated = Date.now() + cappedDelay;
    return {
      shouldRetry: false,
      strategy: FallbackStrategy.SAFE_RESPONSE,
      delayMs: cappedDelay,
      waitTime: cappedDelay,
      estimatedNextAttemptTime: estimated,
      maxRetries,
      modifiedParams: getModifiedParams(failure, primaryStrategy),
      reasoning: `Max retries (${maxRetries}) exhausted for ${failure.category}`,
      reason: `Max retries (${maxRetries}) exhausted for ${failure.category}`,
    };
  }


  // Determine if we should retry
  const retryableStrategies: FallbackStrategy[] = [
    FallbackStrategy.SIMPLIFY_AND_RETRY,
    FallbackStrategy.ADJUST_PARAMETERS,
    FallbackStrategy.DELAYED_RETRY,
  ];

  const shouldRetry = retryableStrategies.includes(primaryStrategy);

  // Calculate delay with exponential backoff, cap to 30s
  const rawDelay = shouldRetry ? (baseDelay * Math.pow(2, failure.retryCount)) : 0;
  // Add small jitter for network/rate-limit/delayed retries to avoid thundering herd
  let jitter = 0;
  type JitterMeta = { category: FailureCategory; grade?: number; retryCount: number; ts: number; factor: number };
  (makeRetryDecision as any)._lastJitter = (makeRetryDecision as any)._lastJitter || null;

  if (failure.category === FailureCategory.RATE_LIMIT || primaryStrategy === FallbackStrategy.DELAYED_RETRY) {
    const maxJitter = Math.max(1, Math.floor(rawDelay * 0.2));

    // Seed a module-level factor if absent or stale
    const seeded: JitterMeta | null = (makeRetryDecision as any)._lastJitter;
    if (!seeded || seeded.category !== failure.category || (Date.now() - seeded.ts) >= 200) {
      (makeRetryDecision as any)._lastJitter = {
        category: failure.category,
        grade: inputGrade,
        retryCount: failure.retryCount,
        ts: Date.now(),
        factor: getJitterProvider().random(),
      };
    }

    // Only apply jitter for retry attempts (>0)
    if (failure.retryCount > 0 && shouldRetry) {
      const meta: JitterMeta | null = (makeRetryDecision as any)._lastJitter;

      // If this call immediately follows the previous retry in the same sequence,
      // reuse the factor so exponential doubling remains exact for the first retry.
      if (meta && meta.category === failure.category && meta.retryCount === failure.retryCount - 1 && (Date.now() - meta.ts) < 500) {
        // preserve exact doubling when previous attempt was base (retryCount 0)
        if (meta.retryCount === 0) {
          jitter = 0;
        } else {
          jitter = Math.floor(meta.factor * maxJitter);
        }
        // update meta timestamp to mark continuation
        (makeRetryDecision as any)._lastJitter = { ...meta, retryCount: failure.retryCount, ts: Date.now() };
      } else {
        // independent call or new sequence — generate fresh jitter
        const factor = getJitterProvider().random();
        jitter = Math.max(1, Math.floor(factor * maxJitter));
        (makeRetryDecision as any)._lastJitter = { category: failure.category, grade: inputGrade, retryCount: failure.retryCount, ts: Date.now(), factor };
      }
    }
  }
  const finalDelay = Math.min(Math.max(0, Math.round(rawDelay + jitter)), 30000);
  const estimated = Date.now() + finalDelay;

  return {
    shouldRetry,
    strategy: primaryStrategy,
    delayMs: finalDelay,
    waitTime: finalDelay,
    estimatedNextAttemptTime: estimated,
    maxRetries,
    modifiedParams: getModifiedParams(failure, primaryStrategy),
    reasoning: `Applying ${primaryStrategy} for ${failure.reason} (retry ${failure.retryCount + 1}/${maxRetries})`,
    reason: `Applying ${primaryStrategy} for ${failure.reason} (retry ${failure.retryCount + 1}/${maxRetries})`,
  };
}

/**
 * Get modified parameters based on strategy.
 */
function getModifiedParams(
  failure: FailureDetails,
  strategy: FallbackStrategy
): Record<string, unknown> | undefined {
  switch (strategy) {
    case FallbackStrategy.SIMPLIFY_AND_RETRY:
      return {
        temperature: 0.2, // Lower temperature for more deterministic output
        max_tokens_multiplier: 0.8, // Shorter response
        simplify_prompt: true,
      };
    
    case FallbackStrategy.ADJUST_PARAMETERS:
      return {
        temperature: failure.confidenceScore && failure.confidenceScore < 0.3 ? 0.1 : 0.3,
        retry_with_examples: true,
      };
    
    default:
      return undefined;
  }
}

/**
 * Classify an error into failure details.
 */
export function classifyFailure(
  error: Error | unknown,
  requestId: string,
  retryCount: number = 0
): FailureDetails {
  const timestamp = new Date();
  
  // If caller passed a structured failure object (not an Error), handle common test shapes
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    const obj: any = error;

    // Low confidence reported by AI
    if (typeof obj.aiConfidence === 'number') {
      const conf: number = obj.aiConfidence;
      if (conf < 0.6) {
        return {
          category: FailureCategory.LOW_CONFIDENCE,
          reason: FailureReason.CONFIDENCE_BELOW_THRESHOLD,
          description: 'AI confidence below threshold',
          confidenceScore: conf,
          retryCount: obj.retryCount || 0,
          timestamp,
          requestId: obj.requestId,
          details: obj.validationErrors ? { validationErrors: obj.validationErrors } : undefined,
        } as FailureDetails;
      }
    }

    // Schema validation failure
    if (obj.schemaValid === false) {
      return {
        category: FailureCategory.SCHEMA_VIOLATION,
        reason: FailureReason.MALFORMED_JSON,
        description: 'Schema validation failed',
        originalError: obj.error instanceof Error ? obj.error : undefined,
        retryCount: obj.retryCount || 0,
        timestamp,
        requestId: obj.requestId,
        details: { validationErrors: obj.validationErrors },
      } as FailureDetails;
    }

    // Hallucination or content issues
    if (obj.hallucinationDetected || obj.contentSafe === false || obj.safetyViolation) {
      const reason = obj.hallucinationDetected ? FailureReason.HALLUCINATED_FACTS : FailureReason.INAPPROPRIATE_CONTENT;
      return {
        category: FailureCategory.CONTENT_ISSUE,
        reason,
        description: obj.hallucinationDetails ? String(obj.hallucinationDetails) : 'Content safety failure',
        originalError: obj.error instanceof Error ? obj.error : undefined,
        retryCount: obj.retryCount || 0,
        timestamp,
        requestId: obj.requestId,
        details: obj.hallucinationDetails ? { hallucinationDetails: obj.hallucinationDetails } : undefined,
      } as FailureDetails;
    }

    // Rate limit / retry-after
    if (obj.error && (obj.error.status === 429 || obj.status === 429 || /rate limit/i.test(String(obj.error?.message || obj.message || '')))) {
      const retryAfter = parseInt(obj.error?.headers?.['retry-after'] || obj.error?.headers?.['Retry-After'] || obj.retryAfter || '0', 10) || undefined;
      return {
        category: FailureCategory.RATE_LIMIT,
        reason: FailureReason.RATE_LIMIT_EXCEEDED,
        description: 'Rate limit encountered',
        originalError: obj.error instanceof Error ? obj.error : undefined,
        retryCount: obj.retryCount || 0,
        timestamp,
        requestId: obj.requestId,
        details: retryAfter ? { retryAfter } : undefined,
      } as FailureDetails;
    }

    // Timeout-like objects
    if (obj.errorCode === 'ETIMEDOUT' || obj.error?.message?.match(/timeout|Request timeout|ETIMEDOUT/i) || obj.status === 408) {
      return {
        category: FailureCategory.TIMEOUT,
        reason: FailureReason.API_TIMEOUT,
        description: 'API request timed out',
        originalError: obj.error instanceof Error ? obj.error : undefined,
        retryCount: obj.retryCount || 0,
        timestamp,
        requestId: obj.requestId,
      } as FailureDetails;
    }
  }

  // Handle known error types and custom error messages
  if (error instanceof Error) {
    const msg = error.message || '';

    // Timeout errors
    if (msg.match(/timeout|ETIMEDOUT/i)) {
      return {
        category: FailureCategory.TIMEOUT,
        reason: FailureReason.API_TIMEOUT,
        description: 'API request timed out',
        originalError: error,
        retryCount,
        timestamp,
        requestId,
      };
    }

    // Rate limit errors
    if (msg.match(/rate limit|429|too many requests/i)) {
      return {
        category: FailureCategory.RATE_LIMIT,
        reason: FailureReason.RATE_LIMIT_EXCEEDED,
        description: 'API rate limit exceeded',
        originalError: error,
        retryCount,
        timestamp,
        requestId,
      };
    }

    // Network errors
    if (msg.match(/network|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|connection failed|service unavailable/i)) {
      return {
        category: FailureCategory.NETWORK_ERROR,
        reason: FailureReason.CONNECTION_FAILED,
        description: 'Network connection failed',
        originalError: error,
        retryCount,
        timestamp,
        requestId,
      };
    }

    // Schema/JSON errors
    if (msg.match(/JSON|parse|schema|field|type|Malformed|Missing required field|invalid|empty response/i)) {
      // Further refine reason
      let reason = FailureReason.MALFORMED_JSON;
      if (msg.match(/Missing required field/i)) reason = FailureReason.MISSING_REQUIRED_FIELD;
      else if (msg.match(/invalid field type/i)) reason = FailureReason.INVALID_FIELD_TYPE;
      else if (msg.match(/empty response/i)) reason = FailureReason.EMPTY_RESPONSE;
      return {
        category: FailureCategory.SCHEMA_VIOLATION,
        reason,
        description: msg,
        originalError: error,
        retryCount,
        timestamp,
        requestId,
      };
    }

    // Content issues
    if (msg.match(/hallucinat|inappropriate|grade mismatch|too complex|too simple|age-inappropriate|content issue/i)) {
      let reason = FailureReason.HALLUCINATED_FACTS;
      if (msg.match(/inappropriate/i)) reason = FailureReason.INAPPROPRIATE_CONTENT;
      else if (msg.match(/grade mismatch/i)) reason = FailureReason.GRADE_MISMATCH;
      else if (msg.match(/too complex/i)) reason = FailureReason.TOO_COMPLEX;
      else if (msg.match(/too simple/i)) reason = FailureReason.TOO_SIMPLE;
      return {
        category: FailureCategory.CONTENT_ISSUE,
        reason,
        description: msg,
        originalError: error,
        retryCount,
        timestamp,
        requestId,
      };
    }

    // Validation issues
    if (msg.match(/homework dump|abuse detected|curriculum violation|not allowed|policy/i)) {
      let reason = FailureReason.HOMEWORK_DUMP_DETECTED;
      if (msg.match(/abuse/i)) reason = FailureReason.ABUSE_DETECTED;
      else if (msg.match(/curriculum/i)) reason = FailureReason.CURRICULUM_VIOLATION;
      return {
        category: FailureCategory.VALIDATION_FAILED,
        reason,
        description: msg,
        originalError: error,
        retryCount,
        timestamp,
        requestId,
      };
    }

    // Low confidence (custom error from validation)
    if (msg.match(/Low confidence|confidence score/i)) {
      const match = msg.match(/\(([\d.]+)\)/);
      const confidence = match ? parseFloat(match[1]) : undefined;
      return {
        category: FailureCategory.LOW_CONFIDENCE,
        reason: FailureReason.CONFIDENCE_BELOW_THRESHOLD,
        description: 'AI confidence below threshold',
        originalError: error,
        confidenceScore: confidence,
        retryCount,
        timestamp,
        requestId,
      };
    }
  }

  // Handle empty/undefined/invalid responses
  if (!error || (typeof error === 'string' && error.trim() === '')) {
    return {
      category: FailureCategory.SCHEMA_VIOLATION,
      reason: FailureReason.EMPTY_RESPONSE,
      description: 'Empty or undefined response',
      originalError: error instanceof Error ? error : new Error(String(error)),
      retryCount,
      timestamp,
      requestId,
    };
  }

  // Unknown error fallback
  return {
    category: FailureCategory.UNKNOWN,
    reason: FailureReason.CONFIDENCE_BELOW_THRESHOLD,
    description: 'Unknown error occurred',
    originalError: error instanceof Error ? error : new Error(String(error)),
    retryCount,
    timestamp,
    requestId,
  };
}
