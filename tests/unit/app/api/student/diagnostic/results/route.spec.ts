/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/diagnostic/results/[subjectId] route behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/diagnostic/results/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | add tests for auth guard and recommended-start fallback
 */

describe('GET /api/student/diagnostic/results/[subjectId]', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => null) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        chapterDef: { findMany: jest.fn() },
        studentConceptState: { findMany: jest.fn() },
        $queryRaw: jest.fn(),
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))

    const { GET } = await import('@/app/api/student/diagnostic/results/[subjectId]/route')

    const res = await GET(new Request('http://localhost/api/student/diagnostic/results/math') as any, {
      params: Promise.resolve({ subjectId: 'math' }),
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual(expect.objectContaining({ error: 'Unauthorized' }))
  })

  it('always returns recommendedStartChapterId when chapters exist (all green fallback)', async () => {
    const chapterRows = [
      { id: 'ch-1', name: 'Algebra', order: 1 },
      { id: 'ch-2', name: 'Geometry', order: 2 },
    ]

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        chapterDef: {
          findMany: jest.fn(async () => chapterRows),
        },
        studentConceptState: {
          findMany: jest.fn(async () => [
            { masteryScore: 0.95, concept: { topic: { chapterId: 'ch-1' } } },
            { masteryScore: 0.9, concept: { topic: { chapterId: 'ch-2' } } },
          ]),
        },
        $queryRaw: jest.fn(async () => [
          { chapterId: 'ch-1', cnt: 4n },
          { chapterId: 'ch-2', cnt: 3n },
        ]),
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }))

    const { GET } = await import('@/app/api/student/diagnostic/results/[subjectId]/route')

    const res = await GET(new Request('http://localhost/api/student/diagnostic/results/math') as any, {
      params: Promise.resolve({ subjectId: 'math' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendedStartChapterId).toBeTruthy()
    expect(['ch-1', 'ch-2']).toContain(body.recommendedStartChapterId)
    expect(body.chapters.filter((c: { isRecommendedStart: boolean }) => c.isRecommendedStart)).toHaveLength(1)
  })
})
