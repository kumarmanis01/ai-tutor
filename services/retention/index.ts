/**
 * FILE OBJECTIVE:
 * - Barrel export for retention metrics module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/retention/index.spec.ts
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
  RetentionWindow,
  MetricCategory,
  ChurnRisk,
  RedFlag,
  DailyEngagementSchema,
  ConfidenceTrendSchema,
  DifficultyProgressionSchema,
  ParentInvolvementSchema,
  RetentionStatusSchema,
  CohortRetentionSchema,
  RedFlagDetectionSchema,
  ChurnRiskAssessmentSchema,
  RETENTION_TARGETS,
  DEFAULT_RED_FLAG_THRESHOLDS,
  RED_FLAG_INTERVENTIONS,
  getRetentionTargets,
  type DailyEngagement,
  type ConfidenceTrend,
  type DifficultyProgression,
  type ParentInvolvement,
  type RetentionStatus,
  type CohortRetention,
  type RedFlagDetection,
  type ChurnRiskAssessment,
  type RedFlagThresholds,
} from './schemas';

// Tracking and analysis logic
export {
  calculateRetentionStatus,
  calculateCohortRetention,
  detectRedFlags,
  assessChurnRisk,
} from './tracker';
