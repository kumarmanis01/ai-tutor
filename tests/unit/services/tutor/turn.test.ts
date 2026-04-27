/**
 * Unit tests for computeMasteryBrief in services/tutor/turn.ts
 */

import { computeMasteryBrief } from '@/services/tutor/turn'

describe('computeMasteryBrief', () => {
  it('returns fallback when score is null or undefined', () => {
    expect(computeMasteryBrief(null)).toBe('mastery_context_not_yet_wired')
    expect(computeMasteryBrief(undefined)).toBe('mastery_context_not_yet_wired')
  })

  it('maps very high scores to mastered', () => {
    expect(computeMasteryBrief(0.9)).toBe('mastered')
    expect(computeMasteryBrief(0.85)).toBe('mastered')
  })

  it('maps strong understanding range', () => {
    expect(computeMasteryBrief(0.7)).toBe('strong_understanding')
    expect(computeMasteryBrief(0.65)).toBe('strong_understanding')
  })

  it('maps partial understanding range', () => {
    expect(computeMasteryBrief(0.5)).toBe('partial_understanding')
    expect(computeMasteryBrief(0.4)).toBe('partial_understanding')
  })

  it('maps needs practice range', () => {
    expect(computeMasteryBrief(0.2)).toBe('needs_practice')
    expect(computeMasteryBrief(0.15)).toBe('needs_practice')
  })

  it('maps very low scores to novice', () => {
    expect(computeMasteryBrief(0.05)).toBe('novice')
  })
})
