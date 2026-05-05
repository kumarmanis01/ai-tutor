/**
 * FILE OBJECTIVE:
 * - Unit tests for GET/PATCH /api/session/[sessionId] route handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/[sessionId]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | add heartbeat PATCH auth and persistence tests
 */

describe('PATCH /api/session/[sessionId]', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => null) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        structuredSession: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))

    const { PATCH } = await import('@/app/api/session/[sessionId]/route')

    const res = await PATCH(
      new Request('http://localhost/api/session/sess-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'heartbeat' }),
      }) as any,
      { params: Promise.resolve({ sessionId: 'sess-1' }) },
    )

    expect(res.status).toBe(401)
  })

  it('updates meta.lastHeartbeatAt for active sessions', async () => {
    const updateMock = jest.fn(async () => ({}))

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        homeworkAssignment: { findUnique: jest.fn() },
        structuredSession: {
          findFirst: jest.fn(async () => ({ id: 'sess-1', state: 'IN_PROGRESS', meta: { foo: 'bar' } })),
          update: updateMock,
        },
      },
    }))
    jest.doMock('@/lib/session/sessionEngine', () => ({
      getSessionView: jest.fn(),
      getPhaseContent: jest.fn(),
      isSessionEngineEnabled: jest.fn(() => true),
      SessionError: class extends Error {
        status: number
        constructor(message: string, status = 500) {
          super(message)
          this.status = status
        }
      },
    }))
    jest.doMock('@/lib/session/getPhaseContent', () => ({ resolvePhaseContent: jest.fn() }))
    jest.doMock('@/lib/session/phaseCompletionValidator', () => ({ markExplanationViewed: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))

    const { PATCH } = await import('@/app/api/session/[sessionId]/route')

    const res = await PATCH(
      new Request('http://localhost/api/session/sess-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'heartbeat' }),
      }) as any,
      { params: Promise.resolve({ sessionId: 'sess-1' }) },
    )

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: {
          meta: expect.objectContaining({
            foo: 'bar',
            lastHeartbeatAt: expect.any(String),
          }),
        },
      }),
    )
  })
})
