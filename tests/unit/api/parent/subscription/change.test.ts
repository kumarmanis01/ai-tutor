/**
 * FILE OBJECTIVE:
 * - Sanity test ensuring the parent subscription change route module loads.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent/subscription/change.test.ts
 *
 * EDIT LOG:
 * - 2026-04-13T05:10:00Z | copilot | add sanity import test for parent change route
 */

import * as route from '@/app/api/parent/subscription/change/route'

describe('parent subscription change route', () => {
  it('exports a POST handler', () => {
    expect(typeof route.POST).toBe('function')
  })
})
