describe('Admin analytics signals API', () => {
  it('returns signals for admin', async () => {
    const mockPrisma: any = {
      analyticsSignal: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', courseId: 'c1', type: 'LOW_COMPLETION_RATE', severity: 'CRITICAL', metadata: { completionRate: 0.1 }, createdAt: new Date('2025-12-21'), resolvedAt: null }
        ])
      }
    }

    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'admin1', role: 'admin' } }

    const route = await import('../../app/api/admin/analytics/signals/route')
    const res = await route.GET(new Request('http://localhost/?courseId=c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.signals)).toBe(true)
    expect(body.signals[0].type).toBe('LOW_COMPLETION_RATE')
  })

  it('forbids non-admins', async () => {
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', role: 'student' } }
    const route = await import('../../app/api/admin/analytics/signals/route')
    const res = await route.GET(new Request('http://localhost/'))
    expect(res.status).toBe(403)
  })
})
