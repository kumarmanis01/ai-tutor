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
      analyticsSignal: {
        findMany: jest.fn().mockImplementation(async () => {
          // Always return a single new signal to be processed
          return [
            { id: 'sig-1', type: 'LOW_COMPLETION', courseId: 'course-1', targetId: 'lesson-1', metadata: {}, createdAt: new Date().toISOString() }
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
