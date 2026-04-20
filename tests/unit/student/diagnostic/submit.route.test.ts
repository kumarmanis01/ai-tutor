/* eslint-disable @typescript-eslint/no-explicit-any */

jest.resetModules()

describe('POST /api/student/diagnostic/submit (AC-08 rapid-fire detection)', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('logs a rapid-fire gaming flag when > ratio of answers are under the threshold', async () => {
    const mockSession = { user: { id: 'student-xyz' } }

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => mockSession) }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { rapidFireThresholdMs: 1000, rapidFireRatioThreshold: 0.3, minAnswersForValidity: 10 } }))

    const prismaMock: any = {
      question: { findMany: jest.fn(async () => [
        { id: 'q1', correctAnswer: '0', choices: ['A','B'], topicId: 't1' },
        { id: 'q2', correctAnswer: '1', choices: ['A','B'], topicId: 't1' },
      ]) },
      concept: { findMany: jest.fn(async () => [{ id: 'c1', topicId: 't1' }]) },
      topicDef: { findMany: jest.fn(async () => []) },
      chapterDef: { findMany: jest.fn(async () => [{ id: 'chap-1' }]) },
      user: { findUnique: jest.fn(async () => ({ board: 'b1' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'grade-1' } })) },
      answerEvent: { createMany: jest.fn(async () => ({ count: 2 })) },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logAPI: jest.fn() }
    jest.doMock('@/lib/logger', () => ({ logger: loggerMock }))

    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      upsertSubjectDiagnosticStatus: jest.fn(),
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
    }))

    const { POST } = await import('@/app/api/student/diagnostic/submit/route')

    function makeRequest(body: unknown): Request {
      return { json: () => Promise.resolve(body) } as unknown as Request
    }

    const body = {
      subjectId: 'sub-1',
      answers: [
        { questionId: 'q1', selectedOption: '0', timeSpentMs: 500 },
        { questionId: 'q2', selectedOption: '1', timeSpentMs: 400 },
      ],
    }

    const res = await POST(makeRequest(body) as any)

    expect(res.status).toBe(200)
    // Logger.warn should have been called to flag gaming
    expect(loggerMock.warn).toHaveBeenCalled()
    const warnMsg = loggerMock.warn.mock.calls.find((c: any[]) => String(c[0]).includes('rapid-fire'))
    expect(warnMsg).toBeTruthy()
  })
})
