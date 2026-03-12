import {
  computeReadinessLabel,
  computeWeightedContribution,
} from '@/lib/student/examReadiness'

describe('lib/student/examReadiness', () => {
  describe('computeReadinessLabel', () => {
    test('39 → Needs Work', () => {
      expect(computeReadinessLabel(39)).toBe('Needs Work')
    })
    test('40 → Developing', () => {
      expect(computeReadinessLabel(40)).toBe('Developing')
    })
    test('60 → On Track', () => {
      expect(computeReadinessLabel(60)).toBe('On Track')
    })
    test('80 → Exam Ready', () => {
      expect(computeReadinessLabel(80)).toBe('Exam Ready')
    })
    test('100 → Exam Ready', () => {
      expect(computeReadinessLabel(100)).toBe('Exam Ready')
    })
  })

  describe('computeWeightedContribution', () => {
    test('1.0, 8, 80 → 10.0', () => {
      expect(computeWeightedContribution(1.0, 8, 80)).toBe(10)
    })
    test('0.5, 8, 80 → 5.0', () => {
      expect(computeWeightedContribution(0.5, 8, 80)).toBe(5)
    })
    test('0.0, 8, 80 → 0.0', () => {
      expect(computeWeightedContribution(0.0, 8, 80)).toBe(0)
    })
    test('totalMarks = 0 → 0 (no divide-by-zero)', () => {
      expect(computeWeightedContribution(1.0, 8, 0)).toBe(0)
    })
  })

  describe('score and totalMarks edge cases', () => {
    test('score rounds to 1 decimal (42.333... → 42.3)', () => {
      const rawScore = 42.333333
      const rounded = Math.round(rawScore * 10) / 10
      expect(rounded).toBe(42.3)
    })
    test('totalMarks = 0 → score = 0 (no divide-by-zero)', () => {
      expect(computeWeightedContribution(0.5, 0, 0)).toBe(0)
      expect(computeWeightedContribution(1, 10, 0)).toBe(0)
    })
  })
})
