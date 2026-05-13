/**
 * FILE OBJECTIVE:
 * - Unit tests for analytics emission from the student session feedback route.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/session/feedback/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add thumbs up/down analytics coverage for student session feedback
 */

import { jest } from '@jest/globals'

describe('POST /api/student/session/feedback', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('emits thumbs up analytics for positive ratings', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn() } }))

    const { POST } = await import('@/app/api/student/session/feedback/route')
    const res = await POST(new Request('http://localhost/api/student/session/feedback', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', rating: 5, phase: 'TEST' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.content.thumbsup', userId: 'student-1' }),
      'student.session.feedback',
    )
  })

  test('does not emit analytics for neutral ratings', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'student-1' } }),
    }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn() } }))

    const { POST } = await import('@/app/api/student/session/feedback/route')
    const res = await POST(new Request('http://localhost/api/student/session/feedback', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', rating: 3, phase: 'TEST' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).not.toHaveBeenCalled()
  })
})
