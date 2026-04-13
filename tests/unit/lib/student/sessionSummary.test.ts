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
