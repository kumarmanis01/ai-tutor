import { jest } from '@jest/globals'

/**
 * NOTE: After the analytics-server refactor, the route emits via
 * emitServerAnalyticsEvent; queue-vs-DB fallback is owned by that helper, not
 * the route. We assert the route's actual contract: it emits
 * student.diagnostics.end with the expected shape.
 */

const mockEmitServerAnalyticsEvent = jest.fn().mockResolvedValue(undefined)

function basePrismaMock(questions: Array<{ id: string; correctAnswer: string; choices: string[]; topicId: string }>) {
  return {
    question: { findMany: jest.fn().mockResolvedValue(questions) },
    concept: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', topicId: 't1' }]) },
    topicDef: { findMany: jest.fn().mockResolvedValue([{ id: 't1', chapterId: 'ch1' }]) },
    subjectDef: { findUnique: jest.fn().mockResolvedValue({ class: { id: 'grade-9' } }) },
    user: { findUnique: jest.fn().mockResolvedValue({ board: 'cbse' }) },
    answerEvent: { createMany: jest.fn().mockResolvedValue(undefined) },
    analyticsEvent: { create: jest.fn().mockResolvedValue(undefined) },
    diagnosticSession: {
      upsert: jest.fn().mockResolvedValue(undefined),
      // Route's new idempotency guard short-circuits with 200 if status === 'COMPLETED'.
      // Returning null keeps the happy path.
      findUnique: jest.fn().mockResolvedValue(null),
    },
  }
}

function arrangeMocks(prismaMock: ReturnType<typeof basePrismaMock>) {
  jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: mockEmitServerAnalyticsEvent }))
  jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
  jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }) }))
  jest.doMock('@/jobs/diagnosticBootstrap', () => ({ enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(undefined) }))
  jest.doMock('@/lib/redis/diagnosticPartial', () => ({ clearPartialDiagnostic: jest.fn().mockResolvedValue(undefined) }))
  jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({ cancelDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined) }))
  jest.doMock('@/lib/diagnostics/stateStore', () => ({ upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue(undefined) }))
  jest.doMock('@/lib/diagnostics/sessionStore', () => ({ getSession: jest.fn().mockResolvedValue(null) }))
  jest.doMock('@/lib/diagnostics/selector', () => ({ computeSessionTheta: jest.fn().mockResolvedValue({ theta: 0 }) }))
  jest.doMock('@/lib/irt/irt', () => ({ thetaToPlacement: jest.fn().mockReturnValue('at') }))
}

describe('Diagnostic submit analytics emission', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('emits student.diagnostics.end with total/answered/correct counts', async () => {
    const prismaMock = basePrismaMock([
      { id: 'q1', correctAnswer: 'A', choices: ['A', 'B'], topicId: 't1' },
      { id: 'q2', correctAnswer: '0', choices: ['opt0', 'opt1'], topicId: 't1' },
    ])
    arrangeMocks(prismaMock)

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

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    expect(mockEmitServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'student.diagnostics.end',
        userId: 'u1',
        metadata: expect.objectContaining({ totalQuestions: 2, answeredCount: 2 }),
      }),
      expect.any(String),
    )
  })

  test('still returns 200 when emitServerAnalyticsEvent throws (best-effort)', async () => {
    mockEmitServerAnalyticsEvent.mockRejectedValueOnce(new Error('analytics-down'))
    const prismaMock = basePrismaMock([
      { id: 'q1', correctAnswer: 'A', choices: ['A'], topicId: 't1' },
    ])
    arrangeMocks(prismaMock)

    const { POST } = await import('app/api/student/diagnostic/submit/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: 's1',
        answers: [{ questionId: 'q1', selectedOption: 'A', timeSpentMs: 1000 }],
      }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as never)
    expect(res.status).toBe(200)
    expect(mockEmitServerAnalyticsEvent).toHaveBeenCalled()
  })
})
