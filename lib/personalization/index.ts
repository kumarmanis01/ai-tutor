/**
 * FILE OBJECTIVE:
 * - Barrel export for personalization services.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/personalization/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

export {
  // Enums
  DifficultyLevel,
  AdjustmentDirection,
  DifficultyReasonCode,
  
  // Types
  type PerformanceMetrics,
  type StudentDifficultyContext,
  type DifficultyAdjustment,
  type ContributingFactor,
  
  // Configuration
  DIFFICULTY_THRESHOLDS,
  EXPECTED_TIME_BY_SUBJECT,
  GRADE_GUARDRAILS,
  
  // Functions
  getGradeBand,
  calculateDifficultyAdjustment,
  canDecreaseDifficulty,
  getDifficultyDisplayName,
} from './difficultyTuning';
