/* eslint-disable @typescript-eslint/no-explicit-any */

jest.resetModules()

describe('POST /api/student/diagnostic/start (AC-08 retake cooldown + exclude previous questions)', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 429 RETAKE_COOLDOWN when previous run is within 30-day cooldown', async () => {
    const mockSession = { user: { id: 'student-1' } }

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => mockSession) }))
    jest.doMock('@/lib/diagnostics/diagnosticQuestionService', () => ({
      generateSubjectDiagnosticTest: jest.fn(async () => ({ subjectId: 'sub-1', subjectName: 'Sub', questions: [] })),
    }))
    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'completed', completedAt: new Date().toISOString() })),
      upsertSubjectDiagnosticStatus: jest.fn(),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { answerEvent: { findMany: jest.fn() } } }))
    const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logAPI: jest.fn() }
    jest.doMock('@/lib/logger', () => ({ logger: loggerMock }))

    const { POST } = await import('@/app/api/student/diagnostic/start/route')

    function makeRequest(body: object): Request {
      return { json: () => Promise.resolve(body) } as unknown as Request
    }

    const req = makeRequest({ boardSlug: 'cbse', grade: '8', subjectSlug: 'math' })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.code).toBe('RETAKE_COOLDOWN')
    expect(loggerMock.logAPI).toHaveBeenCalled()
  })

  it('when eligible for retake, excludes previous questions by passing prevIds to generator', async () => {
    const mockSession = { user: { id: 'student-2' } }

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => mockSession) }))

    const genMock = jest.fn()
    // First call returns basic test; second call (with prevIds) returns new test
    genMock.mockResolvedValueOnce({ subjectId: 'sub-2', subjectName: 'Sub2', questions: [{ id: 'q-new' }] })
    genMock.mockResolvedValueOnce({ subjectId: 'sub-2', subjectName: 'Sub2', questions: [{ id: 'q-new-2' }] })
    jest.doMock('@/lib/diagnostics/diagnosticQuestionService', () => ({ generateSubjectDiagnosticTest: genMock }))

    // Completed long ago -> eligible for retake
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'completed', completedAt: longAgo, runId: 'prev-run' })),
      upsertSubjectDiagnosticStatus: jest.fn(),
    }))

    const prismaMock: any = {
      answerEvent: { findMany: jest.fn(async () => [{ questionId: 'prev-q-1' }, { questionId: 'prev-q-2' }]) },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logAPI: jest.fn() }
    jest.doMock('@/lib/logger', () => ({ logger: loggerMock }))

    // Mock sessionStore helpers that are called later
    jest.doMock('@/lib/diagnostics/sessionStore', () => ({ createSession: jest.fn() }))
    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({ enqueueDiagnosticAutoSubmit: jest.fn() }))

    const { POST } = await import('@/app/api/student/diagnostic/start/route')

    function makeRequest(body: object): Request {
      return { json: () => Promise.resolve(body) } as unknown as Request
    }

    const body = { boardSlug: 'cbse', grade: '9', subjectSlug: 'physics', languageCode: 'en' }
    const res = await POST(makeRequest(body) as any)
    const json = await res.json()

    // Successful start should return 200 and a sessionId
    expect(res.status).toBe(200)
    expect(json.sessionId).toBeDefined()

    // generateSubjectDiagnosticTest should have been called twice (initial + regen)
    expect(genMock).toHaveBeenCalled()
    expect(genMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    const secondCallSecondArg = genMock.mock.calls[1][1]
    expect(secondCallSecondArg).toBeInstanceOf(Set)
    expect(Array.from(secondCallSecondArg)).toEqual(expect.arrayContaining(['prev-q-1', 'prev-q-2']))
  })
})
