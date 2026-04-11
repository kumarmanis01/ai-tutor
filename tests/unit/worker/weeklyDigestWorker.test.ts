/**
 * FILE OBJECTIVE:
 * - Unit tests for `processParentDigest` ensuring the centralized delivery
 *   helper `sendParentMilestoneNotification` is used for weekly digests.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/weeklyDigestWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | added test for digest -> delivery helper wiring
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('processParentDigest', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('calls sendParentMilestoneNotification when a parent and child exist', async () => {
    const sendMock = jest.fn(async () => ({ sent: true }))

    const prismaMock: any = {
      parentStudent: { findFirst: jest.fn(async () => ({ studentId: 's1', student: { name: 'Asha' }, parent: { name: 'Parent', email: 'p@example.test' } })) },
      structuredSession: { findMany: jest.fn(async () => [{ id: 'sess1' }]) },
      studentStreak: { findFirst: jest.fn(async () => ({ current: 4 })) },
      studentConceptState: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }))

    const { processParentDigest } = await import('../../../worker/services/weeklyDigestWorker')

    await processParentDigest('p1', null)

    expect(sendMock).toHaveBeenCalled()
  })
})
