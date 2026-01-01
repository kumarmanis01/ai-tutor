describe('Analytics event ingestion', () => {
  it('accepts a batch of valid events and returns 202', async () => {
    const mockPrisma: any = {
      analyticsEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma

    const route = await import('../../app/api/analytics/event/route')
    const payload = [
      { eventType: 'lesson_viewed', userId: 'u1', courseId: 'c1', lessonIdx: 1, metadata: { t: 10 } },
      { eventType: 'lesson_completed', userId: 'u1', courseId: 'c1', lessonIdx: 1, metadata: { t: 20 } },
    ]
    const res = await route.POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) }) as any)
    expect(res.status).toBe(202)
    expect(mockPrisma.analyticsEvent.createMany).toHaveBeenCalled()
  })

  it('rejects invalid eventType with 400', async () => {
    const route = await import('../../app/api/analytics/event/route')
    const payload = [{ eventType: 'unknown_event', userId: 'u1' }]
    const res = await route.POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) }) as any)
    expect(res.status).toBe(400)
  })
})
