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

  it('sends cancellation confirmation email on downgrade scheduling', async () => {
    jest.resetModules()

    const sendMailSafe = jest.fn(async () => undefined)
    const paymentCreate = jest.fn(async () => ({ id: 'pay_sched' }))

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'parent-1', role: 'parent' } })),
    }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        parentStudent: { findMany: jest.fn(async () => [{ studentId: 'child-1' }]) },
        subscription: { findFirst: jest.fn(async () => ({ id: 'sub-1', endDate: new Date('2026-06-30T00:00:00.000Z') })) },
        payment: { create: paymentCreate },
        user: { findUnique: jest.fn(async () => ({ email: 'parent@example.test', name: 'Parent', parentPhoneVerifiedAt: new Date() })) },
      },
    }))

    const routeModule = await import('@/app/api/parent/subscription/change/route')
    const req = new Request('http://localhost/api/parent/subscription/change', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'downgrade', planId: 'standard_monthly', childIds: ['child-1'], isFamily: false }),
    })

    const res = await routeModule.POST(req)
    expect(res.status).toBe(200)
    expect(paymentCreate).toHaveBeenCalled()
    expect(sendMailSafe).toHaveBeenCalled()
  })
})
