/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/analytics/server.ts best-effort analytics emission.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/analytics/server.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add queue and DB fallback coverage for server analytics emitter
 */

import { jest } from '@jest/globals'

describe('lib/analytics/server', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('uses analytics queue when available', async () => {
    const addMock = jest.fn().mockResolvedValue(undefined)
    const createMock = jest.fn()

    jest.doMock('@/lib/queues/analyticsQueue', () => ({
      getAnalyticsQueue: () => ({ add: addMock }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: { analyticsEvent: { create: createMock } },
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn() },
    }))

    const { emitServerAnalyticsEvent } = await import('@/lib/analytics/server')

    await emitServerAnalyticsEvent(
      {
        eventType: 'student.session.start',
        userId: 'u1',
        courseId: 'topic-1',
        metadata: { sessionId: 's1' },
      },
      'test.queue',
    )

    expect(addMock).toHaveBeenCalledWith(
      'analytics.ingest',
      expect.objectContaining({
        eventType: 'student.session.start',
        userId: 'u1',
        courseId: 'topic-1',
        metadata: { sessionId: 's1' },
      }),
    )
    expect(createMock).not.toHaveBeenCalled()
  })

  test('falls back to direct DB write when enqueue fails', async () => {
    const addMock = jest.fn().mockRejectedValue(new Error('queue-down'))
    const createMock = jest.fn().mockResolvedValue({ id: 'evt-1' })
    const warnMock = jest.fn()

    jest.doMock('@/lib/queues/analyticsQueue', () => ({
      getAnalyticsQueue: () => ({ add: addMock }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: { analyticsEvent: { create: createMock } },
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: warnMock },
    }))

    const { emitServerAnalyticsEvent } = await import('@/lib/analytics/server')

    await emitServerAnalyticsEvent(
      {
        eventType: 'student.session.complete',
        userId: 'u1',
        metadata: { sessionId: 's1' },
      },
      'test.fallback',
    )

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'student.session.complete',
        userId: 'u1',
        metadata: { sessionId: 's1' },
      }),
    })
    expect(warnMock).toHaveBeenCalled()
  })
})
