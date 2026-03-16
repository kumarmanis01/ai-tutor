import { prisma } from '@/lib/prisma'
import { sendPushSafe } from '@/lib/push/send'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'

const MS_PER_DAY = 86400000

/** Midnight UTC for a given date (time component stripped). */
function toMidnightUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Pure helper — exported for tests.
 * Given lastSessionDate (nullable) and today (Date),
 * returns: 'same_day' | 'consecutive' | 'broken'
 * Time component is stripped; same calendar day = 'same_day' regardless of hour.
 */
export function classifyStreakGap(
  lastSessionDate: Date | null,
  today: Date,
): 'same_day' | 'consecutive' | 'broken' {
  if (!lastSessionDate) return 'broken'
  const lastMidnight = toMidnightUTC(lastSessionDate)
  const todayMidnight = toMidnightUTC(today)
  const diffDays = (todayMidnight - lastMidnight) / MS_PER_DAY
  if (diffDays === 0) return 'same_day'
  if (diffDays === 1) return 'consecutive'
  return 'broken'
}

/**
 * Call this once per completed session, after XP is awarded.
 * Logic:
 * 1. Load User.lastSessionDate, currentStreak, longestStreak.
 * 2. Get today's date (UTC, date-only — strip time).
 * 3. If lastSessionDate is today → already counted, return current state (idempotent).
 * 4. If lastSessionDate is yesterday → increment streak.
 * 5. If lastSessionDate is older or null → reset streak to 1.
 * 6. Update longestStreak if currentStreak > longestStreak.
 * 7. Set lastSessionDate = today.
 * 8. Persist via prisma.user.update — not in a transaction (streak loss is acceptable on crash).
 * Never throws — returns null on error.
 */
export async function updateStreak(studentId: string): Promise<{
  currentStreak: number
  longestStreak: number
  streakIncremented: boolean
} | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { lastSessionDate: true, currentStreak: true, longestStreak: true },
    })
    if (!user) return null

    const now = new Date()
    const gap = classifyStreakGap(user.lastSessionDate, now)

    let currentStreak: number
    let streakIncremented: boolean

    if (gap === 'same_day') {
      currentStreak = user.currentStreak
      streakIncremented = false
    } else if (gap === 'consecutive') {
      currentStreak = user.currentStreak + 1
      streakIncremented = true
    } else {
      currentStreak = 1
      streakIncremented = true
    }

    const longestStreak = Math.max(user.longestStreak, currentStreak)
    const todayStart = new Date(toMidnightUTC(now))

    await prisma.user.update({
      where: { id: studentId },
      data: {
        lastSessionDate: todayStart,
        currentStreak,
        longestStreak,
      },
    })

    // Fire milestone push notifications (best-effort, non-blocking)
    if (streakIncremented) {
      if (currentStreak === 7) {
        void sendPushSafe(studentId, PUSH_NOTIFICATIONS.streak_milestone_7())
      } else if (currentStreak === 30) {
        void sendPushSafe(studentId, PUSH_NOTIFICATIONS.streak_milestone_30())
      }
    }

    return {
      currentStreak,
      longestStreak,
      streakIncremented,
    }
  } catch {
    return null
  }
}
