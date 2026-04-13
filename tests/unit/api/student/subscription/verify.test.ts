/**
 * FILE OBJECTIVE:
 * - Sanity test ensuring the student subscription verify route module loads and exports a POST handler.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/subscription/verify.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T05:25:00Z | copilot | add sanity import test for student verify route
 */

import * as route from '@/app/api/student/subscription/verify/route'

describe('student subscription verify route', () => {
  it('exports a POST handler', () => {
    expect(typeof route.POST).toBe('function')
  })
})
