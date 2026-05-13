/**
 * FILE OBJECTIVE:
 * - Unit tests for the admin analytics course route.
 * - Validates daily aggregate computation from raw analyticsEvent rows.
 *
 * LINKED UNIT TEST:
 * - tests/api/admin.analytics.course.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate mock from analyticsDailyAggregate to analyticsEvent rows; add FILE OBJECTIVE header
 */

describe('Admin analytics - course', () => {
  it('returns aggregated metrics for admin', async () => {
    const mockPrisma: any = {
      analyticsEvent: {
        findMany: jest.fn().mockResolvedValue([
          { createdAt: new Date('2025-12-20T08:00:00Z'), eventType: 'lesson_viewed', metadata: { timeSpent: 100 } },
          { createdAt: new Date('2025-12-20T09:00:00Z'), eventType: 'lesson_completed', metadata: {} },
          { createdAt: new Date('2025-12-19T09:00:00Z'), eventType: 'lesson_viewed', metadata: { timeSpent: 120 } },
        ])
      }
    }

    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'admin1', role: 'admin' } }

    const route = await import('../../app/api/admin/analytics/course/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courseId).toBe('c1')
    expect(Array.isArray(body.aggregates)).toBe(true)
    expect(body.aggregates[0].totalViews).toBe(1)
    expect(body.aggregates[0].totalCompletions).toBe(1)
  })

  it('forbids non-admins', async () => {
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', role: 'student' } }
    const route = await import('../../app/api/admin/analytics/course/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res.status).toBe(403)
  })
})
