/**
 * FILE OBJECTIVE:
 * - Unit tests for the analytics event ingestion API endpoint.
 *
 * LINKED UNIT TEST:
 * - tests/api/analytics.event.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | fix prisma mocking (use jest.doMock) to prevent timeout
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Analytics event ingestion', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('accepts a batch of valid events and returns 202', async () => {
    const createManyMock = jest.fn().mockResolvedValue({ count: 2 })
    const mockPrisma: any = {
      analyticsEvent: { createMany: createManyMock },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: mockPrisma }))
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), logAPI: jest.fn() },
    }))

    const route = await import('../../app/api/analytics/event/route')
    const payload = [
      { eventType: 'lesson_viewed', userId: 'u1', courseId: 'c1', lessonIdx: 1, metadata: { t: 10 } },
      { eventType: 'lesson_completed', userId: 'u1', courseId: 'c1', lessonIdx: 1, metadata: { t: 20 } },
    ]
    const res = await route.POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) }) as any,
    )
    expect(res.status).toBe(202)
    expect(createManyMock).toHaveBeenCalled()
  })

  it('rejects invalid eventType with 400', async () => {
    jest.doMock('@/lib/prisma', () => ({
      prisma: { analyticsEvent: { createMany: jest.fn() } },
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), logAPI: jest.fn() },
    }))

    const route = await import('../../app/api/analytics/event/route')
    const payload = [{ eventType: 'unknown_event', userId: 'u1' }]
    const res = await route.POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) }) as any,
    )
    expect(res.status).toBe(400)
  })
})

