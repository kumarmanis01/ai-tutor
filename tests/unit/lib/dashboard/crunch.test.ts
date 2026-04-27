import computeCrunchMode from '@/lib/dashboard/crunch'

describe('computeCrunchMode', () => {
  test('no dates returns nulls and crunchMode false', () => {
    const res = computeCrunchMode(null, null)
    expect(res.daysToExam).toBeNull()
    expect(res.crunchMode).toBe(false)
    expect(res.examDate).toBeNull()
  })

  test('today returns daysToExam 0 and crunchMode true', () => {
    const today = new Date(Date.now())
    const res = computeCrunchMode(today, null)
    expect(res.daysToExam).toBeGreaterThanOrEqual(0)
    expect(res.crunchMode).toBe(true)
  })

  test('10 days ahead -> crunch mode true', () => {
    const in10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    const res = computeCrunchMode(in10, null)
    expect(res.daysToExam).toBeGreaterThanOrEqual(10 - 1)
    expect(res.daysToExam).toBeLessThanOrEqual(10 + 1)
    expect(res.crunchMode).toBe(true)
  })

  test('20 days ahead -> crunch mode false', () => {
    const in20 = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
    const res = computeCrunchMode(in20, null)
    expect(res.crunchMode).toBe(false)
  })

  test('invalid per-user date falls back to latestPlan', () => {
    const in5 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const res = computeCrunchMode('not-a-date', { examDate: in5 })
    expect(res.crunchMode).toBe(true)
  })
})
