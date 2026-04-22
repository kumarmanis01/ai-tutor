/**
 * FILE OBJECTIVE:
 * - Unit tests for `lib/ui/theme.ts` helper that exposes design tokens to runtime JS.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ui/theme.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T12:30:00Z | copilot | added tests for token helper
 */

import { tokensForGrade, getToken } from '@/lib/ui/theme';
import type { Grade } from '@/lib/ai/prompts/schemas';

describe('lib/ui/theme', () => {
  test('tokensForGrade returns at least the primary color token', () => {
    const grade = 9 as Grade;
    const tokens = tokensForGrade(grade);
    expect(tokens).toBeDefined();
    expect(tokens['--color-primary']).toBeDefined();
    const primary = getToken(grade, '--color-primary');
    expect(typeof primary === 'string' || typeof primary === 'number').toBe(true);
  });
});
