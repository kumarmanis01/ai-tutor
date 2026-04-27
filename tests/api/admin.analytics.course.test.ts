describe('Admin analytics - course', () => {
  it('returns aggregated metrics for admin', async () => {
    const mockPrisma: any = {
      analyticsDailyAggregate: {
        findMany: jest.fn().mockResolvedValue([
          { day: new Date('2025-12-20'), totalViews: 10, totalCompletions: 5, avgTimePerLesson: 120, completionRate: 0.5 },
          { day: new Date('2025-12-19'), totalViews: 8, totalCompletions: 4, avgTimePerLesson: 100, completionRate: 0.5 },
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
    expect(body.aggregates[0].totalViews).toBe(10)
  })

  it('forbids non-admins', async () => {
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', role: 'student' } }
    const route = await import('../../app/api/admin/analytics/course/[courseId]/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res.status).toBe(403)
  })
})
