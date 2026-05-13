/**
 * FILE OBJECTIVE:
 * - Integration test validating that the analytics job creates content suggestions from signal events exactly once and writes an audit log.
 *
 * LINKED UNIT TEST:
 * - tests/integration/analytics_job_suggestions.integration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate mock DB from analyticsSignal to analyticsEvent; add FILE OBJECTIVE header
 */

import runAnalyticsJobs from '@/jobs/analyticsJobs'

jest.mock('@/src/jobs/jobLock', () => ({
  acquireJobLock: jest.fn(),
  releaseJobLock: jest.fn(),
}))

jest.mock('@/worker/services/analyticsAggregator', () => ({ runForAllCourses: jest.fn() }))
jest.mock('@/worker/services/generateSignals', () => ({ generateSignalsForAllCourses: jest.fn() }))

describe('Analytics job integration — suggestions + audit idempotency', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('creates suggestions once per signal and writes audit log', async () => {
    // In-memory mock DB implementation used by the job via global.__TEST_PRISMA__
    const createdSuggestions: any[] = []
    const mockDb: any = {
      analyticsEvent: {
        findMany: jest.fn().mockImplementation(async () => {
          // Always return a single new signal to be processed
          return [
            {
              id: 'sig-1',
              eventType: 'signal.low_completion_rate',
              courseId: 'course-1',
              metadata: { type: 'LOW_COMPLETION', targetId: 'lesson-1' },
              createdAt: new Date().toISOString(),
            }
          ]
        })
      },
      contentSuggestion: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          const key = where.sourceSignalId_type_targetId
          if (!key || !key.sourceSignalId) return null
          return createdSuggestions.find(s => s.sourceSignalId === key.sourceSignalId && s.type === key.type && s.targetId === key.targetId) ?? null
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: `cs-${createdSuggestions.length + 1}`, ...data }
          createdSuggestions.push(row)
          return row
        }),
        findMany: jest.fn().mockResolvedValue(createdSuggestions)
      },
      auditLog: { create: jest.fn().mockResolvedValue(true) }
    }

    ;(global as any).__TEST_PRISMA__ = mockDb

    // job lock behavior: allow run
    const jobLock = await import('@/src/jobs/jobLock')
    ;(jobLock.acquireJobLock as any).mockResolvedValue({ acquired: true })
    ;(jobLock.releaseJobLock as any).mockResolvedValue(true)

    // First run: should create suggestion and audit log
    const res1 = await runAnalyticsJobs()
    expect(res1.success).toBe(true)
    expect(createdSuggestions.length).toBe(1)
    expect(mockDb.auditLog.create).toHaveBeenCalled()

    // Second run: idempotency — same signal should not create another suggestion
    const res2 = await runAnalyticsJobs()
    expect(res2.success).toBe(true)
    expect(createdSuggestions.length).toBe(1)
    // audit should have been called at least once for creation; subsequent attempts may not create entries
    expect(mockDb.auditLog.create).toHaveBeenCalled()
  })
})
