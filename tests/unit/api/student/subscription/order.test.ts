/**
 * FILE OBJECTIVE:
 * - Sanity test ensuring the student subscription order route module loads and exports a POST handler.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/subscription/order.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T05:25:00Z | copilot | add sanity import test for student order route
 */

import * as route from '@/app/api/student/subscription/order/route';

describe('student subscription order route', () => {
  it('exports a POST handler', () => {
    expect(typeof route.POST).toBe('function');
  });
});
