/**
 * FILE OBJECTIVE:
 * - Sanity test ensuring the parent subscription order route module loads.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent/subscription/order.test.ts
 *
 * EDIT LOG:
 * - 2026-04-13T05:10:00Z | copilot | add sanity import test for parent order route
 */

import * as route from '@/app/api/parent/subscription/order/route'

describe('parent subscription order route', () => {
  it('exports a POST handler', () => {
    expect(typeof route.POST).toBe('function')
  })
})
