/**
 * FILE OBJECTIVE:
 * - Barrel export for schema-first prompt architecture.
 * - Single entry point for all prompt-related imports.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export for prompt architecture
 */

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================
export type {
  // Shared types
  Board,
  Language,
  Grade,
  Difficulty,
  QuestionType,
  ExplanationLevel,
  ContentLength,
  StudentIntent,
  ConfidenceLevel,
  
  // Base contexts
  StudentContext,
  TopicContext,
  
  // Notes
  NotesInputContract,
  NotesOutputSchema,
  ExplanationSection,
  WorkedExample,
  
  // Practice
  PracticeInputContract,
  PracticeOutputSchema,
  GeneratedQuestion,
  
  // Doubts
  DoubtsInputContract,
  DoubtsOutputSchema,
  ConversationMessage,
  
  // Metadata
  PromptMetadata,
  ValidationResult,
} from './schemas';

export {
  DIFFICULTY_CALIBRATION,
  INTENT_REWRITES,
  shouldRewriteIntent,
  getEffectiveIntent,
} from './schemas';

// ============================================================================
// GLOBAL SYSTEM PROMPT
// ============================================================================
export {
  GLOBAL_SYSTEM_PROMPT,
  buildSystemPrompt,
  getGradeLanguageGuidance,
  getLanguageInstructions,
} from './global';

// ============================================================================
// PROMPT BUILDERS
// ============================================================================
export {
  NOTES_OUTPUT_SCHEMA,
  buildNotesPrompt,
  isValidNotesResponse,
} from './notes';

export {
  PRACTICE_OUTPUT_SCHEMA,
  buildPracticePrompt,
  isValidPracticeResponse,
  generateQuestionIds,
} from './practice';

export {
  DOUBTS_OUTPUT_SCHEMA,
  buildDoubtsPrompt,
  isValidDoubtsResponse,
  isOffTopicQuestion,
  getOffTopicRedirect,
} from './doubts';

// ============================================================================
// VALIDATORS
// ============================================================================
export {
  safeParseLLMJson,
  validateNotesOutput,
  validatePracticeOutput,
  validateDoubtsOutput,
  validateLLMResponse,
  type PromptType,
} from './validators';

// ============================================================================
// PROMPT BUILDER (UNIFIED API)
// ============================================================================
export {
  TIMEOUT_CONFIG,
  RETRY_CONFIG,
  generateNotes,
  generatePractice,
  generateDoubtResponse,
  type PromptResult,
} from './promptBuilder';
