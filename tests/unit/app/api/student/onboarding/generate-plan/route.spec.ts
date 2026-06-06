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
 */

describe('POST /api/student/onboarding/generate-plan', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('emits learning path generated analytics after successful plan generation', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)
    const prismaMock = {
      studentLearningProfile: {
        findUnique: jest.fn().mockResolvedValue({ dailyTargetMin: 30 }),
        upsert: jest.fn().mockResolvedValue({}),
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
    }

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn().mockResolvedValue('plan-1') }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))

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

  it('does not emit analytics when unauthenticated', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(null),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { studentLearningProfile: { findUnique: jest.fn() } } }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    const res = await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5 }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(401)
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('returns skippedSubjects with reason=no_concepts when generateLearningPlan returns null', async () => {
    const prismaMock = {
      studentLearningProfile: {
        findUnique: jest.fn().mockResolvedValue({ dailyTargetMin: 30 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ subjects: ['English'], board: 'CBSE', grade: '5' }) },
      subjectDef: {
        findMany: jest.fn().mockResolvedValue([{ id: 'subject-en', slug: 'english', name: 'English' }]),
      },
      topicDef: { findMany: jest.fn().mockResolvedValue([]) },
      question: { count: jest.fn().mockResolvedValue(0) },
      generatedQuestion: { count: jest.fn().mockResolvedValue(0) },
    }

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-2' } }),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    const res = await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5 }),
      headers: { 'content-type': 'application/json' },
    }) as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.firstSubjectId).toBeNull()
    expect(body.skippedSubjects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'subject-en', reason: 'no_concepts' })]),
    )
  })

  it('returns skippedSubjects with reason=error when generateLearningPlan throws', async () => {
    const prismaMock = {
      studentLearningProfile: {
        findUnique: jest.fn().mockResolvedValue({ dailyTargetMin: 30 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ subjects: ['Math'], board: 'CBSE', grade: '5' }) },
      subjectDef: {
        findMany: jest.fn().mockResolvedValue([{ id: 'subject-math', slug: 'math', name: 'Math' }]),
      },
      topicDef: { findMany: jest.fn().mockResolvedValue([]) },
      question: { count: jest.fn().mockResolvedValue(0) },
      generatedQuestion: { count: jest.fn().mockResolvedValue(0) },
    }

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-3' } }),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/ai/learningPlan', () => ({
      generateLearningPlan: jest.fn().mockRejectedValue(new Error('boom')),
    }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/errorResponse', () => ({ formatErrorForResponse: jest.fn().mockReturnValue('error') }))

    const { POST } = await import('@/app/api/student/onboarding/generate-plan/route')
    const res = await POST(new Request('http://localhost/api/student/onboarding/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ studyDaysPerWeek: 5 }),
      headers: { 'content-type': 'application/json' },
    }) as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skippedSubjects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'subject-math', reason: 'error' })]),
    )
  })
})
