import runAnalyticsJobs from '@/jobs/analyticsJobs'

jest.mock('@/jobs/jobLock', () => ({
  acquireJobLock: jest.fn(),
  releaseJobLock: jest.fn(),
}))

jest.mock('@/worker/services/analyticsAggregator', () => ({
  runForAllCourses: jest.fn(),
}))

jest.mock('@/worker/services/generateSignals', () => ({
  generateSignalsForAllCourses: jest.fn(),
}))

jest.mock('@/lib/audit/log', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: jest.fn() } },
}))

import { acquireJobLock, releaseJobLock } from '@/jobs/jobLock'
import * as agg from '@/worker/services/analyticsAggregator'
import * as signals from '@/worker/services/generateSignals'
import logAudit from '@/lib/audit/log'

describe('runAnalyticsJobs', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('successful run acquires lock, runs workers, writes audit and releases lock', async () => {
    ;(acquireJobLock as any).mockResolvedValue({ acquired: true })
    ;(agg as any).runForAllCourses.mockResolvedValue(undefined)
    ;(signals as any).generateSignalsForAllCourses.mockResolvedValue(undefined)

    const res = await runAnalyticsJobs()

    expect(acquireJobLock).toHaveBeenCalled()
    expect(agg.runForAllCourses).toHaveBeenCalled()
    expect(signals.generateSignalsForAllCourses).toHaveBeenCalled()
    expect(logAudit).toHaveBeenCalled()
    expect(releaseJobLock).toHaveBeenCalled()
    expect(res.success).toBe(true)
    expect(typeof res.durationMs).toBe('number')
  })

  test('skips when lock held', async () => {
    ;(acquireJobLock as any).mockResolvedValue({ skipped: true, reason: 'locked' })

    const res = await runAnalyticsJobs()

    expect(acquireJobLock).toHaveBeenCalled()
    expect(res.success).toBe(false)
    expect(res.skipped).toBe(true)
    expect(res.reason).toBe('locked')
    // workers should not run
    expect(agg.runForAllCourses).not.toHaveBeenCalled()
    expect(signals.generateSignalsForAllCourses).not.toHaveBeenCalled()
  })

  test('handles worker error and still releases lock', async () => {
    ;(acquireJobLock as any).mockResolvedValue({ acquired: true })
    ;(agg as any).runForAllCourses.mockRejectedValue(new Error('boom'))
    ;(signals as any).generateSignalsForAllCourses.mockResolvedValue(undefined)

    const res = await runAnalyticsJobs()

    expect(acquireJobLock).toHaveBeenCalled()
    expect(agg.runForAllCourses).toHaveBeenCalled()
    expect(signals.generateSignalsForAllCourses).toHaveBeenCalled()
    expect(releaseJobLock).toHaveBeenCalled()
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })
})
