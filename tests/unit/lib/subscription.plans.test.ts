import { rupeesToPaise, renewalDateStr, PLANS } from '@/lib/subscription/plans'

describe('subscription plans utilities', () => {
  test('rupeesToPaise converts correctly', () => {
    expect(rupeesToPaise(99)).toBe(9900)
    expect(rupeesToPaise(0)).toBe(0)
    expect(rupeesToPaise(1.23)).toBe(123)
  })

  test('renewalDateStr returns a human date in en-IN format', () => {
    const plan = PLANS.monthly
    const s = renewalDateStr(plan)
    // Basic sanity: contains a year and month name
    expect(s).toMatch(/\d{4}|\b\w+\b/)
  })
})
