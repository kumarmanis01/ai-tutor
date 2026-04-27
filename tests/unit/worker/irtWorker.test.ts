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

  it('should update theta, mastery, and answerEvent when answer is correct (happy path)', async () => {
    const updateMock = jest.fn(async () => ({}))
    const createAnswerMock = jest.fn(async () => ({}))

    const prismaMock: any = {
      studentConceptState: {
        findUnique: jest.fn(async () => ({ theta: 0.0, masteryScore: 0.5, masteryVariance: 0.1, attemptCount: 2 })),
        create: jest.fn(async () => ({})),
        update: updateMock,
        count: jest.fn(async () => 1), // below full chapter mastery count
      },
      answerEvent: { findFirst: jest.fn(async () => null), create: createAnswerMock },
      concept: { findUnique: jest.fn(async () => null) },
      parentStudent: { findMany: jest.fn(async () => []) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    // newMastery = 0.68 -- below 0.75 threshold so no chapter mastery milestone fires
    jest.doMock('@/lib/ai/tutor/irt.js', () => ({ updateTheta: jest.fn(() => ({ newTheta: 0.5, newMastery: 0.68 })) }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: jest.fn() }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }))

    const { processIRTUpdate } = await import('@/worker/services/irtWorker')

    const job: any = {
      id: 'job-hp',
      data: { studentId: 's1', conceptId: 'c1', sessionId: 'sess1', isCorrect: true, itemDifficulty: 0.3, studentAnswer: 'B', questionId: 'q1' },
    }

    await processIRTUpdate(job)

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId_conceptId: { studentId: 's1', conceptId: 'c1' } } }),
    )
    expect(createAnswerMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ studentId: 's1', sessionId: 'sess1', isCorrect: true }) }),
    )
  })

  it('should not create a duplicate answerEvent when questionId already exists (idempotency)', async () => {
    const createAnswerMock = jest.fn(async () => ({}))

    const prismaMock: any = {
      studentConceptState: {
        findUnique: jest.fn(async () => ({ theta: 0.0, masteryScore: 0.5, masteryVariance: 0.1, attemptCount: 1 })),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
        count: jest.fn(async () => 0),
      },
      // findFirst returns an existing record -- signals that this questionId was already logged
      answerEvent: { findFirst: jest.fn(async () => ({ id: 'existing-ae' })), create: createAnswerMock },
      concept: { findUnique: jest.fn(async () => null) },
      parentStudent: { findMany: jest.fn(async () => []) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/tutor/irt.js', () => ({ updateTheta: jest.fn(() => ({ newTheta: 0.3, newMastery: 0.5 })) }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: jest.fn() }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }))

    const { processIRTUpdate } = await import('@/worker/services/irtWorker')

    const job: any = {
      id: 'job-idem',
      data: { studentId: 's2', conceptId: 'c1', sessionId: 'sess2', isCorrect: false, itemDifficulty: 0.0, studentAnswer: 'X', questionId: 'q-dup' },
    }

    await processIRTUpdate(job)

    expect(createAnswerMock).not.toHaveBeenCalled()
  })

  it('should log error and rethrow when DB update fails', async () => {
    const errorLogMock = jest.fn()

    const prismaMock: any = {
      studentConceptState: {
        findUnique: jest.fn(async () => ({ theta: 0.0, masteryScore: 0.3, masteryVariance: 0.1, attemptCount: 0 })),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => { throw new Error('DB write failed') }),
        count: jest.fn(async () => 0),
      },
      answerEvent: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
      concept: { findUnique: jest.fn(async () => null) },
      parentStudent: { findMany: jest.fn(async () => []) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: errorLogMock } }))
    jest.doMock('@/lib/ai/tutor/irt.js', () => ({ updateTheta: jest.fn(() => ({ newTheta: 0.2, newMastery: 0.35 })) }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: jest.fn() }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }))

    const { processIRTUpdate } = await import('@/worker/services/irtWorker')

    const job: any = {
      id: 'job-err',
      data: { studentId: 's3', conceptId: 'c1', sessionId: 'sess3', isCorrect: true, itemDifficulty: 0.0, studentAnswer: 'A' },
    }

    await expect(processIRTUpdate(job)).rejects.toThrow('DB write failed')
    expect(errorLogMock).toHaveBeenCalledWith(
      '[irt-worker] process failed',
      expect.objectContaining({ studentId: 's3' }),
    )
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
