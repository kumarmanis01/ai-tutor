describe('Admin analytics - funnel', () => {
  it('computes funnel totals for last 30 days', async () => {
    const now = new Date()
    const mockPrisma: any = {
      analyticsDailyAggregate: {
        findMany: jest.fn().mockResolvedValue([
          { day: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), totalViews: 20, totalCompletions: 10 },
          { day: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), totalViews: 5, totalCompletions: 1 },
        ])
      }
    }

    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'admin2', role: 'admin' } }

    const route = await import('../../app/api/admin/analytics/funnel/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c2' } } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courseId).toBe('c2')
    expect(body.totalViews).toBe(25)
    expect(body.totalCompletions).toBe(11)
    expect(typeof body.completionRate).toBe('number')
  })

  it('forbids non-admins', async () => {
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', role: 'student' } }
    const route = await import('../../app/api/admin/analytics/funnel/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c2' } } as any)
    expect(res.status).toBe(403)
  })
})
