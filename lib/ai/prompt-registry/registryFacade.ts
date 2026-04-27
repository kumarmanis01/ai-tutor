/**
 * FILE OBJECTIVE:
 * - Provide centralized in-memory prompt registry facade functions required by Sprint 7 AC.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompt-registry/registryFacade.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created getPrompt/listPrompts/getActiveVersion facade over default registry
 */

import { DEFAULT_PROMPTS } from './defaults';
import { PromptRegistry } from './promptRegistry';
import { PromptConfig, PromptListFilter, PromptType } from './types';

const defaultRegistry = new PromptRegistry(DEFAULT_PROMPTS);

export function getPrompt(type: PromptType, version?: string): PromptConfig {
  return defaultRegistry.getPrompt(type, version);
}

export function listPrompts(filter?: PromptListFilter): PromptConfig[] {
  return defaultRegistry.listPrompts(filter);
}

export function getActiveVersion(type: PromptType): string {
  return defaultRegistry.getActiveVersion(type);
}
