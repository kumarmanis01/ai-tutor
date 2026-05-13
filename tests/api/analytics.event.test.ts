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
 * - 2026-04-21T00:00:00Z | staff-engineer | Task D: mock analytics queue; add allowlist tests
 * - 2026-04-21T00:00:00Z | staff-engineer | review fix: remove jest.mock() from beforeEach (unreliable after resetModules)
 * - 2026-05-13T00:00:00Z | copilot | update accepted eventType example to canonical student.auth.signin registry event
 */
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Top-level jest.mock is hoisted before any imports and reliably applied for all tests.
// Each test uses jest.doMock + dynamic import after jest.resetModules() so each test
// gets a fresh module instance with its own Prisma mock.
// The queue mock here ensures no live Redis connection is needed in any test.
jest.mock('@/lib/queues/analyticsQueue', () => ({
  getAnalyticsQueue: jest.fn().mockReturnValue(null),
}))

describe('Analytics event ingestion', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    // Re-apply queue mock via doMock so it is honoured after resetModules.
    jest.doMock('@/lib/queues/analyticsQueue', () => ({
      getAnalyticsQueue: jest.fn().mockReturnValue(null),
    }))
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

  it('accepts student.auth.signin event and returns 202', async () => {
    const createManyMock = jest.fn().mockResolvedValue({ count: 1 })
    const mockPrisma: any = {
      analyticsEvent: { createMany: createManyMock },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: mockPrisma }))
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), logAPI: jest.fn() },
    }))

    const route = await import('../../app/api/analytics/event/route')
    const payload = [{ eventType: 'student.auth.signin', userId: 'u1', metadata: { source: 'web' } }]
    const res = await route.POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) }) as any,
    )
    expect(res.status).toBe(202)
    expect(createManyMock).toHaveBeenCalled()
  })

  it('rejects server-only event types from client', async () => {
    jest.doMock('@/lib/prisma', () => ({
      prisma: { analyticsEvent: { createMany: jest.fn() } },
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), logAPI: jest.fn() },
    }))

    const route = await import('../../app/api/analytics/event/route')
    // ai_call, safety_trigger, hallucination_detected must never be accepted from clients
    for (const serverOnlyType of ['ai_call', 'safety_trigger', 'hallucination_detected', 'ingest_run']) {
      const payload = [{ eventType: serverOnlyType, userId: 'u1' }]
      const res = await route.POST(
        new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) }) as any,
      )
      expect(res.status).toBe(400)
    }
  })
})
