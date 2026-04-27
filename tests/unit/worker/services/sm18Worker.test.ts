/**
 * Unit tests for pre-exam mode notification logic in sm18Worker.
 * F-STU-022 AC-07: Pre-exam mode activates automatically 14 days before exam.
 *                  Student notified of mode change.
 *
 * Tests the date comparison logic inline (pure logic -- worker itself needs DB+Redis).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */


/** Mirror of the PRE_EXAM_DAYS constant in sm18Worker. */
const PRE_EXAM_DAYS = 14
const MS_PER_DAY = 86400000

/** Returns true if examDate is within PRE_EXAM_DAYS from now.
 * Uses `> -1` (not `>= 0`) so that an exam date of "today" is always
 * included even when the two Date() calls differ by microseconds. */
function isPreExam(examDate: Date, now = new Date()): boolean {
  const msToExam = examDate.getTime() - now.getTime()
  const daysToExam = msToExam / MS_PER_DAY
  return daysToExam > -1 && daysToExam <= PRE_EXAM_DAYS
}

describe('sm18Worker -- pre-exam mode detection', () => {
  it('should detect pre-exam mode when exam is today', () => {
    expect(isPreExam(new Date())).toBe(true)
  })

  it('should detect pre-exam mode when exam is exactly 14 days away', () => {
    const exam = new Date(Date.now() + 14 * MS_PER_DAY)
    expect(isPreExam(exam)).toBe(true)
  })

  it('should not detect pre-exam mode when exam is 15 days away', () => {
    const exam = new Date(Date.now() + 15 * MS_PER_DAY)
    expect(isPreExam(exam)).toBe(false)
  })

  it('should not detect pre-exam mode when exam has already passed', () => {
    const past = new Date(Date.now() - MS_PER_DAY)
    expect(isPreExam(past)).toBe(false)
  })

  it('should detect pre-exam mode when exam is 7 days away', () => {
    const exam = new Date(Date.now() + 7 * MS_PER_DAY)
    expect(isPreExam(exam)).toBe(true)
  })
})

// ── processNightlySM18 integration-style unit tests ───────────────────────────

describe('processNightlySM18', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('should update nextReviewAt for each due row (happy path)', async () => {
    const updateMock = jest.fn(async () => ({}))

    const pastDate = new Date(Date.now() - MS_PER_DAY)
    const rows = [
      { id: 'r1', studentId: 's1', conceptId: 'c1', stability: 10, retention: 0.8, lastInteraction: pastDate },
      { id: 'r2', studentId: 's1', conceptId: 'c2', stability: 5, retention: 0.7, lastInteraction: pastDate },
    ]

    // First call returns the batch; second call returns empty to stop the loop
    const findManyMock = jest.fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([])

    const prismaMock: any = {
      learningPlan: { findMany: jest.fn(async () => []) },
      subjectDef: { findMany: jest.fn(async () => []) },
      studentConceptState: { findMany: findManyMock, update: updateMock },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/tutor/sm18.js', () => ({
      updateSM18: jest.fn(() => ({ newStability: 12, newRetention: 0.82, nextReviewInDays: 8 })),
    }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/push/notifications', () => ({ PUSH_NOTIFICATIONS: { exam_14_days: jest.fn(() => ({})) } }))

    const { processNightlySM18 } = await import('@/worker/services/sm18Worker')
    await processNightlySM18()

    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ nextReviewAt: expect.any(Date) }),
      }),
    )
  })

  it('should continue processing remaining rows when one row DB update fails (error resilience)', async () => {
    const warnMock = jest.fn()

    const pastDate = new Date(Date.now() - MS_PER_DAY)
    const rows = [
      { id: 'r1', studentId: 's1', conceptId: 'c1', stability: 10, retention: 0.8, lastInteraction: pastDate },
      { id: 'r2', studentId: 's1', conceptId: 'c2', stability: 5, retention: 0.7, lastInteraction: pastDate },
    ]

    const findManyMock = jest.fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([])

    // First update throws; second succeeds
    const updateMock = jest.fn()
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockResolvedValueOnce({})

    const prismaMock: any = {
      learningPlan: { findMany: jest.fn(async () => []) },
      subjectDef: { findMany: jest.fn(async () => []) },
      studentConceptState: { findMany: findManyMock, update: updateMock },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: warnMock, error: jest.fn() } }))
    jest.doMock('@/lib/ai/tutor/sm18.js', () => ({
      updateSM18: jest.fn(() => ({ newStability: 8, newRetention: 0.75, nextReviewInDays: 6 })),
    }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/push/notifications', () => ({ PUSH_NOTIFICATIONS: { exam_14_days: jest.fn(() => ({})) } }))

    const { processNightlySM18 } = await import('@/worker/services/sm18Worker')

    // Must not throw -- error is per-row, batch continues
    await expect(processNightlySM18()).resolves.toBeUndefined()

    // Both rows attempted
    expect(updateMock).toHaveBeenCalledTimes(2)
    // Error on r1 was logged as a warning (not a fatal throw)
    expect(warnMock).toHaveBeenCalledWith(
      '[sm18-worker] row update failed',
      expect.objectContaining({ id: 'r1' }),
    )
  })

  it('should use PRE_EXAM_TARGET_RETENTION for students with exams within 14 days', async () => {
    const updateSM18Mock = jest.fn(() => ({ newStability: 10, newRetention: 0.9, nextReviewInDays: 5 }))

    const pastDate = new Date(Date.now() - MS_PER_DAY)
    const rows = [
      { id: 'r1', studentId: 's-pre-exam', conceptId: 'c1', stability: 10, retention: 0.85, lastInteraction: pastDate },
    ]

    const prismaMock: any = {
      learningPlan: {
        findMany: jest.fn(async () => [{ studentId: 's-pre-exam', subjectId: 'subj1' }]),
      },
      subjectDef: { findMany: jest.fn(async () => [{ id: 'subj1', name: 'Math' }]) },
      studentConceptState: {
        findMany: jest.fn()
          .mockResolvedValueOnce(rows)
          .mockResolvedValueOnce([]),
        update: jest.fn(async () => ({})),
      },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/tutor/sm18.js', () => ({ updateSM18: updateSM18Mock }))
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }))
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }))
    jest.doMock('@/lib/push/notifications', () => ({ PUSH_NOTIFICATIONS: { exam_14_days: jest.fn(() => ({})) } }))

    const { processNightlySM18 } = await import('@/worker/services/sm18Worker')
    await processNightlySM18()

    // updateSM18 should have been called with targetRetention = 0.92 for the pre-exam student
    expect(updateSM18Mock).toHaveBeenCalledWith(
      expect.objectContaining({ targetRetention: 0.92 }),
    )
  })
})
