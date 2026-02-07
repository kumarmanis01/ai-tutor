/**
 * FILE OBJECTIVE:
 * - Barrel export for failure recovery module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/failureRecovery/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// Schemas and types
export {
  StuckIndicator,
  StuckSeverity,
  RecoveryAction,
  StudentStateSchema,
  StuckDetectionResultSchema,
  RecoveryPlanSchema,
  getRecoveryConfig,
  type StudentState,
  type StuckDetectionResult,
  type RecoveryPlan,
  type DetectionThresholds,
  type GradeRecoveryConfig,
} from './schemas';

// Detection and recovery logic
export {
  detectStuckState,
  createRecoveryPlan,
} from './detector';
