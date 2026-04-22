/**
 * FILE OBJECTIVE:
 * - Expose design tokens to runtime JS (useful for canvas, JS color arrays, and non-CSS usages).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ui/theme.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T12:30:00Z | copilot | added JS helper to expose design tokens for runtime usage
 */

import type { CSSVariables } from '@/components/UI/variants/designTokens';
import { generateVariablesForGrade } from '@/components/UI/variants/designTokens';
import type { Grade } from '@/lib/ai/prompts/schemas';

/**
 * Return the full set of CSS custom properties for a given grade.
 */
export function tokensForGrade(grade: Grade): CSSVariables {
  return generateVariablesForGrade(grade);
}

/**
 * Get a single token value by key (e.g. '--color-primary').
 */
export function getToken(grade: Grade, key: string): string | number | undefined {
  const tokens = generateVariablesForGrade(grade);
  return tokens[key as keyof CSSVariables];
}

export default {
  tokensForGrade,
  getToken,
};
