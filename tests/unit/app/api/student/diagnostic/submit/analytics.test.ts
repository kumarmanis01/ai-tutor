import { jest } from '@jest/globals'

const mockEmitServerAnalyticsEvent = jest.fn().mockResolvedValue(undefined)

describe('Diagnostic submit analytics emission', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('enqueues diagnostic_completed when analytics queue available', async () => {
    const addMock = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/queues/analyticsQueue', () => ({ getAnalyticsQueue: () => ({ add: addMock }) }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: mockEmitServerAnalyticsEvent }))

    // Prisma mocks
    const questionMock = [
      { id: 'q1', correctAnswer: 'A', choices: ['A', 'B'], topicId: 't1' },
      { id: 'q2', correctAnswer: '0', choices: ['opt0', 'opt1'], topicId: 't1' },
    ]
    const prismaMock = {
      question: { findMany: jest.fn().mockResolvedValue(questionMock) },
      concept: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', topicId: 't1' }]) },
      topicDef: { findMany: jest.fn().mockResolvedValue([{ id: 't1', chapterId: 'ch1' }]) },
      subjectDef: { findUnique: jest.fn().mockResolvedValue({ class: { id: 'grade-9' } }) },
      user: { findUnique: jest.fn().mockResolvedValue({ board: 'cbse' }) },
      answerEvent: { createMany: jest.fn().mockResolvedValue(undefined) },
      diagnosticSession: { upsert: jest.fn().mockResolvedValue(undefined) },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    // Other dependencies
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }) }))
    jest.doMock('@/jobs/diagnosticBootstrap', () => ({ enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/redis/diagnosticPartial', () => ({ clearPartialDiagnostic: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({ cancelDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/diagnostics/stateStore', () => ({ upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/diagnostics/sessionStore', () => ({ getSession: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/diagnostics/selector', () => ({ computeSessionTheta: jest.fn().mockResolvedValue({ theta: 0 }) }))
    jest.doMock('@/lib/irt/irt', () => ({ thetaToPlacement: jest.fn().mockReturnValue('at') }))

    const { POST } = await import('app/api/student/diagnostic/submit/route')

    const body = {
      subjectId: 's1',
      answers: [
        { questionId: 'q1', selectedOption: 'A', timeSpentMs: 500 },
        { questionId: 'q2', selectedOption: 'opt0', timeSpentMs: 1500 },
      ],
    }

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as any)

    expect(addMock).toHaveBeenCalled()
    const call = addMock.mock.calls[0][1] || addMock.mock.calls[0][0]
    const jobData = call?.data ?? call
    expect(jobData.eventType).toBe('diagnostic_completed')
    expect(jobData.metadata).toMatchObject({ totalQuestions: 2, answeredCount: 2, correctCount: 2 })
    expect(mockEmitServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'student.diagnostics.end',
        userId: 'u1',
      }),
      expect.any(String),
    )
    expect(res.status).toBe(200)
  })

  test('falls back to DB when analytics queue unavailable on submit', async () => {
    jest.doMock('@/lib/queues/analyticsQueue', () => ({ getAnalyticsQueue: () => null }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: mockEmitServerAnalyticsEvent }))

    const prismaMock = {
      question: { findMany: jest.fn().mockResolvedValue([{ id: 'q1', correctAnswer: 'A', choices: ['A'], topicId: 't1' }]) },
      concept: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', topicId: 't1' }]) },
      topicDef: { findMany: jest.fn().mockResolvedValue([{ id: 't1', chapterId: 'ch1' }]) },
      subjectDef: { findUnique: jest.fn().mockResolvedValue({ class: { id: 'grade-9' } }) },
      user: { findUnique: jest.fn().mockResolvedValue({ board: 'cbse' }) },
      answerEvent: { createMany: jest.fn().mockResolvedValue(undefined) },
      analyticsEvent: { create: jest.fn().mockResolvedValue(undefined) },
      diagnosticSession: { upsert: jest.fn().mockResolvedValue(undefined) },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }) }))
    jest.doMock('@/jobs/diagnosticBootstrap', () => ({ enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/redis/diagnosticPartial', () => ({ clearPartialDiagnostic: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({ cancelDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/diagnostics/stateStore', () => ({ upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/diagnostics/sessionStore', () => ({ getSession: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/diagnostics/selector', () => ({ computeSessionTheta: jest.fn().mockResolvedValue({ theta: 0 }) }))
    jest.doMock('@/lib/irt/irt', () => ({ thetaToPlacement: jest.fn().mockReturnValue('at') }))

    const { POST } = await import('app/api/student/diagnostic/submit/route')

    const body = {
      subjectId: 's1',
      answers: [{ questionId: 'q1', selectedOption: 'A', timeSpentMs: 1000 }],
    }

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as any)

    expect(prismaMock.analyticsEvent.create).toHaveBeenCalled()
    const created = prismaMock.analyticsEvent.create.mock.calls[0][0]
    expect(created.data.eventType).toBe('diagnostic_completed')
    expect(created.data.metadata).toMatchObject({ totalQuestions: 1, answeredCount: 1 })
    expect(res.status).toBe(200)
  })

  test('falls back to DB when analytics enqueue throws on submit', async () => {
    const addMock = jest.fn().mockRejectedValue(new Error('enqueue-error'))
    jest.doMock('@/lib/queues/analyticsQueue', () => ({ getAnalyticsQueue: () => ({ add: addMock }) }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: mockEmitServerAnalyticsEvent }))

    const prismaMock = {
      question: { findMany: jest.fn().mockResolvedValue([{ id: 'q1', correctAnswer: 'A', choices: ['A'], topicId: 't1' }]) },
      concept: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', topicId: 't1' }]) },
      topicDef: { findMany: jest.fn().mockResolvedValue([{ id: 't1', chapterId: 'ch1' }]) },
      subjectDef: { findUnique: jest.fn().mockResolvedValue({ class: { id: 'grade-9' } }) },
      user: { findUnique: jest.fn().mockResolvedValue({ board: 'cbse' }) },
      answerEvent: { createMany: jest.fn().mockResolvedValue(undefined) },
      analyticsEvent: { create: jest.fn().mockResolvedValue(undefined) },
      diagnosticSession: { upsert: jest.fn().mockResolvedValue(undefined) },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }) }))
    jest.doMock('@/jobs/diagnosticBootstrap', () => ({ enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/redis/diagnosticPartial', () => ({ clearPartialDiagnostic: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({ cancelDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/diagnostics/stateStore', () => ({ upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/diagnostics/sessionStore', () => ({ getSession: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/diagnostics/selector', () => ({ computeSessionTheta: jest.fn().mockResolvedValue({ theta: 0 }) }))
    jest.doMock('@/lib/irt/irt', () => ({ thetaToPlacement: jest.fn().mockReturnValue('at') }))

    const { POST } = await import('app/api/student/diagnostic/submit/route')

    const body = {
      subjectId: 's1',
      answers: [{ questionId: 'q1', selectedOption: 'A', timeSpentMs: 1000 }],
    }

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as any)

    expect(prismaMock.analyticsEvent.create).toHaveBeenCalled()
    const created = prismaMock.analyticsEvent.create.mock.calls[0][0]
    expect(created.data.eventType).toBe('diagnostic_completed')
    expect(created.data.metadata).toMatchObject({ totalQuestions: 1, answeredCount: 1 })
    expect(res.status).toBe(200)
  })
})
