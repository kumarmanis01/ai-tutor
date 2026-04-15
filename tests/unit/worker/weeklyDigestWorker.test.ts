/**
 * FILE OBJECTIVE:
 * - Unit tests for `processParentDigest` ensuring the centralized delivery
 *   helper `sendParentMilestoneNotification` is used for weekly digests.
 * - Unit tests for `processWeeklyDigest` covering opt-out and dedup suppression.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/weeklyDigestWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | added test for digest -> delivery helper wiring
 * - 2026-04-14T00:00:00Z | copilot | added opt-out and dedup suppression tests
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
    // Prevent real OpenAI calls: ALLOW_LLM_CALLS=1 is set globally in forceTestNodeEnv.cjs
    jest.doMock('@/lib/callLLM', () => ({ callLLM: jest.fn().mockRejectedValue(new Error('callLLM mocked in unit tests')) }))

    const { processParentDigest } = await import('../../../worker/services/weeklyDigestWorker')

    await processParentDigest('p1', null)

    expect(sendMock).toHaveBeenCalled()
  })
})

describe('processWeeklyDigest -- suppression', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('should skip scheduling when parent has digestOptOut = true', async () => {
    const outboxCreateMock = jest.fn(async () => ({}))
    const infoMock = jest.fn()

    const prismaMock: any = {
      parentStudent: {
        findMany: jest.fn(async () => [
          {
            parentId: 'p1',
            studentId: 's1',
            parent: { name: 'Parent', email: 'parent@example.test', timezone: null },
            student: { name: 'Asha' },
          },
        ]),
      },
      parentProfile: {
        findMany: jest.fn(async () => [
          { userId: 'p1', digestOptOut: true, digestDay: 'Sunday', digestTime: '09:00', digestTimezone: 'Asia/Kolkata' },
        ]),
      },
      outbox: {
        findFirst: jest.fn(async () => null),
        create: outboxCreateMock,
      },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: infoMock, warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/engagement/timezone', () => ({
      getLocalDateString: jest.fn(() => '2026-04-13'),
      startOfLocalDayUtc: jest.fn(() => new Date('2026-04-13T00:00:00Z')),
    }))

    const { processWeeklyDigest } = await import('../../../worker/services/weeklyDigestWorker')
    await processWeeklyDigest()

    // Outbox row must NOT be created for opted-out parent
    expect(outboxCreateMock).not.toHaveBeenCalled()
    // Should log the opt-out skip
    expect(infoMock).toHaveBeenCalledWith(
      '[weeklyDigest] parent opted out, skipping',
      expect.objectContaining({ parentId: 'p1' }),
    )
  })

  it('should skip scheduling when outbox entry with same dedupKey already exists', async () => {
    const outboxCreateMock = jest.fn(async () => ({}))
    const infoMock = jest.fn()

    const prismaMock: any = {
      parentStudent: {
        findMany: jest.fn(async () => [
          {
            parentId: 'p2',
            studentId: 's2',
            parent: { name: 'Parent2', email: 'parent2@example.test', timezone: null },
            student: { name: 'Ravi' },
          },
        ]),
      },
      parentProfile: {
        // No profile -> digestOptOut is undefined -> not opted out
        findMany: jest.fn(async () => []),
      },
      outbox: {
        // Existing outbox row found for this dedupKey -> dedup triggers
        findFirst: jest.fn(async () => ({ id: 'existing-outbox-row' })),
        create: outboxCreateMock,
      },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: infoMock, warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/engagement/timezone', () => ({
      getLocalDateString: jest.fn(() => '2026-04-13'),
      startOfLocalDayUtc: jest.fn(() => new Date('2026-04-13T00:00:00Z')),
    }))

    const { processWeeklyDigest } = await import('../../../worker/services/weeklyDigestWorker')
    await processWeeklyDigest()

    // Outbox row must NOT be created when dedupKey already exists
    expect(outboxCreateMock).not.toHaveBeenCalled()
    // Should log the dedup skip
    expect(infoMock).toHaveBeenCalledWith(
      '[weeklyDigest] outbox exists, skipping create',
      expect.objectContaining({ parentId: 'p2' }),
    )
  })
})
