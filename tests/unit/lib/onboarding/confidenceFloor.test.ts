/**
 * FILE OBJECTIVE:
 * - Unit tests for confidence floor module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/onboarding/confidenceFloor.spec.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created test suite
 */

import {
  ConfidenceFloor,
  MIN_CONFIDENCE_SCORE,
  MAX_CONFIDENCE_SCORE,
  INITIAL_CONFIDENCE_SCORE,
  CONSECUTIVE_FAILURE_THRESHOLD,
  MAX_CONSECUTIVE_FAILURES,
  ENCOURAGEMENT_MESSAGES,
  createInitialState,
  calculateEffectiveDifficulty,
  updateConfidenceScore,
  processAttempt,
  shouldSuggestBreak,
  getBreakSuggestion,
  getEncouragementMessage,
  calculateSessionSummary,
  ConfidenceTrigger,
  ConfidenceAction,
  type ConfidenceState,
  type AttemptResult,
} from '@/lib/onboarding/confidenceFloor';

describe('ConfidenceFloor', () => {
  // ============================================================================
  // CONSTANTS
  // ============================================================================
  describe('Constants', () => {
    it('should have valid confidence score range', () => {
      expect(MIN_CONFIDENCE_SCORE).toBeGreaterThanOrEqual(1);
      expect(MAX_CONFIDENCE_SCORE).toBeLessThanOrEqual(10);
      expect(MIN_CONFIDENCE_SCORE).toBeLessThan(MAX_CONFIDENCE_SCORE);
    });

    it('should have reasonable initial score', () => {
      expect(INITIAL_CONFIDENCE_SCORE).toBeGreaterThan(MIN_CONFIDENCE_SCORE);
      expect(INITIAL_CONFIDENCE_SCORE).toBeLessThan(MAX_CONFIDENCE_SCORE);
    });

    it('should have reasonable failure thresholds', () => {
      expect(CONSECUTIVE_FAILURE_THRESHOLD).toBeGreaterThanOrEqual(2);
      expect(MAX_CONSECUTIVE_FAILURES).toBeGreaterThan(CONSECUTIVE_FAILURE_THRESHOLD);
    });
  });

  // ============================================================================
  // createInitialState
  // ============================================================================
  describe('createInitialState', () => {
    it('should create state with initial confidence score', () => {
      const state = createInitialState();
      expect(state.score).toBe(INITIAL_CONFIDENCE_SCORE);
    });

    it('should create state with zero counters', () => {
      const state = createInitialState();
      expect(state.consecutiveWrong).toBe(0);
      expect(state.totalWrong).toBe(0);
      expect(state.totalCorrect).toBe(0);
      expect(state.hintsUsed).toBe(0);
      expect(state.timeStruggling).toBe(0);
    });

    it('should create state with null triggers', () => {
      const state = createInitialState();
      expect(state.lastTrigger).toBeNull();
      expect(state.lastAction).toBeNull();
    });
  });

  // ============================================================================
  // calculateEffectiveDifficulty
  // ============================================================================
  describe('calculateEffectiveDifficulty', () => {
    it('should apply floor: effective = min(planned, confidence - 1)', () => {
      // High confidence (8) with planned difficulty 5 = 5 (no cap)
      expect(calculateEffectiveDifficulty(5, 8)).toBe(5);

      // Low confidence (4) with planned difficulty 5 = 3 (capped at confidence - 1)
      expect(calculateEffectiveDifficulty(5, 4)).toBe(3);

      // Very low confidence (2) with planned difficulty 5 = 1 (minimum)
      expect(calculateEffectiveDifficulty(5, 2)).toBe(1);
    });

    it('should never return difficulty below 1', () => {
      expect(calculateEffectiveDifficulty(1, 1)).toBeGreaterThanOrEqual(1);
      expect(calculateEffectiveDifficulty(5, 1)).toBeGreaterThanOrEqual(1);
    });

    it('should not increase difficulty above planned', () => {
      // High confidence shouldn't increase planned difficulty
      expect(calculateEffectiveDifficulty(3, 10)).toBe(3);
    });
  });

  // ============================================================================
  // updateConfidenceScore
  // ============================================================================
  describe('updateConfidenceScore', () => {
    it('should increase score on correct answer', () => {
      const newScore = updateConfidenceScore(5, true, 0);
      expect(newScore).toBeGreaterThan(5);
    });

    it('should decrease score on wrong answer', () => {
      const newScore = updateConfidenceScore(5, false, 0);
      expect(newScore).toBeLessThan(5);
    });

    it('should increase less when hints used', () => {
      const withoutHints = updateConfidenceScore(5, true, 0);
      const withHints = updateConfidenceScore(5, true, 2);
      expect(withoutHints).toBeGreaterThan(withHints);
    });

    it('should cap at max confidence score', () => {
      const newScore = updateConfidenceScore(MAX_CONFIDENCE_SCORE - 0.1, true, 0);
      expect(newScore).toBeLessThanOrEqual(MAX_CONFIDENCE_SCORE);
    });

    it('should not drop below min confidence score', () => {
      const newScore = updateConfidenceScore(MIN_CONFIDENCE_SCORE, false, 0);
      expect(newScore).toBeGreaterThanOrEqual(MIN_CONFIDENCE_SCORE);
    });
  });

  // ============================================================================
  // processAttempt
  // ============================================================================
  describe('processAttempt', () => {
    it('should not intervene on correct answer', () => {
      const state = createInitialState();
      const attempt: AttemptResult = {
        correct: true,
        timeTaken: 30,
        hintsUsed: 0,
        earlyExit: false,
      };

      const result = processAttempt(state, attempt, 5, 'en');

      expect(result.shouldIntervene).toBe(false);
      expect(result.trigger).toBeNull();
      expect(result.newState.consecutiveWrong).toBe(0);
    });

    it('should track consecutive wrong answers', () => {
      let state = createInitialState();
      const attempt: AttemptResult = {
        correct: false,
        timeTaken: 30,
        hintsUsed: 0,
        earlyExit: false,
      };

      // First wrong answer
      let result = processAttempt(state, attempt, 5, 'en');
      expect(result.newState.consecutiveWrong).toBe(1);

      // Second wrong answer - should trigger intervention
      state = result.newState;
      result = processAttempt(state, attempt, 5, 'en');
      // After intervention triggers, consecutiveWrong resets to 0 (fresh start for student)
      expect(result.shouldIntervene).toBe(true);
      expect(result.trigger).toBe(ConfidenceTrigger.CONSECUTIVE_WRONG);
      expect(result.newState.consecutiveWrong).toBe(0); // Reset after intervention
    });

    it('should reset consecutive wrong on correct answer', () => {
      const state = createInitialState();
      
      // First wrong answer (doesn't trigger intervention yet)
      const wrongAttempt: AttemptResult = {
        correct: false,
        timeTaken: 30,
        hintsUsed: 0,
        earlyExit: false,
      };
      let result = processAttempt(state, wrongAttempt, 5, 'en');
      expect(result.newState.consecutiveWrong).toBe(1);

      // Correct answer should reset consecutive wrong
      const correctAttempt: AttemptResult = {
        correct: true,
        timeTaken: 30,
        hintsUsed: 0,
        earlyExit: false,
      };
      result = processAttempt(result.newState, correctAttempt, 5, 'en');
      expect(result.newState.consecutiveWrong).toBe(0);
    });

    it('should provide encouragement message on intervention', () => {
      const state = createInitialState();
      const wrongAttempt: AttemptResult = {
        correct: false,
        timeTaken: 30,
        hintsUsed: 0,
        earlyExit: false,
      };

      // Trigger intervention
      let result = processAttempt(state, wrongAttempt, 5, 'en');
      result = processAttempt(result.newState, wrongAttempt, 5, 'en');

      expect(result.shouldIntervene).toBe(true);
      expect(result.encouragementMessage).not.toBeNull();
    });

    it('should calculate effective difficulty based on confidence', () => {
      const state = createInitialState();
      const attempt: AttemptResult = {
        correct: true,
        timeTaken: 30,
        hintsUsed: 0,
        earlyExit: false,
      };

      const result = processAttempt(state, attempt, 10, 'en');
      
      // Effective difficulty should be limited by confidence floor
      expect(result.effectiveDifficulty).toBeLessThanOrEqual(result.newState.score - 1);
    });
  });

  // ============================================================================
  // shouldSuggestBreak
  // ============================================================================
  describe('shouldSuggestBreak', () => {
    it('should suggest break after max consecutive failures', () => {
      const state: ConfidenceState = {
        score: 5,
        consecutiveWrong: MAX_CONSECUTIVE_FAILURES,
        totalWrong: 5,
        totalCorrect: 3,
        hintsUsed: 2,
        timeStruggling: 0,
        lastTrigger: null,
        lastAction: null,
      };

      expect(shouldSuggestBreak(state)).toBe(true);
    });

    it('should suggest break when at floor and struggling', () => {
      const state: ConfidenceState = {
        score: MIN_CONFIDENCE_SCORE,
        consecutiveWrong: 1,
        totalWrong: 8,
        totalCorrect: 3,
        hintsUsed: 4,
        timeStruggling: 0,
        lastTrigger: null,
        lastAction: null,
      };

      expect(shouldSuggestBreak(state)).toBe(true);
    });

    it('should not suggest break for healthy state', () => {
      const state: ConfidenceState = {
        score: 7,
        consecutiveWrong: 1,
        totalWrong: 2,
        totalCorrect: 8,
        hintsUsed: 1,
        timeStruggling: 0,
        lastTrigger: null,
        lastAction: null,
      };

      expect(shouldSuggestBreak(state)).toBe(false);
    });
  });

  // ============================================================================
  // getEncouragementMessage
  // ============================================================================
  describe('getEncouragementMessage', () => {
    it('should return English message', () => {
      const message = getEncouragementMessage('en');
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return Hindi message', () => {
      const message = getEncouragementMessage('hi');
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return message from the list', () => {
      const message = getEncouragementMessage('en');
      expect(ENCOURAGEMENT_MESSAGES.en).toContain(message);
    });
  });

  // ============================================================================
  // getBreakSuggestion
  // ============================================================================
  describe('getBreakSuggestion', () => {
    it('should return English break message', () => {
      const message = getBreakSuggestion('en');
      expect(message).toBeDefined();
      expect(message).toContain('break');
    });

    it('should return Hindi break message', () => {
      const message = getBreakSuggestion('hi');
      expect(message).toBeDefined();
      expect(message).toContain('break');
    });
  });

  // ============================================================================
  // calculateSessionSummary
  // ============================================================================
  describe('calculateSessionSummary', () => {
    it('should calculate accuracy correctly', () => {
      const state: ConfidenceState = {
        score: 6,
        consecutiveWrong: 0,
        totalWrong: 2,
        totalCorrect: 8,
        hintsUsed: 1,
        timeStruggling: 0,
        lastTrigger: null,
        lastAction: null,
      };

      const summary = calculateSessionSummary(state);
      expect(summary.accuracy).toBe(0.8); // 8/10
    });

    it('should calculate confidence change', () => {
      const state: ConfidenceState = {
        score: 7,
        consecutiveWrong: 0,
        totalWrong: 2,
        totalCorrect: 8,
        hintsUsed: 1,
        timeStruggling: 0,
        lastTrigger: null,
        lastAction: null,
      };

      const summary = calculateSessionSummary(state);
      expect(summary.confidenceChange).toBe(7 - INITIAL_CONFIDENCE_SCORE);
    });

    it('should recommend difficulty increase for high accuracy', () => {
      const state: ConfidenceState = {
        score: 8,
        consecutiveWrong: 0,
        totalWrong: 1,
        totalCorrect: 9,
        hintsUsed: 0,
        timeStruggling: 0,
        lastTrigger: null,
        lastAction: null,
      };

      const summary = calculateSessionSummary(state);
      expect(summary.recommendation).toContain('increase');
    });

    it('should recommend difficulty decrease for low accuracy', () => {
      const state: ConfidenceState = {
        score: 4,
        consecutiveWrong: 2,
        totalWrong: 7,
        totalCorrect: 3,
        hintsUsed: 4,
        timeStruggling: 120,
        lastTrigger: ConfidenceTrigger.CONSECUTIVE_WRONG,
        lastAction: ConfidenceAction.REDUCE_DIFFICULTY,
      };

      const summary = calculateSessionSummary(state);
      expect(summary.recommendation.toLowerCase()).toContain('reduce');
    });
  });

  // ============================================================================
  // ENCOURAGEMENT_MESSAGES
  // ============================================================================
  describe('ENCOURAGEMENT_MESSAGES', () => {
    it('should have both English and Hindi messages', () => {
      expect(ENCOURAGEMENT_MESSAGES.en).toBeDefined();
      expect(ENCOURAGEMENT_MESSAGES.hi).toBeDefined();
    });

    it('should have multiple messages per language', () => {
      expect(ENCOURAGEMENT_MESSAGES.en.length).toBeGreaterThan(1);
      expect(ENCOURAGEMENT_MESSAGES.hi.length).toBeGreaterThan(1);
    });

    it('should have positive messages', () => {
      // Check messages don't contain negative words
      const negativeWords = ['wrong', 'bad', 'fail', 'stupid', 'dumb'];
      for (const message of ENCOURAGEMENT_MESSAGES.en) {
        for (const word of negativeWords) {
          expect(message.toLowerCase()).not.toContain(word);
        }
      }
    });
  });

  // ============================================================================
  // ConfidenceFloor export
  // ============================================================================
  describe('ConfidenceFloor export', () => {
    it('should export all required functions', () => {
      expect(ConfidenceFloor.createInitialState).toBe(createInitialState);
      expect(ConfidenceFloor.calculateEffectiveDifficulty).toBe(calculateEffectiveDifficulty);
      expect(ConfidenceFloor.updateConfidenceScore).toBe(updateConfidenceScore);
      expect(ConfidenceFloor.processAttempt).toBe(processAttempt);
      expect(ConfidenceFloor.shouldSuggestBreak).toBe(shouldSuggestBreak);
      expect(ConfidenceFloor.getBreakSuggestion).toBe(getBreakSuggestion);
      expect(ConfidenceFloor.getEncouragementMessage).toBe(getEncouragementMessage);
      expect(ConfidenceFloor.calculateSessionSummary).toBe(calculateSessionSummary);
    });

    it('should export constants', () => {
      expect(ConfidenceFloor.MIN_CONFIDENCE_SCORE).toBe(MIN_CONFIDENCE_SCORE);
      expect(ConfidenceFloor.MAX_CONFIDENCE_SCORE).toBe(MAX_CONFIDENCE_SCORE);
      expect(ConfidenceFloor.INITIAL_CONFIDENCE_SCORE).toBe(INITIAL_CONFIDENCE_SCORE);
      expect(ConfidenceFloor.CONSECUTIVE_FAILURE_THRESHOLD).toBe(CONSECUTIVE_FAILURE_THRESHOLD);
      expect(ConfidenceFloor.MAX_CONSECUTIVE_FAILURES).toBe(MAX_CONSECUTIVE_FAILURES);
    });
  });
});
