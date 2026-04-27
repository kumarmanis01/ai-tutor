import { buildSessionSummary } from '@/lib/student/sessionSummary'

describe('buildSessionSummary', () => {
  test('includes topic, xp, score, mastery, duration and insight', () => {
    const s = buildSessionSummary({
      topicName: 'Quadratic Equations',
      xpEarned: 40,
      correctAnswers: 8,
      totalQuestions: 10,
      masteryDelta: 0.12,
      masteryAfter: 0.62,
      sessionDurationMinutes: 22,
      aiInsight: 'Focus on factoring methods',
      badgesEarned: [{ name: '7-Day Streak' }],
    })

    expect(s).toContain('Quadratic Equations')
    expect(s).toContain('XP: +40')
    expect(s).toContain('Score: 8/10 (80%)')
    expect(s).toContain('Mastery: +12% → 62%')
    expect(s).toContain('Duration: 22 min')
    expect(s).toContain('Badges: 7-Day Streak')
    expect(s).toContain('Insight: Focus on factoring methods')
  })

  test('graceful when optional fields missing', () => {
    const s = buildSessionSummary({ topicName: 'Geometry' })
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
    expect(s).toContain('Geometry')
  })

  test('fallback non-empty string when nothing provided', () => {
    const s = buildSessionSummary({})
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
  })
})
import { buildShareableSessionSummary } from '@/lib/student/sessionSummary'

describe('buildShareableSessionSummary', () => {
  test('includes core fields and insight', () => {
    const text = buildShareableSessionSummary({
      topicName: 'Quadratic Equations',
      xpEarned: 50,
      sessionDurationMinutes: 12,
      correctAnswers: 8,
      totalQuestions: 10,
      masteryAfter: 0.72,
      aiInsight: 'Strong work — focus one more practice on factorisation.',
      badges: [{ name: 'Consistency' }],
      hintsUsed: 1,
    })

    expect(text).toContain('Session: Quadratic Equations')
    expect(text).toContain('Duration: 12 min')
    expect(text).toContain('Score: 8/10')
    expect(text).toContain('Mastery: 72%')
    expect(text).toContain('XP earned: +50')
    expect(text).toContain('Badges: Consistency')
    expect(text).toContain('Teacher Vidya: Strong work')
  })

  test('handles null topic and missing optional fields', () => {
    const text = buildShareableSessionSummary({
      topicName: null,
      xpEarned: 0,
      sessionDurationMinutes: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      masteryAfter: 0,
    })
    expect(text).toContain('Session: This topic')
    expect(text).toContain('Duration: Under 1 min')
  })
})
