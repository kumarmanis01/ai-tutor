describe('analyticsAggregator', () => {
  it('aggregates events and upserts daily aggregates', async () => {
    const events = [
      { eventType: 'lesson_viewed', courseId: 'c1', userId: 'u1', metadata: { timeSpent: 10 } },
      { eventType: 'lesson_viewed', courseId: 'c1', userId: 'u2', metadata: { timeSpent: 20 } },
      { eventType: 'lesson_completed', courseId: 'c1', userId: 'u1', metadata: { timeSpent: 15 } },
      { eventType: 'lesson_viewed', courseId: 'c2', userId: 'u3', metadata: {} },
    ]

    const mockPrisma: any = {
      analyticsEvent: { findMany: jest.fn().mockResolvedValue(events) },
      analyticsDailyAggregate: { upsert: jest.fn().mockResolvedValue(true) }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma

    // patch import of prisma used in worker to global mock
    const worker = await import('../../worker/services/analyticsAggregator')
    const keys = await worker.aggregateDay(new Date())
    expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalled()
    expect(mockPrisma.analyticsDailyAggregate.upsert).toHaveBeenCalled()
    expect(Array.isArray(keys)).toBe(true)
  })
})
