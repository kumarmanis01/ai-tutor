/**
 * FILE OBJECTIVE:
 * - Sanity test ensuring the parent subscription verify route module loads.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent/subscription/verify.test.ts
 *
 * EDIT LOG:
 * - 2026-04-13T05:10:00Z | copilot | add sanity import test for parent verify route
 */

import * as route from '@/app/api/parent/subscription/verify/route'

describe('parent subscription verify route', () => {
  it('exports a POST handler', () => {
    expect(typeof route.POST).toBe('function')
  })
})
