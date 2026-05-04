/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/learning-plan/today route behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/learning-plan/today/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | add tests for stale-plan guarded regeneration trigger
 */

describe('GET /api/student/learning-plan/today', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-10T10:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns 401 when unauthenticated', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => null) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        learningPlan: { findFirst: jest.fn() },
        structuredSession: { findFirst: jest.fn() },
        learningPlanItem: { findFirst: jest.fn() },
      },
    }))
    jest.doMock('@/lib/homeEngine/getNextAction', () => ({ getNextAction: jest.fn(async () => null) }))
    jest.doMock('@/lib/ai/learningPlanRegeneration', () => ({
      enqueueLearningPlanRegeneration: jest.fn(async () => true),
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { GET } = await import('@/app/api/student/learning-plan/today/route')

    const res = await GET(new Request('http://localhost/api/student/learning-plan/today') as any)
    expect(res.status).toBe(401)
  })

  it('queues guarded regeneration when plan is stale', async () => {
    const enqueueMock = jest.fn(async () => true)

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'u1' } })) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        learningPlan: {
          findFirst: jest.fn(async () => ({
            id: 'plan-1',
            subjectId: 'math',
            weeklyGoal: 5,
            examDate: null,
            generatedAt: new Date('2026-04-01T00:00:00.000Z'),
          })),
        },
        structuredSession: { findFirst: jest.fn(async () => ({ startedAt: new Date('2026-04-01T00:00:00.000Z') })) },
        learningPlanItem: { findFirst: jest.fn(async () => null) },
      },
    }))
    jest.doMock('@/lib/homeEngine/getNextAction', () => ({ getNextAction: jest.fn(async () => ({ action: 'resume' })) }))
    jest.doMock('@/lib/ai/learningPlanRegeneration', () => ({ enqueueLearningPlanRegeneration: enqueueMock }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { GET } = await import('@/app/api/student/learning-plan/today/route')

    const res = await GET(new Request('http://localhost/api/student/learning-plan/today') as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fallback).toBe(false)
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'u1', subjectId: 'math', weeklyGoal: 5 }),
    )
  })
})
