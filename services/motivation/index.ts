/**
 * FILE OBJECTIVE:
 * - Barrel export for motivation signal engine.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/motivation/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// Schemas & Types
export {
  MotivationFocus,
  MotivationTone,
  MotivationTrigger,
  LearningAnalyticsSchema,
  MotivationMessageSchema,
  GRADE_MOTIVATION_CONFIG,
  getMotivationConfig,
  getToneForGrade,
  type LearningAnalytics,
  type MotivationMessage,
  type GradeMotivationConfig,
} from './schemas';

// Generator
export {
  detectMotivationSignals,
  selectBestFocus,
  generateMotivationMessage,
  translateToHindi,
  translateToHinglish,
} from './generator';

// Examples
export {
  exampleGrade2Student,
  exampleGrade6Student,
  exampleGrade9Student,
  exampleStrugglingStudent,
  runAllMotivationExamples,
} from './examples';
