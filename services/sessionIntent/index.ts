/**
 * FILE OBJECTIVE:
 * - Barrel export for session intent resolver.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/sessionIntent/index.spec.ts
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
  SessionIntent,
  IntentUrgency,
  StudentMood,
  INTENT_MODIFIERS,
  GRADE_INTENT_CONFIG,
  SessionIntentSchema,
  getIntentConfig,
  getIntentModifiers,
  isIntentValidForGrade,
  type SessionIntentData,
  type IntentPromptModifiers,
  type GradeIntentConfig,
} from './schemas';

// Resolver
export {
  resolveSessionIntent,
  buildIntentSystemPrompt,
  buildIntentUserPromptPrefix,
  createJuniorDefaultIntent,
  shouldShowIntentPrompt,
  isIntentRequired,
  type IntentResolutionInput,
  type ResolvedIntent,
} from './resolver';
