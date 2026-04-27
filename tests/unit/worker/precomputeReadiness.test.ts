/**
 * FILE OBJECTIVE:
 * - Unit tests for `precomputeReadiness` to ensure readiness drops trigger
 *   push + parent milestone notifications.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/precomputeReadiness.test.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('precomputeReadiness', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('fires readiness drop and notifies parents when score falls', async () => {
    const sendPushMock = jest.fn(async () => undefined)
    const sendParentMock = jest.fn(async () => undefined)

    const prismaMock: any = {
      structuredSession: { findMany: jest.fn(async () => [{ studentId: 's1' }]) },
      user: { findMany: jest.fn(async () => [{ id: 's1', subjects: ['math'] }]) },
      subjectDef: { findMany: jest.fn(async () => [{ id: 'sub1', name: 'math', slug: 'math' }]) },
      parentStudent: { findMany: jest.fn(async () => [{ parent: { id: 'p1', email: 'p@example.test', phone: null, name: 'Parent', language: 'en' }, status: 'active' }]) },
    }

    // computeReadinessScore returns lower score than previous (drop)
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/student/examReadiness', () => ({ computeReadinessScore: jest.fn(async () => ({ score: 60 })) }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: jest.fn(async (key: string) => (key.includes('readiness:score:') ? '75' : null)), set: jest.fn(async () => 'OK') }) }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: sendPushMock }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendParentMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))

    const { precomputeReadiness } = await import('@/worker/jobs/precomputeReadiness')

    const result = await precomputeReadiness()

    expect(result.students).toBeGreaterThanOrEqual(1)
    expect(result.scores).toBeGreaterThanOrEqual(1)
    expect(sendPushMock).toHaveBeenCalled()
    expect(sendParentMock).toHaveBeenCalled()
  })
})
