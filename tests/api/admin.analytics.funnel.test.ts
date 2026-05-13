/**
 * FILE OBJECTIVE:
 * - Unit tests for the admin analytics funnel route.
 * - Validates DB-side COUNT-based funnel totals for views and completions.
 *
 * LINKED UNIT TEST:
 * - tests/api/admin.analytics.funnel.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | update mock from findMany to count to match DB-side COUNT refactor; add FILE OBJECTIVE header
 */

describe('Admin analytics - funnel', () => {
  it('computes funnel totals for last 30 days', async () => {
    const now = new Date()
    const mockPrisma: any = {
      analyticsEvent: {
        // first count call = totalViews (2), second = totalCompletions (1)
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
      }
    }

    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'admin2', role: 'admin' } }

    const route = await import('../../app/api/admin/analytics/funnel/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c2' } } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courseId).toBe('c2')
    expect(body.totalViews).toBe(2)
    expect(body.totalCompletions).toBe(1)
    expect(typeof body.completionRate).toBe('number')
  })

  it('forbids non-admins', async () => {
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', role: 'student' } }
    const route = await import('../../app/api/admin/analytics/funnel/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c2' } } as any)
    expect(res.status).toBe(403)
  })
})
