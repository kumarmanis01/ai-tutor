/**
 * FILE OBJECTIVE:
 * - Public exports for prompt registry infrastructure.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompt-registry/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created prompt registry barrel exports
 */

export {
  PromptType,
  PromptStatus,
  type PromptConfig,
  type PromptListFilter,
  type PromptListDbFilter,
  type PromptVariables,
  type PromptVersionRecord,
} from './types';
export { PromptRegistry } from './promptRegistry';
export { PromptService, promptService } from './promptService';
export { DEFAULT_PROMPTS, DEFAULT_PROMPT_TEMPLATES, buildUserPromptFromTemplate } from './defaults';
export { getPrompt, listPrompts } from './registryFacade';
