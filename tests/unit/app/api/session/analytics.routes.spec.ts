/**
 * FILE OBJECTIVE:
 * - Unit tests for analytics emission in structured session start, phase advance, completion, and test submission routes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/analytics.routes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add focused coverage for canonical session analytics emission routes
 * - 2026-05-13T00:00:00Z | copilot | add coverage for first-session and session-phase analytics emissions
 */

import { jest } from '@jest/globals'

describe('session analytics routes', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('session start emits SESSION_START analytics', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/session/sessionEngine', () => ({
      startSession: jest.fn().mockResolvedValue({ sessionId: 'sess-1', topicId: 'topic-1', currentPhase: 'OVERVIEW' }),
      getPhaseContent: jest.fn().mockReturnValue({ phase: 'OVERVIEW' }),
      isSessionEngineEnabled: jest.fn().mockReturnValue(true),
      SessionError: class extends Error { status = 400 },
    }))
    jest.doMock('@/lib/session/getPhaseContent', () => ({
      resolvePhaseContent: jest.fn().mockResolvedValue({ ok: true }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        analyticsEvent: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    }))
    jest.doMock('@/lib/session/sessionEvents', () => ({ recordSessionEvent: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))

    const { POST } = await import('@/app/api/session/start/route')

    const res = await POST(new Request('http://localhost/api/session/start', {
      method: 'POST',
      body: JSON.stringify({ topicId: 'topic-1' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.session.start', courseId: 'topic-1' }),
      'session.start',
    )
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.first_session', courseId: 'topic-1' }),
      'session.start.first',
    )
  })

  test('session next emits lesson viewed when entering EXPLANATION', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/session/sessionEngine', () => ({
      advanceSession: jest.fn().mockResolvedValue({ sessionId: 'sess-1', topicId: 'topic-1', currentPhase: 'EXPLANATION' }),
      getPhaseContent: jest.fn().mockReturnValue({ phase: 'EXPLANATION' }),
      isSessionEngineEnabled: jest.fn().mockReturnValue(true),
      SessionError: class extends Error { status = 400 },
    }))
    jest.doMock('@/lib/session/getPhaseContent', () => ({
      resolvePhaseContent: jest.fn().mockResolvedValue({ ok: true }),
    }))
    jest.doMock('@/lib/session/phaseCompletionValidator', () => ({
      markExplanationViewed: jest.fn().mockResolvedValue(undefined),
    }))
    jest.doMock('@/lib/session/sessionEvents', () => ({ recordSessionEvent: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/events/sessionEventListeners', () => ({}))

    const { POST } = await import('@/app/api/session/next/route')

    const res = await POST(new Request('http://localhost/api/session/next', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.session.phases', courseId: 'topic-1' }),
      'session.next.phase',
    )
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'lesson_viewed', courseId: 'topic-1' }),
      'session.next.explanation',
    )
  })

  test('session complete emits SESSION_COMPLETE analytics', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/session/sessionEngine', () => ({
      completeSession: jest.fn().mockResolvedValue({ sessionId: 'sess-1', topicId: 'topic-1', currentPhase: 'COMPLETE' }),
      getPhaseContent: jest.fn().mockReturnValue({ phase: 'COMPLETE' }),
      isSessionEngineEnabled: jest.fn().mockReturnValue(true),
      SessionError: class extends Error { status = 400 },
    }))
    jest.doMock('@/lib/session/getPhaseContent', () => ({
      resolvePhaseContent: jest.fn().mockResolvedValue({ ok: true }),
    }))
    jest.doMock('@/lib/session/sessionEvents', () => ({ recordSessionEvent: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/events/sessionEventListeners', () => ({}))

    const { POST } = await import('@/app/api/session/complete/route')

    const res = await POST(new Request('http://localhost/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.session.complete', courseId: 'topic-1' }),
      'session.complete',
    )
  })

  test('test submit emits attempted and passed analytics when score meets threshold', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/session/sessionEngine', () => ({
      isSessionEngineEnabled: jest.fn().mockReturnValue(true),
    }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/learning/updateTopicProgress', () => ({ updateStudentTopicProgress: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/session/sessionEvents', () => ({ recordSessionEvents: jest.fn() }))
    jest.doMock('@/lib/tests', () => ({ normalizeAnswer: (value: string) => value.trim().toLowerCase() }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() } }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        structuredSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'sess-1',
            studentId: 'student-1',
            topicId: 'topic-1',
            state: 'TEST',
            meta: { servedTestIds: ['q1'] },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        question: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'q1', type: 'MCQ', choices: [{ key: 'A', text: 'Correct' }], correctAnswer: 'A' },
          ]),
        },
      },
    }))

    const { POST } = await import('@/app/api/session/[sessionId]/test/submit/route')

    const res = await POST(
      new Request('http://localhost/api/session/sess-1/test/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: [{ questionId: 'q1', answer: 'A' }] }),
        headers: { 'content-type': 'application/json' },
      }) as any,
      { params: Promise.resolve({ sessionId: 'sess-1' }) },
    )

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventType: 'quiz_attempted', courseId: 'topic-1' }),
      'session.test.submit',
    )
    expect(emitMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ eventType: 'quiz_passed', courseId: 'topic-1' }),
      'session.test.submit.pass',
    )
  })
})
