import type { PushPayload } from './send'

/**
 * All push notification copy lives here.
 *
 * Copy rules:
 * - Never use "broke", "missed", "failed", "lost" — forward-looking only
 * - Max 50 chars for title, max 100 chars for body
 * - Always include a specific action in the body
 * - Emojis are allowed and encouraged (one per notification)
 */
export const PUSH_NOTIFICATIONS = {
  // ── Streak / inactivity ─────────────────────────────────────────────────
  inactivity_day2: (streak: number): PushPayload => ({
    title: streak > 0 ? `🔥 Keep your ${streak}-day streak!` : '📚 Start your streak today!',
    body: 'Vidya has your next session ready. 5 minutes is enough to keep learning going.',
    url: '/dashboard',
    tag: 'inactivity',
  }),

  inactivity_day3: (topicName: string): PushPayload => ({
    title: '⏰ Your learning plan is waiting',
    body: `${topicName} is up next. Pick up where you left off.`,
    url: '/dashboard',
    tag: 'inactivity',
  }),

  streak_shield_used: (): PushPayload => ({
    title: '🛡️ Streak shield activated',
    body: 'Your streak is safe for today. Start a session to keep it going!',
    url: '/dashboard',
    tag: 'streak',
  }),

  // ── Exam reminders ──────────────────────────────────────────────────────
  exam_14_days: (subject: string, readiness: number): PushPayload => ({
    title: `📅 14 days to your ${subject} exam`,
    body: `You're ${readiness}% ready. Today's session is critical — let's close the gap.`,
    url: '/dashboard',
    tag: 'exam-countdown',
    requireInteraction: true,
  }),

  exam_7_days: (subject: string, topicName: string): PushPayload => ({
    title: `⚡ 7 days left — ${subject}`,
    body: `Focus on ${topicName} today — it's your highest-impact topic.`,
    url: '/dashboard',
    tag: 'exam-countdown',
    requireInteraction: true,
  }),

  exam_3_days: (subject: string): PushPayload => ({
    title: `🎯 3 days to ${subject} exam`,
    body: 'Time for final revision. Your plan is ready.',
    url: '/student/revisions',
    tag: 'exam-countdown',
    requireInteraction: true,
  }),

  exam_day: (subject: string): PushPayload => ({
    title: `🌟 ${subject} exam day — you've got this`,
    body: 'A quick 10-minute revision this morning can make a difference.',
    url: '/student/revisions',
    tag: 'exam-day',
    requireInteraction: true,
  }),

  // ── Revision due ────────────────────────────────────────────────────────
  revision_due: (count: number): PushPayload => ({
    title: `🧠 ${count} revision card${count > 1 ? 's' : ''} due today`,
    body: '20 minutes of revision today prevents hours of re-learning tomorrow.',
    url: '/student/revisions',
    tag: 'revision',
  }),

  // ── Milestones (positive reinforcement) ─────────────────────────────────
  streak_milestone_7: (): PushPayload => ({
    title: '🔥 7-day streak — incredible!',
    body: "You've studied every day this week. That's the habit that wins exams.",
    url: '/dashboard',
    tag: 'milestone',
  }),

  streak_milestone_30: (): PushPayload => ({
    title: "🏆 30-day streak — you're unstoppable",
    body: 'A full month of daily learning. Your consistency is building real mastery.',
    url: '/dashboard',
    tag: 'milestone',
  }),

  chapter_mastered: (chapterName: string): PushPayload => ({
    title: `✅ ${chapterName} mastered!`,
    body: 'One more chapter down. Keep building on this momentum.',
    url: '/student/progress',
    tag: 'milestone',
  }),

  level_up: (level: number): PushPayload => ({
    title: `⬆️ You reached Level ${level}!`,
    body: 'Your effort is paying off. Open Spinzy to see your reward.',
    url: '/dashboard',
    tag: 'level-up',
  }),

  readiness_milestone: (score: number, subject: string): PushPayload => ({
    title: `🎯 ${subject} readiness: ${score}%`,
    body:
      score >= 70
        ? "You're on track for a strong board exam result!"
        : 'Good progress — keep the momentum going.',
    url: '/student/progress',
    tag: 'readiness',
  }),

  // ── Free tier ────────────────────────────────────────────────────────────
  free_tier_reset_soon: (daysLeft: number, subject: string): PushPayload => ({
    title: `🔄 Free sessions reset in ${daysLeft} days`,
    body: `${subject} sessions will refresh on the 1st. Use them before they reset.`,
    url: '/dashboard',
    tag: 'free-tier',
  }),
}
