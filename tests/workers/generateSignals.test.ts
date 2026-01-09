import { generateSignalsForCourse } from '../../worker/services/generateSignals'

describe('generateSignals worker', () => {
  it('creates low completion signal when completionRate low', async () => {
    const mockDb: any = {
      analyticsDailyAggregate: { findFirst: jest.fn().mockResolvedValue({ completionRate: 0.1, day: new Date('2025-12-21') }) },
      analyticsEvent: { count: jest.fn().mockResolvedValue(0) },
      purchase: { count: jest.fn().mockResolvedValue(0) },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      analyticsSignal: { create: jest.fn().mockResolvedValue(true) }
    }

    ;(global as any).__TEST_PRISMA__ = mockDb

    await generateSignalsForCourse('c1')

    expect(mockDb.analyticsSignal.create).toHaveBeenCalled()
    const call = mockDb.analyticsSignal.create.mock.calls[0][0]
    expect(call.data.type).toBe('LOW_COMPLETION_RATE')
  })

  it('creates low quiz pass rate when passRate low', async () => {
    const mockDb: any = {
      analyticsDailyAggregate: { findFirst: jest.fn().mockResolvedValue(null) },
      analyticsEvent: { count: jest.fn().mockImplementation(({ where }: any) => { if (where.eventType === 'quiz_attempted') return Promise.resolve(20); if (where.eventType === 'quiz_passed') return Promise.resolve(4); return Promise.resolve(0) }) },
      purchase: { count: jest.fn().mockResolvedValue(0) },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      analyticsSignal: { create: jest.fn().mockResolvedValue(true) }
    }

    ;(global as any).__TEST_PRISMA__ = mockDb

    await generateSignalsForCourse('c2')

    expect(mockDb.analyticsSignal.create).toHaveBeenCalled()
    const call = mockDb.analyticsSignal.create.mock.calls[0][0]
    expect(call.data.type).toBe('LOW_QUIZ_PASS_RATE')
  })
})
