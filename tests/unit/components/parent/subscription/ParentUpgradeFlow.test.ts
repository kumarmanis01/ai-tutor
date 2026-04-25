/**
 * FILE OBJECTIVE:
 * - Sanity unit test to ensure the ParentUpgradeFlow component module imports correctly.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/subscription/ParentUpgradeFlow.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T05:00:00Z | copilot | add minimal import/test matching Jest testMatch
 */

import ParentUpgradeFlow from '@/components/parent/subscription/ParentUpgradeFlow';

describe('ParentUpgradeFlow (sanity)', () => {
  it('exports a component function', () => {
    expect(typeof ParentUpgradeFlow).toBe('function');
  });
});
