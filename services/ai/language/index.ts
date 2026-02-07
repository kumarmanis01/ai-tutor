/**
 * FILE OBJECTIVE:
 * - Barrel export for language service module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/language/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// System prompts
export {
  type LanguageMode,
  type LanguageConfig,
  type LanguageSystemPrompt,
  ENGLISH_SYSTEM_PROMPTS,
  HINDI_SYSTEM_PROMPTS,
  HINGLISH_SYSTEM_PROMPTS,
  LANGUAGE_PROMPTS,
  getLanguageSystemPrompt,
  getCompleteSystemPrompt,
  getDefaultLanguageConfig,
} from './systemPrompts';

// Prompt rewriter
export {
  type RewrittenPrompt,
  type TokenBudget,
  detectLanguage,
  getTokenBudget,
  rewritePromptForLanguage,
  postProcessResponse,
  validateLanguageOutput,
} from './promptRewriter';

// Examples
export {
  NOTES_EXAMPLES,
  PRACTICE_EXAMPLES,
  DOUBT_EXAMPLES,
} from './examples';
