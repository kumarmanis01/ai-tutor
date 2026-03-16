import { getYearMonth } from '@/lib/student/streakShield'

describe('lib/student/streakShield', () => {
  describe('getYearMonth', () => {
    test('returns YYYY-MM for a date in January', () => {
      expect(getYearMonth(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01')
    })

    test('returns YYYY-MM for a date in December', () => {
      expect(getYearMonth(new Date('2025-12-31T23:59:59Z'))).toBe('2025-12')
    })

    test('pads single-digit months with a leading zero', () => {
      expect(getYearMonth(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03')
    })

    test('is pure — same input gives same output', () => {
      const d = new Date('2026-06-15T08:00:00Z')
      expect(getYearMonth(d)).toBe('2026-06')
      expect(getYearMonth(d)).toBe('2026-06')
    })
  })
})
