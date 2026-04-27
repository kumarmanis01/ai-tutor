/**
 * FILE OBJECTIVE:
 * - Barrel export for diagnostic onboarding engine.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/diagnostic/index.spec.ts
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
  DiagnosticDifficulty,
  DiagnosticQuestionType,
  CognitiveSkill,
  DiagnosticQuestionSchema,
  DiagnosticResponseSchema,
  DiagnosticSessionSchema,
  DiagnosticOutputSchema,
  DIAGNOSTIC_CONFIG,
  getDiagnosticConfig,
  type DiagnosticQuestion,
  type DiagnosticResponse,
  type DiagnosticSession,
  type DiagnosticOutput,
  type DiagnosticConfig,
} from './schemas';

// Engine
export {
  DiagnosticEngine,
  createDiagnosticSession,
  type QuestionBank,
} from './engine';
