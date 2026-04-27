import { getYesterdayIstBounds, runDailyCostReport } from '@/worker/services/costReportingWorker'

// ── Prisma mock ────────────────────────────────────────────────────────────────
const mockFindMany = jest.fn()
const mockAggregate = jest.fn()
const mockUpsert = jest.fn()
const mockQueryRaw = jest.fn()
const mockMetricFindMany = jest.fn()
const mockMetricFindFirst = jest.fn()
const mockGroupBy = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aITutorTurnLog: {
      findMany: (...a: any[]) => mockFindMany(...a),
      aggregate: (...a: any[]) => mockAggregate(...a),
      groupBy: (...a: any[]) => mockGroupBy(...a),
    },
    dailyCostMetric: {
      upsert: (...a: any[]) => mockUpsert(...a),
      findMany: (...a: any[]) => mockMetricFindMany(...a),
      findFirst: (...a: any[]) => mockMetricFindFirst(...a),
    },
    concept: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: (...a: any[]) => mockQueryRaw(...a),
  },
}))

// ── Mailer mock ────────────────────────────────────────────────────────────────
const mockSendEmail = jest.fn()
jest.mock('@/lib/mailer', () => ({
  sendEmail: (...a: any[]) => mockSendEmail(...a),
  sendMailSafe: (...a: any[]) => mockSendEmail(...a),
}))

beforeEach(() => {
  mockFindMany.mockReset()
  mockAggregate.mockReset()
  mockUpsert.mockReset()
  mockSendEmail.mockReset()
  mockQueryRaw.mockReset()
  mockMetricFindMany.mockReset()
  mockMetricFindFirst.mockReset()
  mockGroupBy.mockReset()
  // Safe defaults for new parallel calls
  mockQueryRaw.mockResolvedValue([{ conceptId: null, studentCount: BigInt(0) }])
  mockMetricFindMany.mockResolvedValue([])
  mockMetricFindFirst.mockResolvedValue(null)
  mockGroupBy.mockResolvedValue([])
  delete process.env.ONCALL_EMAIL
})

// ── getYesterdayIstBounds ──────────────────────────────────────────────────────

describe('getYesterdayIstBounds', () => {
  test('returns start < end, both Date objects', () => {
    const { start, end } = getYesterdayIstBounds()
    expect(start).toBeInstanceOf(Date)
    expect(end).toBeInstanceOf(Date)
    expect(start.getTime()).toBeLessThan(end.getTime())
  })

  test('end - start is exactly 24 hours', () => {
    const { start, end } = getYesterdayIstBounds()
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  test('dateLabel is YYYY-MM-DD format', () => {
    const { dateLabel } = getYesterdayIstBounds()
    expect(dateLabel).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('start minute is :30 (IST midnight = UTC 18:30 or 23:30 depending on DST-free zone)', () => {
    // IST is UTC+5:30 so midnight IST always falls on :30 UTC
    const { start } = getYesterdayIstBounds()
    expect(start.getUTCMinutes()).toBe(30)
  })
})

// ── runDailyCostReport ─────────────────────────────────────────────────────────

describe('runDailyCostReport', () => {
  function setupMocks(sessions: { sessionId: string }[], costUsd: number | null) {
    mockFindMany.mockResolvedValueOnce(sessions)
    mockAggregate.mockResolvedValueOnce({ _sum: { costUsd } })
    mockUpsert.mockResolvedValueOnce({})
  }

  test('computes correct costPerSession', async () => {
    setupMocks(
      [{ sessionId: 's1' }, { sessionId: 's2' }],
      0.010,
    )
    const result = await runDailyCostReport()
    expect(result.sessions).toBe(2)
    expect(result.totalCostUsd).toBeCloseTo(0.010)
    expect(result.costPerSession).toBeCloseTo(0.005)
  })

  test('costPerSession is 0 when sessions = 0', async () => {
    setupMocks([], 0)
    const result = await runDailyCostReport()
    expect(result.sessions).toBe(0)
    expect(result.costPerSession).toBe(0)
  })

  test('handles null costUsd sum (no rows)', async () => {
    setupMocks([], null)
    const result = await runDailyCostReport()
    expect(result.totalCostUsd).toBe(0)
    expect(result.costPerSession).toBe(0)
  })

  test('upserts DailyCostMetric row', async () => {
    setupMocks([{ sessionId: 's1' }], 0.002)
    await runDailyCostReport()
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const call = mockUpsert.mock.calls[0][0]
    expect(call.create).toMatchObject({ sessions: 1, totalCostUsd: 0.002 })
    expect(call.update).toMatchObject({ sessions: 1, totalCostUsd: 0.002 })
  })

  test('no alert when costPerSession <= 0.003', async () => {
    process.env.ONCALL_EMAIL = 'oncall@example.com'
    setupMocks([{ sessionId: 's1' }, { sessionId: 's2' }], 0.004) // 0.002 per session
    const result = await runDailyCostReport()
    expect(result.alertSent).toBe(false)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  test('sends alert when costPerSession > 0.003 and ONCALL_EMAIL is set', async () => {
    process.env.ONCALL_EMAIL = 'oncall@example.com'
    mockSendEmail.mockResolvedValueOnce(undefined)
    setupMocks([{ sessionId: 's1' }], 0.010) // 0.010 per session > 0.003
    const result = await runDailyCostReport()
    expect(result.alertSent).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const emailArgs = mockSendEmail.mock.calls[0][0]
    expect(emailArgs.to).toBe('oncall@example.com')
    expect(emailArgs.subject).toMatch(/⚠️/)
    expect(emailArgs.subject).toMatch(/cost|spike|ceiling|outage/i)
  })

  test('alertSent=false when ONCALL_EMAIL is not set even if threshold exceeded', async () => {
    delete process.env.ONCALL_EMAIL
    setupMocks([{ sessionId: 's1' }], 0.010)
    const result = await runDailyCostReport()
    expect(result.alertSent).toBe(false)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  test('alertSent=false when sendEmail throws (never re-throws)', async () => {
    process.env.ONCALL_EMAIL = 'oncall@example.com'
    mockSendEmail.mockRejectedValueOnce(new Error('smtp down'))
    setupMocks([{ sessionId: 's1' }], 0.010)
    await expect(runDailyCostReport()).resolves.toMatchObject({ alertSent: false })
  })

  test('result contains date in YYYY-MM-DD format', async () => {
    setupMocks([], 0)
    const result = await runDailyCostReport()
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
