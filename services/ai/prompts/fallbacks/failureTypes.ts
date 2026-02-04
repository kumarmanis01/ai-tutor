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
  /** Number of retries already attempted */
  readonly retryCount: number;
  /** Timestamp of failure */
  readonly timestamp: Date;
  /** Request ID for tracing */
  readonly requestId: string;
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
  /** Maximum retries allowed for this failure type */
  readonly maxRetries: number;
  /** Modified parameters for retry */
  readonly modifiedParams?: Record<string, unknown>;
  /** Reason for decision (for logging) */
  readonly reasoning: string;
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
export const FAILURE_STRATEGY_MAP: Record<FailureReason, FallbackStrategy[]> = {
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

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Maximum retries by failure category.
 */
export const MAX_RETRIES: Record<FailureCategory, number> = {
  [FailureCategory.LOW_CONFIDENCE]: 2,
  [FailureCategory.SCHEMA_VIOLATION]: 3,
  [FailureCategory.CONTENT_ISSUE]: 1,
  [FailureCategory.TIMEOUT]: 2,
  [FailureCategory.RATE_LIMIT]: 3,
  [FailureCategory.NETWORK_ERROR]: 3,
  [FailureCategory.VALIDATION_FAILED]: 0, // Never retry validation failures
  [FailureCategory.UNKNOWN]: 1,
};

/**
 * Base delay (ms) before retry by failure category.
 */
export const BASE_RETRY_DELAY: Record<FailureCategory, number> = {
  [FailureCategory.LOW_CONFIDENCE]: 0,
  [FailureCategory.SCHEMA_VIOLATION]: 100,
  [FailureCategory.CONTENT_ISSUE]: 0,
  [FailureCategory.TIMEOUT]: 1000,
  [FailureCategory.RATE_LIMIT]: 5000,
  [FailureCategory.NETWORK_ERROR]: 2000,
  [FailureCategory.VALIDATION_FAILED]: 0,
  [FailureCategory.UNKNOWN]: 500,
};

// ============================================================================
// DECISION LOGIC
// ============================================================================

/**
 * Determine retry decision based on failure details.
 */
export function makeRetryDecision(failure: FailureDetails): RetryDecision {
  const maxRetries = MAX_RETRIES[failure.category];
  const baseDelay = BASE_RETRY_DELAY[failure.category];
  
  // Check if retries exhausted
  if (failure.retryCount >= maxRetries) {
    return {
      shouldRetry: false,
      strategy: FallbackStrategy.SAFE_RESPONSE,
      delayMs: 0,
      maxRetries,
      reasoning: `Max retries (${maxRetries}) exhausted for ${failure.category}`,
    };
  }
  
  // Get strategies for this failure reason
  const strategies = FAILURE_STRATEGY_MAP[failure.reason] || [FallbackStrategy.GRACEFUL_ERROR];
  const primaryStrategy = strategies[0];
  
  // Determine if we should retry
  const retryableStrategies: FallbackStrategy[] = [
    FallbackStrategy.SIMPLIFY_AND_RETRY,
    FallbackStrategy.ADJUST_PARAMETERS,
    FallbackStrategy.DELAYED_RETRY,
  ];
  
  const shouldRetry = retryableStrategies.includes(primaryStrategy);
  
  // Calculate delay with exponential backoff
  const delay = shouldRetry ? baseDelay * Math.pow(2, failure.retryCount) : 0;
  
  return {
    shouldRetry,
    strategy: primaryStrategy,
    delayMs: delay,
    maxRetries,
    modifiedParams: getModifiedParams(failure, primaryStrategy),
    reasoning: `Applying ${primaryStrategy} for ${failure.reason} (retry ${failure.retryCount + 1}/${maxRetries})`,
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
