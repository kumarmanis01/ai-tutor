/**
 * FILE OBJECTIVE:
 * - Produce a concise, shareable text summary for a completed tutoring session.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/sessionSummary.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created session summary helper
 */

export interface SessionSummaryParams {
  topicName?: string | null
  xpEarned?: number
  correctAnswers?: number
  totalQuestions?: number
  masteryDelta?: number
  masteryAfter?: number
  sessionDurationMinutes?: number
  aiInsight?: string | null
  badgesEarned?: { name: string }[]
}

/**
 * Build a compact, human-readable session summary suitable for copy/share.
 * Returns a single-line summary (pieces separated by ' · '). Never empty.
 */
export function buildSessionSummary(params: SessionSummaryParams): string {
  const {
    topicName,
    xpEarned,
    correctAnswers,
    totalQuestions,
    masteryDelta,
    masteryAfter,
    sessionDurationMinutes,
    aiInsight,
    badgesEarned,
  } = params

  const parts: string[] = []

  if (topicName) parts.push(`Topic: ${topicName}`)
  if (typeof xpEarned === 'number') parts.push(`XP: +${xpEarned}`)

  if (
    typeof correctAnswers === 'number' &&
    typeof totalQuestions === 'number' &&
    totalQuestions > 0
  ) {
    const pct = Math.round((correctAnswers / totalQuestions) * 100)
    parts.push(`Score: ${correctAnswers}/${totalQuestions} (${pct}%)`)
  }

  if (typeof masteryDelta === 'number' || typeof masteryAfter === 'number') {
    const md = typeof masteryDelta === 'number' ? Math.round(masteryDelta * 100) : null
    const after = typeof masteryAfter === 'number' ? Math.round(masteryAfter * 100) : null
    if (md !== null && after !== null) {
      parts.push(`Mastery: ${md >= 0 ? '+' : ''}${md}% → ${after}%`)
    } else if (after !== null) {
      parts.push(`Mastery: ${after}%`)
    }
  }

  if (typeof sessionDurationMinutes === 'number') {
    parts.push(`Duration: ${sessionDurationMinutes} min`)
  }

  if (Array.isArray(badgesEarned) && badgesEarned.length > 0) {
    parts.push(`Badges: ${badgesEarned.map((b) => b.name).join(', ')}`)
  }

  if (aiInsight && aiInsight.trim()) {
    // Keep the insight short and inline
    const inline = aiInsight.trim().replace(/\s+/g, ' ')
    parts.push(`Insight: ${inline}`)
  }

  const summary = parts.join(' · ')
  return summary || 'Session complete — great progress!'
}

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

