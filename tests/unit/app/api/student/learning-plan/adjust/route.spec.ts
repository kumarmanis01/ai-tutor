/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/learning-plan/adjust route behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/learning-plan/adjust/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | add route tests for auth, mid-week behind detection, and regeneration enqueue
 * - 2026-05-13T00:00:00Z | copilot | add analytics assertion for learning path altered emissions on queued adjustments
 */

describe('POST /api/student/learning-plan/adjust', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns 401 when unauthenticated', async () => {
    jest.setSystemTime(new Date('2026-05-04T10:00:00.000Z'))

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => null) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        learningPlan: { findMany: jest.fn() },
        structuredSession: { findFirst: jest.fn() },
        learningPlanItem: { count: jest.fn() },
      },
    }))
    jest.doMock('@/lib/ai/learningPlanRegeneration', () => ({
      enqueueLearningPlanRegeneration: jest.fn(async () => true),
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { POST } = await import('@/app/api/student/learning-plan/adjust/route')

    const res = await POST(new Request('http://localhost/api/student/learning-plan/adjust', { method: 'POST' }) as any)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('does not mark as behind before mid-week', async () => {
    jest.setSystemTime(new Date('2026-05-04T10:00:00.000Z')) // Monday

    const enqueueMock = jest.fn(async () => true)
    const countMock = jest.fn(async () => 0)

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'u1' } })) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        learningPlan: {
          findMany: jest.fn(async () => [
            {
              id: 'plan-1',
              subjectId: 'math',
              weeklyGoal: 6,
              examDate: null,
              generatedAt: new Date('2026-05-03T00:00:00.000Z'),
            },
          ]),
        },
        structuredSession: { findFirst: jest.fn(async () => ({ startedAt: new Date('2026-05-03T00:00:00.000Z') })) },
        learningPlanItem: { count: countMock },
      },
    }))
    jest.doMock('@/lib/ai/learningPlanRegeneration', () => ({ enqueueLearningPlanRegeneration: enqueueMock }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { POST } = await import('@/app/api/student/learning-plan/adjust/route')

    const res = await POST(new Request('http://localhost/api/student/learning-plan/adjust', { method: 'POST' }) as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.adjusted).toBe(false)
    expect(body.subjectsQueued).toBe(0)
    expect(countMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('queues regeneration when behind at or after mid-week', async () => {
    jest.setSystemTime(new Date('2026-05-06T10:00:00.000Z')) // Wednesday

    const enqueueMock = jest.fn(async () => true)
    const emitMock = jest.fn(async () => undefined)

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'u1' } })) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        learningPlan: {
          findMany: jest.fn(async () => [
            {
              id: 'plan-1',
              subjectId: 'math',
              weeklyGoal: 6,
              examDate: null,
              generatedAt: new Date('2026-05-05T00:00:00.000Z'),
            },
          ]),
        },
        structuredSession: { findFirst: jest.fn(async () => ({ startedAt: new Date('2026-05-01T00:00:00.000Z') })) },
        learningPlanItem: { count: jest.fn(async () => 1) },
      },
    }))
    jest.doMock('@/lib/ai/learningPlanRegeneration', () => ({ enqueueLearningPlanRegeneration: enqueueMock }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { POST } = await import('@/app/api/student/learning-plan/adjust/route')

    const res = await POST(new Request('http://localhost/api/student/learning-plan/adjust', { method: 'POST' }) as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.adjusted).toBe(true)
    expect(body.subjectsQueued).toBe(1)
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'u1', subjectId: 'math', weeklyGoal: 6 }),
    )
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.learning_path.altered', userId: 'u1', courseId: 'math' }),
      'student.learning-plan.adjust',
    )
  })
})
