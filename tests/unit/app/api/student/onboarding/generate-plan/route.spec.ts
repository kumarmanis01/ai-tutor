/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/onboarding/generate-plan analytics emission and response behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/onboarding/generate-plan/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add learning path generated analytics coverage for onboarding plan generation
 * - 2026-05-25T00:00:00Z | copilot | add DIAGNOSTICS_INCOMPLETE guard tests
 */

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    studentLearningProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: 'slp-1', dailyTargetMin: 30, recommendations: {} }),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ subjects: ['Math'], board: 'CBSE', grade: '8' }),
    },
    subjectDef: {
      findMany: jest.fn().mockResolvedValue([{ id: 'subject-1', slug: 'math', name: 'Math' }]),
    },
    topicDef: {
      findMany: jest.fn().mockResolvedValue([{ id: 'topic-1' }]),
    },
    question: { count: jest.fn().mockResolvedValue(1) },
    generatedQuestion: { count: jest.fn().mockResolvedValue(0) },
    ...overrides,
  }
}

describe('POST /api/student/onboarding/generate-plan', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('should return 422 DIAGNOSTICS_INCOMPLETE when enrolled subject lacks completed diagnostic', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: buildPrismaMock() }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))
    // Diagnostic NOT complete
    jest.doMock('@/lib/student/diagnosticGuard', () => ({ hasDiagnosticForSubject: jest.fn().mockResolvedValue(false) }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    const res = await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5 }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.code).toBe('DIAGNOSTICS_INCOMPLETE')
    expect(body.pendingSubjects).toContain('subject-1')
  })

  it('should save study preferences before returning 422 so they are available post-diagnostic', async () => {
    const upsertMock = jest.fn().mockResolvedValue({})
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: buildPrismaMock({ studentLearningProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'slp-1', recommendations: {} }), upsert: upsertMock, update: jest.fn() } }),
    }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))
    jest.doMock('@/lib/student/diagnosticGuard', () => ({ hasDiagnosticForSubject: jest.fn().mockResolvedValue(false) }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5, examDate: '2027-03-15T00:00:00.000Z' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    // studyDaysPerWeek must be persisted even on 422
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ studyDaysPerWeek: 5 }),
      }),
    )
  })

  it('should generate the plan and emit analytics when all diagnostics are complete', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: buildPrismaMock() }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn().mockResolvedValue('plan-1') }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))
    // All diagnostics complete
    jest.doMock('@/lib/student/diagnosticGuard', () => ({ hasDiagnosticForSubject: jest.fn().mockResolvedValue(true) }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    const res = await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5 }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.learning_path.generated', userId: 'student-1', courseId: 'subject-1' }),
      'student.onboarding.generate-plan',
    )
  })

  it('should return 401 and not emit analytics when unauthenticated', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(null),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { studentLearningProfile: { findUnique: jest.fn() } } }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))
    jest.doMock('@/lib/student/diagnosticGuard', () => ({ hasDiagnosticForSubject: jest.fn() }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    const res = await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5 }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(401)
    expect(emitMock).not.toHaveBeenCalled()
  })
})
