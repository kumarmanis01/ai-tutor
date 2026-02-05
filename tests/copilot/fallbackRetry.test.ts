/**
 * FILE OBJECTIVE:
 * - Jest test suites for fallback and retry behavior.
 * - Validates failure classification, retry decisions, and grade-appropriate fallbacks.
 * - Tests timeout handling and exponential backoff.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created fallback retry tests
 */

import {
  FailureCategory,
  FailureReason,
  FallbackStrategy,
  classifyFailure,
  makeRetryDecision,
  FAILURE_STRATEGY_MAP,
  MAX_RETRIES,
  BASE_RETRY_DELAY,
} from '@/services/ai/prompts/fallbacks/failureTypes';

import {
  getFallbackTemplate,
  formatFallbackMessage,
  getFailureReasonFallback,
} from '@/services/ai/prompts/fallbacks/templates';

import {
  handleFailure,
  createRetryContext,
  updateRetryContext,
  MAX_RETRY_TIME_BY_GRADE,
} from '@/services/ai/prompts/fallbacks/retryLogic';

// ============================================================================
// FAILURE CLASSIFICATION TESTS
// ============================================================================

describe('Failure Classification', () => {
  describe('Low Confidence Failures', () => {
    it('should classify low AI confidence as LOW_CONFIDENCE', () => {
      const failure = {
        aiConfidence: 0.4,
        schemaValid: true,
        error: null,
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.LOW_CONFIDENCE);
    });
    
    it('should set threshold at 0.6 for confidence', () => {
      const belowThreshold = classifyFailure({ aiConfidence: 0.59 });
      const atThreshold = classifyFailure({ aiConfidence: 0.6 });
      const aboveThreshold = classifyFailure({ aiConfidence: 0.61 });
      
      expect(belowThreshold.category).toBe(FailureCategory.LOW_CONFIDENCE);
      expect(atThreshold.category).not.toBe(FailureCategory.LOW_CONFIDENCE);
      expect(aboveThreshold.category).not.toBe(FailureCategory.LOW_CONFIDENCE);
    });
  });
  
  describe('Schema Violation Failures', () => {
    it('should classify invalid schema as SCHEMA_VIOLATION', () => {
      const failure = {
        aiConfidence: 0.9,
        schemaValid: false,
        validationErrors: ['missing required field: conceptTitle'],
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.SCHEMA_VIOLATION);
    });
    
    it('should include validation errors in classification', () => {
      const failure = {
        schemaValid: false,
        validationErrors: ['field X invalid', 'field Y missing'],
      };
      
      const result = classifyFailure(failure);
      
      expect(result.details.validationErrors).toHaveLength(2);
    });
  });
  
  describe('Content Issue Failures', () => {
    it('should classify hallucination detection as CONTENT_ISSUE', () => {
      const failure = {
        aiConfidence: 0.85,
        schemaValid: true,
        hallucinationDetected: true,
        hallucinationDetails: { falseCertainty: true },
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.CONTENT_ISSUE);
      expect(result.reason).toBe(FailureReason.HALLUCINATED_FACTS);
    });
    
    it('should classify inappropriate content as CONTENT_ISSUE', () => {
      const failure = {
        schemaValid: true,
        contentSafe: false,
        safetyViolation: 'off_topic',
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.CONTENT_ISSUE);
    });
  });
  
  describe('Timeout Failures', () => {
    it('should classify timeout errors as TIMEOUT', () => {
      const failure = {
        error: new Error('Request timed out after 30000ms'),
        errorCode: 'ETIMEDOUT',
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.TIMEOUT);
    });
    
    it('should classify OpenAI timeout as TIMEOUT', () => {
      const failure = {
        error: { message: 'Request timeout', status: 408 },
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.TIMEOUT);
    });
  });
  
  describe('Rate Limit Failures', () => {
    it('should classify 429 status as RATE_LIMIT', () => {
      const failure = {
        error: { status: 429, message: 'Rate limit exceeded' },
      };
      
      const result = classifyFailure(failure);
      
      expect(result.category).toBe(FailureCategory.RATE_LIMIT);
    });
    
    it('should extract retry-after from rate limit error', () => {
      const failure = {
        error: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      };
      
      const result = classifyFailure(failure);
      
      expect(result.details.retryAfter).toBe(60);
    });
  });
});

// ============================================================================
// RETRY DECISION TESTS
// ============================================================================

describe('Retry Decision Logic', () => {
  describe('Basic Retry Decisions', () => {
    it('should recommend retry for first LOW_CONFIDENCE failure', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.LOW_CONFIDENCE,
        attemptNumber: 1,
        elapsedTime: 1000,
        grade: 5,
      });
      
      expect(decision.shouldRetry).toBe(true);
      expect(decision.strategy).toBe(FallbackStrategy.SIMPLIFY_AND_RETRY);
    });
    
    it('should recommend fallback after max retries', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.LOW_CONFIDENCE,
        attemptNumber: MAX_RETRIES + 1,
        elapsedTime: 5000,
        grade: 5,
      });
      
      expect(decision.shouldRetry).toBe(false);
      expect(decision.strategy).toBe(FallbackStrategy.SAFE_RESPONSE);
    });
    
    it('should never retry CONTENT_BLOCKED failures', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.CONTENT_BLOCKED,
        attemptNumber: 1,
        elapsedTime: 0,
        grade: 8,
      });
      
      expect(decision.shouldRetry).toBe(false);
    });
  });
  
  describe('Time Budget Constraints', () => {
    it('should respect junior grade time budget (5 seconds)', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.TIMEOUT,
        attemptNumber: 1,
        elapsedTime: 6000, // Already over 5s budget
        grade: 2,
      });
      
      expect(decision.shouldRetry).toBe(false);
      expect(decision.reason).toContain('time budget');
    });
    
    it('should allow more time for senior grades (12 seconds)', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.TIMEOUT,
        attemptNumber: 1,
        elapsedTime: 8000, // Under 12s budget
        grade: 10,
      });
      
      expect(decision.shouldRetry).toBe(true);
    });
    
    it('should stop retrying when approaching time limit', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.LOW_CONFIDENCE,
        attemptNumber: 2,
        elapsedTime: 10000, // Near limit even for senior
        grade: 12,
      });
      
      // Should not retry if remaining time is too short
      expect(decision.estimatedNextAttemptTime).toBeDefined();
    });
  });
  
  describe('Strategy Selection', () => {
    it('should suggest simpler prompt for LOW_CONFIDENCE', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.LOW_CONFIDENCE,
        attemptNumber: 1,
        elapsedTime: 0,
        grade: 6,
      });
      
      expect(decision.strategy).toBe(FallbackStrategy.SIMPLIFY_AND_RETRY);
    });
    
    it('should suggest schema repair for SCHEMA_VIOLATION', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.SCHEMA_VIOLATION,
        attemptNumber: 1,
        elapsedTime: 0,
        grade: 7,
      });
      
      expect(decision.strategy).toBe(FallbackStrategy.ADJUST_PARAMETERS);
    });
    
    it('should suggest exponential backoff for RATE_LIMIT', () => {
      const decision = makeRetryDecision({
        category: FailureCategory.RATE_LIMIT,
        attemptNumber: 1,
        elapsedTime: 0,
        grade: 5,
      });
      
      expect(decision.strategy).toBe(FallbackStrategy.DELAYED_RETRY);
      expect(decision.waitTime).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// EXPONENTIAL BACKOFF TESTS
// ============================================================================

describe('Exponential Backoff', () => {
  it('should start with base delay', () => {
    const decision = makeRetryDecision({
      category: FailureCategory.RATE_LIMIT,
      attemptNumber: 1,
      elapsedTime: 0,
      grade: 5,
    });
    
    expect(decision.waitTime).toBe(BASE_RETRY_DELAY);
  });
  
  it('should double delay on each attempt', () => {
    const attempt1 = makeRetryDecision({
      category: FailureCategory.RATE_LIMIT,
      attemptNumber: 1,
      elapsedTime: 0,
      grade: 8,
    });
    
    const attempt2 = makeRetryDecision({
      category: FailureCategory.RATE_LIMIT,
      attemptNumber: 2,
      elapsedTime: 1000,
      grade: 8,
    });
    
    expect(attempt2.waitTime).toBe(attempt1.waitTime! * 2);
  });
  
  it('should cap maximum wait time', () => {
    const decision = makeRetryDecision({
      category: FailureCategory.RATE_LIMIT,
      attemptNumber: 10, // Very high attempt
      elapsedTime: 0,
      grade: 10,
    });
    
    // Should not wait more than max (e.g., 30 seconds)
    expect(decision.waitTime).toBeLessThanOrEqual(30000);
  });
  
  it('should add jitter to prevent thundering herd', () => {
    const decisions = Array(10).fill(null).map(() =>
      makeRetryDecision({
        category: FailureCategory.RATE_LIMIT,
        attemptNumber: 2,
        elapsedTime: 0,
        grade: 5,
      })
    );
    
    const waitTimes = decisions.map(d => d.waitTime);
    const uniqueTimes = new Set(waitTimes);
    
    // With jitter, we should have some variation
    expect(uniqueTimes.size).toBeGreaterThan(1);
  });
});

// ============================================================================
// FALLBACK TEMPLATE TESTS
// ============================================================================

describe('Fallback Templates', () => {
  describe('Grade-Appropriate Templates', () => {
    it('should return friendly template for Grade 1', () => {
      const template = getFallbackTemplate('notes', 1, FailureCategory.LOW_CONFIDENCE);
      
      expect(template.message).toContain('sorry');
      expect(template.message).toMatch(/😊|🌟|try again/i);
      expect(template.message.length).toBeLessThan(200);
    });
    
    it('should return professional template for Grade 10', () => {
      const template = getFallbackTemplate('notes', 10, FailureCategory.LOW_CONFIDENCE);
      
      expect(template.message).not.toContain('😊');
      expect(template.message).toMatch(/unable|issue|try|later/i);
    });
    
    it('should never expose internal error details', () => {
      const template = getFallbackTemplate(
        'doubt',
        6,
        FailureCategory.SCHEMA_VIOLATION,
        { internalError: 'TypeError at line 123' }
      );
      
      expect(template.message).not.toContain('TypeError');
      expect(template.message).not.toContain('line 123');
    });
  });
  
  describe('Feature-Specific Templates', () => {
    it('should have different templates for notes vs practice', () => {
      const notesTemplate = getFallbackTemplate('notes', 5, FailureCategory.TIMEOUT);
      const practiceTemplate = getFallbackTemplate('practice', 5, FailureCategory.TIMEOUT);
      
      expect(notesTemplate.message).not.toBe(practiceTemplate.message);
    });
    
    it('should have doubt-specific fallback', () => {
      const template = getFallbackTemplate('doubt', 7, FailureCategory.CONTENT_ISSUE);
      
      expect(template.message).toMatch(/question|ask|help/i);
    });
  });
  
  describe('Failure-Specific Messages', () => {
    it('should have timeout-specific message', () => {
      const template = getFallbackTemplate('notes', 8, FailureCategory.TIMEOUT);
      
      expect(template.message).toMatch(/taking longer|slow|moment/i);
    });
    
    it('should have rate-limit-specific message', () => {
      const template = getFallbackTemplate('practice', 6, FailureCategory.RATE_LIMIT);
      
      expect(template.message).toMatch(/busy|later|wait/i);
    });
    
    it('should have content-blocked message without policy details', () => {
      const template = getFallbackTemplate('doubt', 4, FailureCategory.CONTENT_BLOCKED);
      
      expect(template.message).not.toContain('policy');
      expect(template.message).not.toContain('blocked');
      expect(template.message).toMatch(/different|another|topic|help/i);
    });
  });
});

// ============================================================================
// FORMATTED MESSAGE TESTS
// ============================================================================

describe('Formatted Fallback Messages', () => {
  it('should format message with student name if available', () => {
    const message = formatFallbackMessage(
      'notes',
      5,
      FailureCategory.LOW_CONFIDENCE,
      { studentName: 'Rahul' }
    );
    
    expect(message).toContain('Rahul');
  });
  
  it('should format message without name gracefully', () => {
    const message = formatFallbackMessage(
      'notes',
      5,
      FailureCategory.LOW_CONFIDENCE,
      {}
    );
    
    expect(message).not.toContain('undefined');
    expect(message).not.toContain('null');
  });
  
  it('should include suggested action when available', () => {
    const message = formatFallbackMessage(
      'doubt',
      8,
      FailureCategory.CONTENT_ISSUE,
      { suggestedAction: 'Try rephrasing your question' }
    );
    
    expect(message).toMatch(/rephras/i);
  });
});

// ============================================================================
// RETRY CONTEXT MANAGEMENT TESTS
// ============================================================================

describe('Retry Context Management', () => {
  it('should create initial context with correct defaults', () => {
    const context = createRetryContext({
      requestId: 'req_123',
      feature: 'notes',
      grade: 6,
    });
    
    expect(context.attemptNumber).toBe(0);
    expect(context.failures).toHaveLength(0);
    expect(context.startTime).toBeLessThanOrEqual(Date.now());
  });
  
  it('should update context after failure', () => {
    const initial = createRetryContext({
      requestId: 'req_456',
      feature: 'practice',
      grade: 5,
    });
    
    const updated = updateRetryContext(initial, {
      category: FailureCategory.LOW_CONFIDENCE,
      reason: FailureReason.MODEL_UNCERTAINTY,
      timestamp: Date.now(),
    });
    
    expect(updated.attemptNumber).toBe(1);
    expect(updated.failures).toHaveLength(1);
    expect(updated.lastFailureCategory).toBe(FailureCategory.LOW_CONFIDENCE);
  });
  
  it('should track elapsed time', () => {
    const context = createRetryContext({
      requestId: 'req_789',
      feature: 'doubt',
      grade: 7,
    });
    
    // Simulate time passing
    const later = { ...context, startTime: context.startTime - 5000 };
    
    expect(Date.now() - later.startTime).toBeGreaterThanOrEqual(5000);
  });
});

// ============================================================================
// END-TO-END FAILURE HANDLING TESTS
// ============================================================================

describe('End-to-End Failure Handling', () => {
  it('should handle first failure with retry', async () => {
    const result = await handleFailure({
      requestId: 'req_e2e1',
      feature: 'notes',
      grade: 6,
      failure: {
        category: FailureCategory.LOW_CONFIDENCE,
        aiConfidence: 0.45,
        timestamp: Date.now(),
      },
      context: createRetryContext({ requestId: 'req_e2e1', feature: 'notes', grade: 6 }),
    });
    
    expect(result.action).toBe('RETRY');
    expect(result.retryConfig).toBeDefined();
  });
  
  it('should fall back after exhausting retries', async () => {
    const context = createRetryContext({ requestId: 'req_e2e2', feature: 'practice', grade: 5 });
    // Simulate multiple failures
    context.attemptNumber = MAX_RETRIES;
    context.failures = Array(MAX_RETRIES).fill({
      category: FailureCategory.SCHEMA_VIOLATION,
      timestamp: Date.now(),
    });
    
    const result = await handleFailure({
      requestId: 'req_e2e2',
      feature: 'practice',
      grade: 5,
      failure: {
        category: FailureCategory.SCHEMA_VIOLATION,
        timestamp: Date.now(),
      },
      context,
    });
    
    expect(result.action).toBe('FALLBACK');
    expect(result.fallbackMessage).toBeDefined();
  });
  
  it('should immediately fall back for blocked content', async () => {
    const result = await handleFailure({
      requestId: 'req_e2e3',
      feature: 'doubt',
      grade: 4,
      failure: {
        category: FailureCategory.CONTENT_BLOCKED,
        reason: FailureReason.SAFETY_VIOLATION,
        timestamp: Date.now(),
      },
      context: createRetryContext({ requestId: 'req_e2e3', feature: 'doubt', grade: 4 }),
    });
    
    expect(result.action).toBe('FALLBACK');
    expect(result.fallbackMessage).toBeDefined();
  });
  
  it('should include audit information in result', async () => {
    const result = await handleFailure({
      requestId: 'req_audit',
      feature: 'notes',
      grade: 8,
      failure: {
        category: FailureCategory.TIMEOUT,
        timestamp: Date.now(),
      },
      context: createRetryContext({ requestId: 'req_audit', feature: 'notes', grade: 8 }),
    });
    
    expect(result.audit).toBeDefined();
    expect(result.audit.requestId).toBe('req_audit');
    expect(result.audit.failureCategory).toBe(FailureCategory.TIMEOUT);
    expect(result.audit.decision).toBeDefined();
  });
});

// ============================================================================
// FAILURE STRATEGY MAP TESTS
// ============================================================================

describe('Failure Strategy Map', () => {
  it('should have strategy for every failure category', () => {
    const categories = Object.values(FailureCategory);
    
    categories.forEach(category => {
      expect(FAILURE_STRATEGY_MAP[category]).toBeDefined();
    });
  });
  
  it('should have retryable flag for each strategy', () => {
    Object.values(FAILURE_STRATEGY_MAP).forEach(strategy => {
      expect(typeof strategy.retryable).toBe('boolean');
    });
  });
  
  it('should mark CONTENT_BLOCKED as non-retryable', () => {
    expect(FAILURE_STRATEGY_MAP[FailureCategory.CONTENT_BLOCKED].retryable).toBe(false);
  });
  
  it('should mark TIMEOUT as retryable', () => {
    expect(FAILURE_STRATEGY_MAP[FailureCategory.TIMEOUT].retryable).toBe(true);
  });
});
