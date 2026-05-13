/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/admin/questions review queue behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/questions/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add coverage for default review queue and status filter behavior
 */

describe('GET /api/admin/questions', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns the default pending review and quarantined queue for admins', async () => {
    const questionFindMany = jest.fn().mockResolvedValue([
      {
        id: 'question-1',
        status: 'PENDING_REVIEW',
        sessionFlags: [{ id: 'flag-1', reason: 'WRONG_ANSWER', details: 'Student reason: Incorrect', createdAt: new Date('2026-05-13T00:00:00.000Z') }],
        topic: { name: 'Algebra' },
      },
    ])

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findMany: questionFindMany,
        },
      },
    }))
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        PENDING_REVIEW: 'PENDING_REVIEW',
        QUARANTINED: 'QUARANTINED',
        REJECTED: 'REJECTED',
      },
    }))

    const { GET } = await import('@/app/api/admin/questions/route')
    const response = await GET({ nextUrl: new URL('http://localhost/api/admin/questions') } as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.questions).toHaveLength(1)
    expect(questionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['PENDING_REVIEW', 'QUARANTINED'] } },
        include: expect.objectContaining({
          sessionFlags: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              reason: true,
              details: true,
              createdAt: true,
            }),
          }),
        }),
      }),
    )
  })

  it('returns 403 for non-admin users', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1', role: 'student' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findMany: jest.fn(),
        },
      },
    }))
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        PENDING_REVIEW: 'PENDING_REVIEW',
        QUARANTINED: 'QUARANTINED',
        REJECTED: 'REJECTED',
      },
    }))

    const { GET } = await import('@/app/api/admin/questions/route')
    const response = await GET({ nextUrl: new URL('http://localhost/api/admin/questions') } as any)

    expect(response.status).toBe(403)
  })
})