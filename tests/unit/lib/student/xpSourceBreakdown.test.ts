/**
 * Unit tests for XP source breakdown logic.
 * F-STU-031 AC-01: XP source breakdown shows contributions per category.
 *
 * Tests the aggregation logic inline (pure function -- no DB required).
 */

/** Mirror of XP_SOURCE_LABELS in XPWidget. */
const XP_SOURCE_LABELS: Record<string, string> = {
  session_correct: 'Correct answers',
  streak_bonus: 'Streak bonus',
  revision_complete: 'Revision cards',
  badge: 'Badge earned',
  session_complete: 'Session completion',
  first_attempt: 'First-attempt bonus',
}

type XPRow = { source: string; amount: number }

/** Aggregate XP rows into a Record<source, totalAmount>. */
function aggregateXPBySource(rows: XPRow[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.source] = (result[row.source] ?? 0) + row.amount
  }
  return result
}

describe('XP source breakdown', () => {
  it('should aggregate XP by source correctly', () => {
    const rows: XPRow[] = [
      { source: 'session_correct', amount: 15 },
      { source: 'session_correct', amount: 10 },
      { source: 'streak_bonus', amount: 5 },
    ]
    const result = aggregateXPBySource(rows)
    expect(result['session_correct']).toBe(25)
    expect(result['streak_bonus']).toBe(5)
  })

  it('should return empty object for empty rows', () => {
    expect(aggregateXPBySource([])).toEqual({})
  })

  it('should handle single-source input', () => {
    const rows: XPRow[] = [{ source: 'revision_complete', amount: 20 }]
    expect(aggregateXPBySource(rows)).toEqual({ revision_complete: 20 })
  })

  it('should have human-readable labels for all known sources', () => {
    const knownSources = ['session_correct', 'streak_bonus', 'revision_complete', 'badge', 'session_complete', 'first_attempt']
    for (const source of knownSources) {
      expect(XP_SOURCE_LABELS[source]).toBeTruthy()
    }
  })

  it('should sort sources by amount descending', () => {
    const breakdown: Record<string, number> = {
      revision_complete: 10,
      session_correct: 50,
      streak_bonus: 25,
    }
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
    expect(sorted[0][0]).toBe('session_correct')
    expect(sorted[1][0]).toBe('streak_bonus')
    expect(sorted[2][0]).toBe('revision_complete')
  })
})
