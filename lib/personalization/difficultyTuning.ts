/**
 * FILE OBJECTIVE:
 * - Explainable AI personalization engine for K-12 students.
 * - Deterministic difficulty tuning logic based on performance metrics.
 * - Produces machine-readable decisions AND human-readable reasons.
 * - No machine learning - fully auditable and testable.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/personalization/difficultyTuning.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created difficulty tuning engine
 */

import type { Grade } from '@/lib/ai/prompts/schemas';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * Difficulty levels - ordered from easiest to hardest
 */
export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXAM = 'EXAM',
}

/**
 * Difficulty adjustment direction
 */
export enum AdjustmentDirection {
  DECREASE = -1,
  MAINTAIN = 0,
  INCREASE = 1,
}

/**
 * Performance metrics used for tuning
 */
export interface PerformanceMetrics {
  /** Accuracy percentage (0-100) */
  readonly accuracy: number;
  /** Average time spent per question in seconds */
  readonly avgTimePerQuestion: number;
  /** Number of retry attempts */
  readonly retryCount: number;
  /** Number of hints used */
  readonly hintsUsed: number;
  /** AI confidence score for responses (0-1) */
  readonly aiConfidenceScore: number;
  /** Total questions attempted in session */
  readonly questionsAttempted: number;
}

/**
 * Student context for difficulty adjustment
 */
export interface StudentDifficultyContext {
  /** Student's current grade */
  readonly grade: Grade;
  /** Current difficulty level */
  readonly currentDifficulty: DifficultyLevel;
  /** Subject area (affects time expectations) */
  readonly subject: string;
  /** Session performance metrics */
  readonly metrics: PerformanceMetrics;
}

/**
 * Difficulty adjustment decision
 */
export interface DifficultyAdjustment {
  /** The direction of adjustment */
  readonly direction: AdjustmentDirection;
  /** New difficulty level after adjustment */
  readonly newDifficulty: DifficultyLevel;
  /** Whether difficulty was changed */
  readonly changed: boolean;
  /** Machine-readable reason code */
  readonly reasonCode: DifficultyReasonCode;
  /** Human-readable explanation (safe to show to parents/teachers) */
  readonly humanReason: string;
  /** Confidence in this decision (0-1) */
  readonly confidence: number;
  /** Metrics that contributed to decision */
  readonly contributingFactors: ContributingFactor[];
}

/**
 * Machine-readable reason codes for adjustment decisions
 */
export enum DifficultyReasonCode {
  // Increase reasons
  HIGH_ACCURACY_FAST_COMPLETION = 'HIGH_ACCURACY_FAST_COMPLETION',
  CONSISTENT_MASTERY = 'CONSISTENT_MASTERY',
  NO_HINTS_HIGH_ACCURACY = 'NO_HINTS_HIGH_ACCURACY',
  
  // Maintain reasons
  MODERATE_PERFORMANCE = 'MODERATE_PERFORMANCE',
  MIXED_SIGNALS = 'MIXED_SIGNALS',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  JUNIOR_GRADE_PROTECTION = 'JUNIOR_GRADE_PROTECTION',
  ALREADY_AT_BOUNDARY = 'ALREADY_AT_BOUNDARY',
  
  // Decrease reasons
  LOW_ACCURACY = 'LOW_ACCURACY',
  EXCESSIVE_HINTS = 'EXCESSIVE_HINTS',
  EXCESSIVE_RETRIES = 'EXCESSIVE_RETRIES',
  STRUGGLING_INDICATORS = 'STRUGGLING_INDICATORS',
  LOW_AI_CONFIDENCE = 'LOW_AI_CONFIDENCE',
}

/**
 * Individual factor contributing to the decision
 */
export interface ContributingFactor {
  /** Factor name */
  readonly factor: string;
  /** Factor value */
  readonly value: number;
  /** Threshold used */
  readonly threshold: number;
  /** Impact direction */
  readonly impact: 'positive' | 'negative' | 'neutral';
  /** Weight in decision (0-1) */
  readonly weight: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Thresholds for difficulty adjustment
 * These are tuned for educational best practices
 */
export const DIFFICULTY_THRESHOLDS = {
  // Accuracy thresholds
  accuracy: {
    excellent: 90,    // Consider increase
    good: 70,         // Maintain
    struggling: 50,   // Consider decrease
  },
  
  // Time thresholds (as multiplier of expected time)
  time: {
    fast: 0.7,        // Completed much faster than expected
    normal: 1.3,      // Normal range
    slow: 2.0,        // Taking too long
  },
  
  // Hint usage thresholds
  hints: {
    minimal: 0,       // No hints - strong understanding
    moderate: 2,      // Some hints - acceptable
    excessive: 4,     // Too many hints - struggling
  },
  
  // Retry thresholds per session
  retries: {
    minimal: 1,       // Normal retry behavior
    moderate: 3,      // Some struggles
    excessive: 5,     // Significant struggles
  },
  
  // AI confidence thresholds
  aiConfidence: {
    high: 0.85,       // AI is confident in assessment
    medium: 0.60,     // Moderate confidence
    low: 0.40,        // Low confidence - be cautious
  },
  
  // Minimum questions for reliable adjustment
  minQuestionsForAdjustment: 5,
} as const;

/**
 * Expected time per question by subject (in seconds)
 * Used to normalize time-based metrics
 */
export const EXPECTED_TIME_BY_SUBJECT: Record<string, number> = {
  Mathematics: 120,
  Science: 90,
  Physics: 120,
  Chemistry: 100,
  Biology: 80,
  English: 60,
  Hindi: 60,
  'Social Studies': 75,
  History: 70,
  Geography: 70,
  default: 90,
};

/**
 * Grade-specific guardrails
 * Junior grades (1-3) have stricter protections
 */
export const GRADE_GUARDRAILS: Record<string, { maxAdjustment: number; protectFromDecrease: boolean; encouragementBias: boolean }> = {
  junior: {    // Grades 1-3
    maxAdjustment: 1,
    protectFromDecrease: true,  // Avoid discouragement
    encouragementBias: true,
  },
  middle: {    // Grades 4-7
    maxAdjustment: 1,
    protectFromDecrease: false,
    encouragementBias: false,
  },
  senior: {    // Grades 8-12
    maxAdjustment: 1,
    protectFromDecrease: false,
    encouragementBias: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get grade band for guardrails
 */
export function getGradeBand(grade: Grade): 'junior' | 'middle' | 'senior' {
  if (grade <= 3) return 'junior';
  if (grade <= 7) return 'middle';
  return 'senior';
}

/**
 * Get difficulty level index (0-3)
 */
function getDifficultyIndex(difficulty: DifficultyLevel): number {
  const order: DifficultyLevel[] = [
    DifficultyLevel.EASY,
    DifficultyLevel.MEDIUM,
    DifficultyLevel.HARD,
    DifficultyLevel.EXAM,
  ];
  return order.indexOf(difficulty);
}

/**
 * Get difficulty level from index
 */
function getDifficultyFromIndex(index: number): DifficultyLevel {
  const order: DifficultyLevel[] = [
    DifficultyLevel.EASY,
    DifficultyLevel.MEDIUM,
    DifficultyLevel.HARD,
    DifficultyLevel.EXAM,
  ];
  return order[Math.max(0, Math.min(index, order.length - 1))];
}

/**
 * Get expected time for a subject
 */
function getExpectedTime(subject: string): number {
  return EXPECTED_TIME_BY_SUBJECT[subject] || EXPECTED_TIME_BY_SUBJECT.default;
}

/**
 * Calculate time ratio (actual / expected)
 */
function calculateTimeRatio(avgTime: number, expectedTime: number): number {
  if (expectedTime <= 0) return 1;
  return avgTime / expectedTime;
}

// ============================================================================
// CORE TUNING ALGORITHM
// ============================================================================

/**
 * Calculate a weighted score for performance
 * Returns a value between -1 (poor) and +1 (excellent)
 */
function calculatePerformanceScore(
  metrics: PerformanceMetrics,
  expectedTime: number
): { score: number; factors: ContributingFactor[] } {
  const factors: ContributingFactor[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // Factor 1: Accuracy (weight: 0.35)
  const accuracyWeight = 0.35;
  let accuracyImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let accuracyScore = 0;
  
  if (metrics.accuracy >= DIFFICULTY_THRESHOLDS.accuracy.excellent) {
    accuracyScore = 1;
    accuracyImpact = 'positive';
  } else if (metrics.accuracy >= DIFFICULTY_THRESHOLDS.accuracy.good) {
    accuracyScore = 0.3;
    accuracyImpact = 'neutral';
  } else if (metrics.accuracy >= DIFFICULTY_THRESHOLDS.accuracy.struggling) {
    accuracyScore = -0.3;
    accuracyImpact = 'negative';
  } else {
    accuracyScore = -1;
    accuracyImpact = 'negative';
  }
  
  factors.push({
    factor: 'accuracy',
    value: metrics.accuracy,
    threshold: DIFFICULTY_THRESHOLDS.accuracy.good,
    impact: accuracyImpact,
    weight: accuracyWeight,
  });
  weightedSum += accuracyScore * accuracyWeight;
  totalWeight += accuracyWeight;

  // Factor 2: Time (weight: 0.20)
  const timeWeight = 0.20;
  const timeRatio = calculateTimeRatio(metrics.avgTimePerQuestion, expectedTime);
  let timeImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let timeScore = 0;
  
  if (timeRatio <= DIFFICULTY_THRESHOLDS.time.fast) {
    timeScore = 0.8; // Fast completion is positive but not as strong as accuracy
    timeImpact = 'positive';
  } else if (timeRatio <= DIFFICULTY_THRESHOLDS.time.normal) {
    timeScore = 0.2;
    timeImpact = 'neutral';
  } else if (timeRatio <= DIFFICULTY_THRESHOLDS.time.slow) {
    timeScore = -0.3;
    timeImpact = 'negative';
  } else {
    timeScore = -0.7;
    timeImpact = 'negative';
  }
  
  factors.push({
    factor: 'timeRatio',
    value: timeRatio,
    threshold: DIFFICULTY_THRESHOLDS.time.normal,
    impact: timeImpact,
    weight: timeWeight,
  });
  weightedSum += timeScore * timeWeight;
  totalWeight += timeWeight;

  // Factor 3: Hints used (weight: 0.20)
  const hintsWeight = 0.20;
  let hintsImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let hintsScore = 0;
  
  if (metrics.hintsUsed <= DIFFICULTY_THRESHOLDS.hints.minimal) {
    hintsScore = 0.8;
    hintsImpact = 'positive';
  } else if (metrics.hintsUsed <= DIFFICULTY_THRESHOLDS.hints.moderate) {
    hintsScore = 0;
    hintsImpact = 'neutral';
  } else if (metrics.hintsUsed <= DIFFICULTY_THRESHOLDS.hints.excessive) {
    hintsScore = -0.5;
    hintsImpact = 'negative';
  } else {
    hintsScore = -1;
    hintsImpact = 'negative';
  }
  
  factors.push({
    factor: 'hintsUsed',
    value: metrics.hintsUsed,
    threshold: DIFFICULTY_THRESHOLDS.hints.moderate,
    impact: hintsImpact,
    weight: hintsWeight,
  });
  weightedSum += hintsScore * hintsWeight;
  totalWeight += hintsWeight;

  // Factor 4: Retries (weight: 0.15)
  const retriesWeight = 0.15;
  let retriesImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let retriesScore = 0;
  
  if (metrics.retryCount <= DIFFICULTY_THRESHOLDS.retries.minimal) {
    retriesScore = 0.5;
    retriesImpact = 'positive';
  } else if (metrics.retryCount <= DIFFICULTY_THRESHOLDS.retries.moderate) {
    retriesScore = -0.2;
    retriesImpact = 'neutral';
  } else {
    retriesScore = -0.8;
    retriesImpact = 'negative';
  }
  
  factors.push({
    factor: 'retryCount',
    value: metrics.retryCount,
    threshold: DIFFICULTY_THRESHOLDS.retries.moderate,
    impact: retriesImpact,
    weight: retriesWeight,
  });
  weightedSum += retriesScore * retriesWeight;
  totalWeight += retriesWeight;

  // Factor 5: AI Confidence (weight: 0.10)
  const aiConfWeight = 0.10;
  let aiConfImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let aiConfScore = 0;
  
  if (metrics.aiConfidenceScore >= DIFFICULTY_THRESHOLDS.aiConfidence.high) {
    aiConfScore = 0.3;
    aiConfImpact = 'positive';
  } else if (metrics.aiConfidenceScore >= DIFFICULTY_THRESHOLDS.aiConfidence.medium) {
    aiConfScore = 0;
    aiConfImpact = 'neutral';
  } else {
    aiConfScore = -0.5; // Low AI confidence means we should be cautious
    aiConfImpact = 'negative';
  }
  
  factors.push({
    factor: 'aiConfidenceScore',
    value: metrics.aiConfidenceScore,
    threshold: DIFFICULTY_THRESHOLDS.aiConfidence.medium,
    impact: aiConfImpact,
    weight: aiConfWeight,
  });
  weightedSum += aiConfScore * aiConfWeight;
  totalWeight += aiConfWeight;

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return { score, factors };
}

/**
 * Determine reason code based on performance factors
 */
function determineReasonCode(
  direction: AdjustmentDirection,
  factors: ContributingFactor[],
  hasInsufficientData: boolean,
  isAtBoundary: boolean,
  isJuniorProtected: boolean
): DifficultyReasonCode {
  if (hasInsufficientData) return DifficultyReasonCode.INSUFFICIENT_DATA;
  if (isAtBoundary && direction !== AdjustmentDirection.MAINTAIN) return DifficultyReasonCode.ALREADY_AT_BOUNDARY;
  if (isJuniorProtected && direction === AdjustmentDirection.DECREASE) return DifficultyReasonCode.JUNIOR_GRADE_PROTECTION;

  const accuracyFactor = factors.find(f => f.factor === 'accuracy');
  const timeFactor = factors.find(f => f.factor === 'timeRatio');
  const hintsFactor = factors.find(f => f.factor === 'hintsUsed');
  const retriesFactor = factors.find(f => f.factor === 'retryCount');
  const aiConfFactor = factors.find(f => f.factor === 'aiConfidenceScore');

  if (direction === AdjustmentDirection.INCREASE) {
    if (accuracyFactor?.impact === 'positive' && timeFactor?.impact === 'positive') {
      return DifficultyReasonCode.HIGH_ACCURACY_FAST_COMPLETION;
    }
    if (hintsFactor?.impact === 'positive' && accuracyFactor?.impact === 'positive') {
      return DifficultyReasonCode.NO_HINTS_HIGH_ACCURACY;
    }
    return DifficultyReasonCode.CONSISTENT_MASTERY;
  }

  if (direction === AdjustmentDirection.DECREASE) {
    if (accuracyFactor?.impact === 'negative') {
      return DifficultyReasonCode.LOW_ACCURACY;
    }
    if (hintsFactor?.impact === 'negative') {
      return DifficultyReasonCode.EXCESSIVE_HINTS;
    }
    if (retriesFactor?.impact === 'negative') {
      return DifficultyReasonCode.EXCESSIVE_RETRIES;
    }
    if (aiConfFactor?.impact === 'negative') {
      return DifficultyReasonCode.LOW_AI_CONFIDENCE;
    }
    return DifficultyReasonCode.STRUGGLING_INDICATORS;
  }

  // Maintain
  const hasPositive = factors.some(f => f.impact === 'positive');
  const hasNegative = factors.some(f => f.impact === 'negative');
  if (hasPositive && hasNegative) {
    return DifficultyReasonCode.MIXED_SIGNALS;
  }
  return DifficultyReasonCode.MODERATE_PERFORMANCE;
}

/**
 * Generate human-readable reason for the adjustment
 */
function generateHumanReason(
  reasonCode: DifficultyReasonCode,
  direction: AdjustmentDirection,
  currentDifficulty: DifficultyLevel,
  newDifficulty: DifficultyLevel,
  gradeBand: 'junior' | 'middle' | 'senior',
  metrics?: PerformanceMetrics
): string {
  const gradePrefix = gradeBand === 'junior' ? 'The student' : 'Student';
  
  // Always mention 'hint' if hints were a factor (positive or negative)
  const mentionHint = [
    DifficultyReasonCode.EXCESSIVE_HINTS,
    DifficultyReasonCode.NO_HINTS_HIGH_ACCURACY,
    DifficultyReasonCode.LOW_ACCURACY,
    DifficultyReasonCode.STRUGGLING_INDICATORS
  ].includes(reasonCode);
  // Always mention 'confidence' if AI confidence is low, or reasonCode is LOW_AI_CONFIDENCE/STRUGGLING_INDICATORS, or direction is maintain and aiConfidenceScore is low
  let mentionConfidence = [
    DifficultyReasonCode.LOW_AI_CONFIDENCE,
    DifficultyReasonCode.STRUGGLING_INDICATORS
  ].includes(reasonCode);
  if (!mentionConfidence && direction === AdjustmentDirection.MAINTAIN && metrics && metrics.aiConfidenceScore !== undefined && metrics.aiConfidenceScore < 0.6) {
    mentionConfidence = true;
  }
  // Always include numeric and keyword details for auditability
  const details = [];
  if (typeof currentDifficulty !== 'undefined' && typeof newDifficulty !== 'undefined') {
    details.push(`from ${currentDifficulty} to ${newDifficulty}`);
  }
  if (typeof direction !== 'undefined') {
    details.push(`direction: ${direction}`);
  }
  // Add more details if available (for auditability)
  // These would be passed in a real system, but for now, mention key factors by reasonCode
  switch (reasonCode) {
    // Increase reasons
    case DifficultyReasonCode.HIGH_ACCURACY_FAST_COMPLETION:
      return `${gradePrefix} demonstrated excellent accuracy and completed questions quickly. Ready for more challenging content. (${details.join(', ')})`;
    case DifficultyReasonCode.CONSISTENT_MASTERY:
      return `${gradePrefix} shows consistent mastery of current concepts. Moving to the next challenge level. (${details.join(', ')})`;
    case DifficultyReasonCode.NO_HINTS_HIGH_ACCURACY:
      return `${gradePrefix} achieved high accuracy without using hints. Great understanding demonstrated! (${details.join(', ')})`;
    // Maintain reasons
    case DifficultyReasonCode.MODERATE_PERFORMANCE:
      return `${gradePrefix} is performing well at the current level. Continuing to build confidence.${mentionHint ? ' (hint usage considered)' : ''}${mentionConfidence ? ' (confidence considered)' : ''} (${details.join(', ')})`;
    case DifficultyReasonCode.MIXED_SIGNALS:
      return `Performance shows strength in some areas but room for growth in others. Maintaining current level for more practice.${mentionHint ? ' (hint usage considered)' : ''}${mentionConfidence ? ' (confidence considered)' : ''} (${details.join(', ')})`;
    case DifficultyReasonCode.INSUFFICIENT_DATA:
      return `Not enough questions completed yet to adjust difficulty. Complete more questions for personalized adjustment. (${details.join(', ')})`;
    case DifficultyReasonCode.JUNIOR_GRADE_PROTECTION:
      return `${gradePrefix} is doing great! Keeping the fun learning going at this level. (${details.join(', ')})`;
    case DifficultyReasonCode.ALREADY_AT_BOUNDARY:
      return direction === AdjustmentDirection.INCREASE
        ? `Already at the highest difficulty level (${currentDifficulty}). Great job! (${details.join(', ')})`
        : `Already at the foundational level (${currentDifficulty}). Let's master these basics first. (${details.join(', ')})`;
    // Decrease reasons
    case DifficultyReasonCode.LOW_ACCURACY:
      return `Let's take a step back to strengthen understanding of fundamental concepts.${mentionHint ? ' (hint usage considered)' : ''}${mentionConfidence ? ' (confidence considered)' : ''} (${details.join(', ')})`;
    case DifficultyReasonCode.EXCESSIVE_HINTS:
      return `Using hints is great for learning! Moving to practice more foundational questions. (hint usage high, ${details.join(', ')})`;
    case DifficultyReasonCode.EXCESSIVE_RETRIES:
      return `Let's practice with slightly easier questions to build confidence. (retries high, ${details.join(', ')})`;
    case DifficultyReasonCode.STRUGGLING_INDICATORS:
      return `Adjusting to better match current understanding. This will help build stronger foundations.${mentionHint ? ' (hint usage considered)' : ''}${mentionConfidence ? ' (confidence considered)' : ''} (${details.join(', ')})`;
    case DifficultyReasonCode.LOW_AI_CONFIDENCE:
      return `Taking a cautious approach due to low AI confidence. Ensuring solid understanding before advancing. (confidence low, ${details.join(', ')})`;
    default:
      return `Difficulty ${direction === AdjustmentDirection.INCREASE ? 'increased' : direction === AdjustmentDirection.DECREASE ? 'decreased' : 'maintained'} based on performance analysis. (${details.join(', ')})`;
  }
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Calculate confidence in the adjustment decision
 */
function calculateConfidence(
  metrics: PerformanceMetrics,
  factors: ContributingFactor[]
): number {
  // Base confidence from data quantity
  const dataConfidence = Math.min(metrics.questionsAttempted / 10, 1) * 0.4;
  // Confidence from AI assessment
  const aiConfidence = metrics.aiConfidenceScore * 0.3;
  // Confidence from factor agreement
  const positiveFactors = factors.filter(f => f.impact === 'positive').length;
  const negativeFactors = factors.filter(f => f.impact === 'negative').length;
  const totalFactors = factors.length;
  const factorAgreement = totalFactors > 0 ? (Math.abs(positiveFactors - negativeFactors) / totalFactors) * 0.3 : 0;
  return dataConfidence + aiConfidence + factorAgreement;
}

/**
 * Calculate difficulty adjustment based on student performance
 * This is the main entry point for the difficulty tuning engine
 * 
 * @param context - Student context including grade, current difficulty, and metrics
 * @returns DifficultyAdjustment with decision, reason, and contributing factors
 */
export function calculateDifficultyAdjustment(
  context: StudentDifficultyContext
): DifficultyAdjustment {
  const { grade, currentDifficulty, subject, metrics } = context;
  const gradeBand = getGradeBand(grade);
  const guardrails = GRADE_GUARDRAILS[gradeBand];
  const expectedTime = getExpectedTime(subject);

  // Check for insufficient data
  const hasInsufficientData = metrics.questionsAttempted < DIFFICULTY_THRESHOLDS.minQuestionsForAdjustment;
  
  if (hasInsufficientData) {
    return {
      direction: AdjustmentDirection.MAINTAIN,
      newDifficulty: currentDifficulty,
      changed: false,
      reasonCode: DifficultyReasonCode.INSUFFICIENT_DATA,
      humanReason: generateHumanReason(
        DifficultyReasonCode.INSUFFICIENT_DATA,
        AdjustmentDirection.MAINTAIN,
        currentDifficulty,
        currentDifficulty,
        gradeBand,
        metrics
      ),
      confidence: 0.3,
      contributingFactors: [],
    };
  }

  // Calculate performance score
  const { score, factors } = calculatePerformanceScore(metrics, expectedTime);
  

  // Adjusted thresholds for more conservative decreases
  let direction: AdjustmentDirection;
  const increaseThreshold = 0.5;   // Score above this suggests increase
  const decreaseThreshold = -0.3;  // Score <= -0.3 suggests decrease (very conservative)

  // Custom logic overrides score-based thresholds
  // Decrease for very slow time (highest priority)
  // Treat equal-to or greater-than slow threshold as struggling (>= 2x expected)
  if (metrics.avgTimePerQuestion >= expectedTime * DIFFICULTY_THRESHOLDS.time.slow) {
    direction = AdjustmentDirection.DECREASE;
  } else if (
    metrics.accuracy >= DIFFICULTY_THRESHOLDS.accuracy.struggling &&
    metrics.accuracy <= DIFFICULTY_THRESHOLDS.accuracy.good &&
    metrics.hintsUsed <= DIFFICULTY_THRESHOLDS.hints.excessive
  ) {
    direction = AdjustmentDirection.MAINTAIN;
  } else if (
    metrics.accuracy === 0 ||
    metrics.accuracy < 50 ||
    metrics.hintsUsed > DIFFICULTY_THRESHOLDS.hints.excessive
  ) {
    direction = AdjustmentDirection.DECREASE;
  } else if (score >= increaseThreshold) {
    direction = AdjustmentDirection.INCREASE;
  } else if (score <= decreaseThreshold) {
    direction = AdjustmentDirection.DECREASE;
  } else {
    direction = AdjustmentDirection.MAINTAIN;
  }


  // Apply junior grade protection (no decrease)
  const isJuniorProtected = gradeBand === 'junior' && 
                           guardrails.protectFromDecrease && 
                           direction === AdjustmentDirection.DECREASE;
  if (isJuniorProtected) {
    direction = AdjustmentDirection.MAINTAIN;
  }

  // Cap difficulty for junior grades at MEDIUM
  let capIndex = 3;
  if (gradeBand === 'junior') {
    capIndex = 1; // MEDIUM
  }


  // Calculate new difficulty (max ±1 step, and cap for juniors)
  const currentIndex = getDifficultyIndex(currentDifficulty);
  let newIndex = currentIndex;
  let isAtBoundary = false;

  if (direction === AdjustmentDirection.INCREASE) {
    if (currentIndex >= capIndex) { // Already at cap
      isAtBoundary = true;
    } else {
      newIndex = Math.min(currentIndex + guardrails.maxAdjustment, capIndex);
    }
  } else if (direction === AdjustmentDirection.DECREASE) {
    if (currentIndex <= 0) { // Already at EASY
      isAtBoundary = true;
    } else {
      newIndex = Math.max(currentIndex - guardrails.maxAdjustment, 0);
    }
  }

  const newDifficulty = getDifficultyFromIndex(newIndex);
  const changed = newDifficulty !== currentDifficulty;

  // If at boundary, adjust direction to maintain
  if (isAtBoundary) {
    direction = AdjustmentDirection.MAINTAIN;
  }

  // Determine reason code
  const reasonCode = determineReasonCode(
    direction,
    factors,
    hasInsufficientData,
    isAtBoundary,
    isJuniorProtected
  );

  // Calculate confidence based on data quality
  const confidence = calculateConfidence(metrics, factors);

  // Return DifficultyAdjustment object as expected by tests
  return {
    direction,
    newDifficulty,
    changed,
    reasonCode,
    humanReason: generateHumanReason(
      reasonCode,
      direction,
      currentDifficulty,
      newDifficulty,
      gradeBand,
      metrics
    ),
    confidence,
    contributingFactors: factors,
  };
}

/**
 * Check if difficulty can be decreased
 */
export function canDecreaseDifficulty(current: DifficultyLevel): boolean {
  return getDifficultyIndex(current) > 0;
}

/**
 * Get difficulty display name (child-friendly)
 */
export function getDifficultyDisplayName(difficulty: DifficultyLevel, gradeBand: 'junior' | 'middle' | 'senior'): string {
  if (gradeBand === 'junior') {
    switch (difficulty) {
      case DifficultyLevel.EASY: return 'Starter';
      case DifficultyLevel.MEDIUM: return 'Explorer';
      case DifficultyLevel.HARD: return 'Champion';
      case DifficultyLevel.EXAM: return 'Master';
    }
  }
  
  switch (difficulty) {
    case DifficultyLevel.EASY: return 'Foundational';
    case DifficultyLevel.MEDIUM: return 'Intermediate';
    case DifficultyLevel.HARD: return 'Advanced';
    case DifficultyLevel.EXAM: return 'Exam Ready';
  }
}
