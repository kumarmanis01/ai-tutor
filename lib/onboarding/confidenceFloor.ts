/**
 * FILE OBJECTIVE:
 * - Confidence Floor system to protect weak students.
 * - Prevents repeated failures silently.
 * - Adjusts difficulty automatically without labeling student.
 * - Core protection for student confidence.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/onboarding/confidenceFloor.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created confidence floor system
 */

import type { Grade as _Grade } from '@/lib/ai/prompts/schemas';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * Confidence level (1-10 scale)
 */
export type ConfidenceScore = number;

/**
 * Trigger condition for confidence floor activation
 */
export enum ConfidenceTrigger {
  CONSECUTIVE_WRONG = 'consecutive_wrong',
  TIME_STRUGGLE = 'time_struggle',
  EARLY_EXIT = 'early_exit',
  HINT_OVERUSE = 'hint_overuse',
}

/**
 * Automatic action taken by confidence floor
 */
export enum ConfidenceAction {
  REDUCE_DIFFICULTY = 'reduce_difficulty',
  SHOW_EXAMPLE = 'show_example',
  SWITCH_QUESTION_TYPE = 'switch_question_type',
  PROVIDE_HINT = 'provide_hint',
  ENCOURAGE = 'encourage',
}

/**
 * Student confidence state
 */
export interface ConfidenceState {
  /** Current confidence score (1-10) */
  readonly score: ConfidenceScore;
  /** Consecutive wrong answers */
  readonly consecutiveWrong: number;
  /** Total wrong answers in session */
  readonly totalWrong: number;
  /** Total correct answers in session */
  readonly totalCorrect: number;
  /** Hints used in session */
  readonly hintsUsed: number;
  /** Time struggling (seconds) */
  readonly timeStruggling: number;
  /** Last trigger activated */
  readonly lastTrigger: ConfidenceTrigger | null;
  /** Last action taken */
  readonly lastAction: ConfidenceAction | null;
}

/**
 * Confidence floor decision
 */
export interface ConfidenceDecision {
  /** Should we intervene? */
  readonly shouldIntervene: boolean;
  /** Trigger that caused intervention */
  readonly trigger: ConfidenceTrigger | null;
  /** Action to take */
  readonly action: ConfidenceAction | null;
  /** New effective difficulty */
  readonly effectiveDifficulty: number;
  /** Message to show (if any) - always positive */
  readonly encouragementMessage: string | null;
  /** Updated confidence state */
  readonly newState: ConfidenceState;
}

/**
 * Question attempt result
 */
export interface AttemptResult {
  /** Was the answer correct? */
  readonly correct: boolean;
  /** Time taken (seconds) */
  readonly timeTaken: number;
  /** Hints used for this question */
  readonly hintsUsed: number;
  /** Did student exit early? */
  readonly earlyExit: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum confidence score (floor)
 */
export const MIN_CONFIDENCE_SCORE = 3;

/**
 * Maximum confidence score
 */
export const MAX_CONFIDENCE_SCORE = 10;

/**
 * Starting confidence score for new students
 */
export const INITIAL_CONFIDENCE_SCORE = 6;

/**
 * Consecutive failures to trigger intervention
 */
export const CONSECUTIVE_FAILURE_THRESHOLD = 2;

/**
 * Maximum consecutive failures allowed (hard stop)
 */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Time threshold for struggle detection (seconds)
 */
export const TIME_STRUGGLE_THRESHOLD = 120; // 2 minutes

/**
 * Hint overuse threshold per session
 */
export const HINT_OVERUSE_THRESHOLD = 5;

/**
 * Encouragement messages (always positive, never negative)
 */
export const ENCOURAGEMENT_MESSAGES: Record<string, string[]> = {
  hi: [
    'Bahut accha! Chal, ek aur try karte hain! 💪',
    'Koi baat nahi, agli baar pakka hoga! 🌟',
    'Tu kar sakta hai! Ek example dekh le pehle? 📚',
    'Slowly slowly seekhenge, koi jaldi nahi! 🐢',
    'Practice se perfect hota hai! Chalo aage! 🎯',
  ],
  en: [
    'Great effort! Let\'s try another one! 💪',
    'No worries, you\'ll get it next time! 🌟',
    'You can do this! Want to see an example first? 📚',
    'We\'ll learn step by step, no rush! 🐢',
    'Practice makes perfect! Let\'s continue! 🎯',
  ],
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Create initial confidence state for a new session
 */
export function createInitialState(): ConfidenceState {
  return {
    score: INITIAL_CONFIDENCE_SCORE,
    consecutiveWrong: 0,
    totalWrong: 0,
    totalCorrect: 0,
    hintsUsed: 0,
    timeStruggling: 0,
    lastTrigger: null,
    lastAction: null,
  };
}

/**
 * Calculate effective difficulty using confidence floor formula
 * Formula: effective_difficulty = min(planned_difficulty, confidence_score - 1)
 * Never goes below "easy win" level (1)
 */
export function calculateEffectiveDifficulty(
  plannedDifficulty: number,
  confidenceScore: ConfidenceScore
): number {
  const flooredDifficulty = Math.min(plannedDifficulty, confidenceScore - 1);
  return Math.max(1, flooredDifficulty); // Never below 1
}

/**
 * Update confidence score based on attempt result
 */
export function updateConfidenceScore(
  currentScore: ConfidenceScore,
  correct: boolean,
  hintsUsed: number
): ConfidenceScore {
  let delta = 0;
  
  if (correct) {
    // Correct answer increases confidence
    delta = hintsUsed > 0 ? 0.3 : 0.5; // Less boost if hints used
  } else {
    // Wrong answer decreases confidence
    delta = -0.5;
  }
  
  const newScore = currentScore + delta;
  
  // Clamp to valid range
  return Math.max(MIN_CONFIDENCE_SCORE, Math.min(MAX_CONFIDENCE_SCORE, newScore));
}

/**
 * Check for trigger conditions
 */
export function checkTriggers(state: ConfidenceState, attempt: AttemptResult): ConfidenceTrigger | null {
  // Priority order: Early exit > Consecutive wrong > Time struggle > Hint overuse
  
  if (attempt.earlyExit) {
    return ConfidenceTrigger.EARLY_EXIT;
  }
  
  if (state.consecutiveWrong >= CONSECUTIVE_FAILURE_THRESHOLD) {
    return ConfidenceTrigger.CONSECUTIVE_WRONG;
  }
  
  if (attempt.timeTaken >= TIME_STRUGGLE_THRESHOLD) {
    return ConfidenceTrigger.TIME_STRUGGLE;
  }
  
  if (state.hintsUsed >= HINT_OVERUSE_THRESHOLD) {
    return ConfidenceTrigger.HINT_OVERUSE;
  }
  
  return null;
}

/**
 * Determine action based on trigger
 */
export function determineAction(trigger: ConfidenceTrigger): ConfidenceAction {
  switch (trigger) {
    case ConfidenceTrigger.CONSECUTIVE_WRONG:
      return ConfidenceAction.REDUCE_DIFFICULTY;
    case ConfidenceTrigger.TIME_STRUGGLE:
      return ConfidenceAction.SHOW_EXAMPLE;
    case ConfidenceTrigger.EARLY_EXIT:
      return ConfidenceAction.SWITCH_QUESTION_TYPE;
    case ConfidenceTrigger.HINT_OVERUSE:
      return ConfidenceAction.REDUCE_DIFFICULTY;
    default:
      return ConfidenceAction.ENCOURAGE;
  }
}

/**
 * Get random encouragement message
 */
export function getEncouragementMessage(language: 'hi' | 'en' = 'hi'): string {
  const messages = ENCOURAGEMENT_MESSAGES[language];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Process an attempt and make confidence floor decision
 * This is the main entry point for the confidence floor system
 */
export function processAttempt(
  currentState: ConfidenceState,
  attempt: AttemptResult,
  plannedDifficulty: number,
  language: 'hi' | 'en' = 'hi'
): ConfidenceDecision {
  // Update state based on attempt
  let newConsecutiveWrong = attempt.correct ? 0 : currentState.consecutiveWrong + 1;
  const newTotalWrong = currentState.totalWrong + (attempt.correct ? 0 : 1);
  const newTotalCorrect = currentState.totalCorrect + (attempt.correct ? 1 : 0);
  const newHintsUsed = currentState.hintsUsed + attempt.hintsUsed;
  const newTimeStruggling = currentState.timeStruggling + 
    (attempt.timeTaken >= TIME_STRUGGLE_THRESHOLD ? attempt.timeTaken : 0);
  
  // Update confidence score
  const newScore = updateConfidenceScore(currentState.score, attempt.correct, attempt.hintsUsed);
  
  // Check for triggers
  const intermediateState: ConfidenceState = {
    ...currentState,
    score: newScore,
    consecutiveWrong: newConsecutiveWrong,
    totalWrong: newTotalWrong,
    totalCorrect: newTotalCorrect,
    hintsUsed: newHintsUsed,
    timeStruggling: newTimeStruggling,
  };
  
  const trigger = checkTriggers(intermediateState, attempt);
  const shouldIntervene = trigger !== null;
  const action = trigger ? determineAction(trigger) : null;
  
  // Calculate effective difficulty
  const effectiveDifficulty = calculateEffectiveDifficulty(plannedDifficulty, newScore);
  
  // Get encouragement message if intervening
  const encouragementMessage = shouldIntervene ? getEncouragementMessage(language) : null;
  
  // If action is REDUCE_DIFFICULTY, reset consecutive wrong counter
  // (we're giving them an easier question)
  if (action === ConfidenceAction.REDUCE_DIFFICULTY) {
    newConsecutiveWrong = 0;
  }
  
  const newState: ConfidenceState = {
    score: newScore,
    consecutiveWrong: newConsecutiveWrong,
    totalWrong: newTotalWrong,
    totalCorrect: newTotalCorrect,
    hintsUsed: newHintsUsed,
    timeStruggling: newTimeStruggling,
    lastTrigger: trigger,
    lastAction: action,
  };
  
  return {
    shouldIntervene,
    trigger,
    action,
    effectiveDifficulty,
    encouragementMessage,
    newState,
  };
}

/**
 * Check if student should be prevented from continuing (hard stop)
 * This is a safety valve - if student is really struggling, suggest a break
 */
export function shouldSuggestBreak(state: ConfidenceState): boolean {
  // Never allow more than MAX_CONSECUTIVE_FAILURES in a row
  if (state.consecutiveWrong >= MAX_CONSECUTIVE_FAILURES) {
    return true;
  }
  
  // If confidence score is at floor and still struggling
  if (state.score <= MIN_CONFIDENCE_SCORE && state.totalWrong > state.totalCorrect) {
    return true;
  }
  
  return false;
}

/**
 * Get break suggestion message (positive framing)
 */
export function getBreakSuggestion(language: 'hi' | 'en' = 'hi'): string {
  if (language === 'hi') {
    return '🌟 Bahut mehnat kar li! Thoda break le lo, phir fresh start karenge! 💪';
  }
  return '🌟 You\'ve worked hard! Take a short break, then we\'ll start fresh! 💪';
}

/**
 * Calculate session summary (for analytics, never shown to student negatively)
 */
export function calculateSessionSummary(state: ConfidenceState): {
  accuracy: number;
  confidenceChange: number;
  interventions: number;
  recommendation: string;
} {
  const totalAttempts = state.totalCorrect + state.totalWrong;
  const accuracy = totalAttempts > 0 ? state.totalCorrect / totalAttempts : 0;
  const confidenceChange = state.score - INITIAL_CONFIDENCE_SCORE;
  const interventions = state.lastTrigger ? 1 : 0; // Simplified count
  
  let recommendation: string;
  if (accuracy >= 0.8) {
    recommendation = 'Ready for slight difficulty increase';
  } else if (accuracy >= 0.6) {
    recommendation = 'Continue at current level';
  } else {
    recommendation = 'Reduce difficulty next session';
  }
  
  return { accuracy, confidenceChange, interventions, recommendation };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const ConfidenceFloor = {
  createInitialState,
  calculateEffectiveDifficulty,
  updateConfidenceScore,
  processAttempt,
  shouldSuggestBreak,
  getBreakSuggestion,
  getEncouragementMessage,
  calculateSessionSummary,
  MIN_CONFIDENCE_SCORE,
  MAX_CONFIDENCE_SCORE,
  INITIAL_CONFIDENCE_SCORE,
  CONSECUTIVE_FAILURE_THRESHOLD,
  MAX_CONSECUTIVE_FAILURES,
};
