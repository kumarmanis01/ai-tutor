/**
 * FILE OBJECTIVE:
 * - Unit tests for the generateSignals worker service.
 * - Validates signal event creation for low completion rate and low quiz pass rate conditions.
 *
 * LINKED UNIT TEST:
 * - tests/workers/generateSignals.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate mock from analyticsSignal to analyticsEvent.create; add FILE OBJECTIVE header
 */

import { generateSignalsForCourse } from '../../worker/services/generateSignals'

describe('generateSignals worker', () => {
  it('creates low completion signal when completionRate low', async () => {
    const mockDb: any = {
      analyticsDailyAggregate: { findFirst: jest.fn().mockResolvedValue({ completionRate: 0.1, day: new Date('2025-12-21') }) },
      analyticsEvent: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(true) },
      purchase: { count: jest.fn().mockResolvedValue(0) },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
    }

    ;(global as any).__TEST_PRISMA__ = mockDb

    await generateSignalsForCourse('c1')

    expect(mockDb.analyticsEvent.create).toHaveBeenCalled()
    const call = mockDb.analyticsEvent.create.mock.calls[0][0]
    expect(call.data.metadata.type).toBe('LOW_COMPLETION_RATE')
  })

  it('creates low quiz pass rate when passRate low', async () => {
    const mockDb: any = {
      analyticsDailyAggregate: { findFirst: jest.fn().mockResolvedValue(null) },
      analyticsEvent: {
        count: jest.fn().mockImplementation(({ where }: any) => { if (where.eventType === 'quiz_attempted') return Promise.resolve(20); if (where.eventType === 'quiz_passed') return Promise.resolve(4); return Promise.resolve(0) }),
        create: jest.fn().mockResolvedValue(true),
      },
      purchase: { count: jest.fn().mockResolvedValue(0) },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
    }

    ;(global as any).__TEST_PRISMA__ = mockDb

    await generateSignalsForCourse('c2')

    expect(mockDb.analyticsEvent.create).toHaveBeenCalled()
    const call = mockDb.analyticsEvent.create.mock.calls[0][0]
    expect(call.data.metadata.type).toBe('LOW_QUIZ_PASS_RATE')
  })
})
