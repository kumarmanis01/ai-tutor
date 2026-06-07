import { jest } from '@jest/globals'

/**
 * NOTE: After the 2026-05-20 refactor, the route no longer enqueues analytics
 * jobs directly or writes to AnalyticsEvent itself -- `emitServerAnalyticsEvent`
 * owns queue-vs-DB fallback. These tests now assert the route's actual contract:
 * a properly shaped event is emitted via emitServerAnalyticsEvent.
 */

const mockEmitServerAnalyticsEvent = jest.fn().mockResolvedValue(undefined)

describe('Diagnostic start analytics emission', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  function arrangeRouteMocks(questions: Array<{ id: string }>) {
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: mockEmitServerAnalyticsEvent }))
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }),
    }))
    jest.doMock('@/lib/diagnostics/diagnosticQuestionService', () => ({
      generateSubjectDiagnosticTest: jest.fn().mockResolvedValue({
        id: 'test1',
        subjectId: 's1',
        subjectName: 'Mathematics',
        questions,
      }),
    }))
    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      getSubjectDiagnosticStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
      upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue({}),
    }))
    jest.doMock('@/lib/diagnostics/sessionStore', () => ({
      createSession: jest.fn().mockResolvedValue(undefined),
    }))
    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({
      enqueueDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined),
    }))
  }

  test('emits student.diagnostics.start with subjectId and totalQuestions', async () => {
    arrangeRouteMocks([{ id: 'q1' }, { id: 'q2' }])

    const { POST } = await import('app/api/student/diagnostic/start/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ boardSlug: 'cbse', grade: 9, subjectSlug: 'math' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    expect(mockEmitServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'student.diagnostics.start',
        userId: 'u1',
        metadata: expect.objectContaining({ subjectId: 's1', totalQuestions: 2 }),
      }),
      expect.any(String),
    )
  })

  test('still returns 200 even when emitServerAnalyticsEvent throws (best-effort)', async () => {
    mockEmitServerAnalyticsEvent.mockRejectedValueOnce(new Error('analytics-down'))
    arrangeRouteMocks([{ id: 'q1' }])

    const { POST } = await import('app/api/student/diagnostic/start/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ boardSlug: 'cbse', grade: 9, subjectSlug: 'math' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    expect(mockEmitServerAnalyticsEvent).toHaveBeenCalled()
  })
})
