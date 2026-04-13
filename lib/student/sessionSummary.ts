/**
 * Build a compact, shareable plain-text summary for a completed session.
 * Used by the SessionCompletionScreen "Copy summary" CTA.
 */
export interface BadgeSimple {
  name: string
}

export interface ShareableSessionParams {
  topicName: string | null
  xpEarned: number
  sessionDurationMinutes: number
  correctAnswers: number
  totalQuestions: number
  masteryAfter: number
  aiInsight?: string | null
  badges?: BadgeSimple[]
  hintsUsed?: number | null
}

export function buildShareableSessionSummary(p: ShareableSessionParams): string {
  const lines: string[] = []
  const topic = p.topicName ?? 'This topic'
  lines.push(`Session: ${topic}`)
  lines.push(`Duration: ${p.sessionDurationMinutes > 0 ? `${p.sessionDurationMinutes} min` : 'Under 1 min'}`)
  lines.push(`Score: ${p.correctAnswers}/${p.totalQuestions}`)
  lines.push(`Mastery: ${Math.round(p.masteryAfter * 100)}%`)
  if (typeof p.hintsUsed === 'number') lines.push(`Hints used: ${p.hintsUsed}`)
  lines.push(`XP earned: +${p.xpEarned}`)

  if (p.badges && p.badges.length > 0) {
    const badgeList = p.badges.map((b) => b.name).join(', ')
    lines.push(`Badges: ${badgeList}`)
  }

  if (p.aiInsight && p.aiInsight.trim()) {
    lines.push('')
    lines.push(`Teacher Vidya: ${p.aiInsight.trim()}`)
  }

  // Limit overall length to something reasonable for clipboard/share use (e.g., 800 chars)
  const text = lines.join('\n')
  return text.length > 800 ? text.slice(0, 780) + '\n...': text
}

export default buildShareableSessionSummary
