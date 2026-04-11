/**
 * FILE OBJECTIVE:
 * - Unit tests for `processIRTUpdate` to ensure chapter mastery triggers
 *   parent milestone notifications via the delivery helper.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/irtWorker.test.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('processIRTUpdate', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('sends parent notification on chapter mastery', async () => {
    const sendParentMock = jest.fn(async () => undefined)

    // Minimal prisma mock
    const prismaMock: any = {
      studentConceptState: {
        findUnique: jest.fn(async () => ({ theta: 0, masteryScore: 0.0, attemptCount: 0 })),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
        count: jest.fn(async () => 2),
      },
      answerEvent: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
      concept: { findUnique: jest.fn(async () => ({ topic: { chapter: { id: 'chap-1', name: 'Algebra' } } })), findMany: jest.fn(async () => [{ id: 'c1' }, { id: 'c2' }]) },
      parentStudent: { findMany: jest.fn(async () => [{ parent: { id: 'parent-1', email: 'p@example.test', phone: null, name: 'Parent', language: 'en' } }]) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    // Force updateTheta to return newMastery above threshold
    jest.doMock('@/lib/ai/tutor/irt.js', () => ({ updateTheta: jest.fn(() => ({ newTheta: 1.0, newMastery: 0.9 })) }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendParentMock }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: jest.fn(async () => null), set: jest.fn(async () => 'OK') }) }))

    const { processIRTUpdate } = await import('@/worker/services/irtWorker')

    const job: any = { id: 'job-1', data: { studentId: 's1', conceptId: 'c1', sessionId: 'sess1', isCorrect: true, itemDifficulty: 0.5, studentAnswer: 'A' } }

    await processIRTUpdate(job)

    // checkChapterMastery is invoked asynchronously via void; wait a tick
    await new Promise((r) => setTimeout(r, 10))

    const delivery = await import('@/lib/notifications/delivery')
    expect(delivery.sendParentMilestoneNotification).toHaveBeenCalled()
  })
})
