import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { isShieldAvailable, consumeShield } from '@/lib/student/streakShield'
import { getLocalDateString, startOfLocalDayUtc } from '@/lib/engagement/timezone'
import { sendPushSafe } from '@/lib/push/send'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'
import { emitServerAnalyticsEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

const MS_PER_DAY = 86400000

/** Midnight UTC for a given date (time component stripped). */
function toMidnightUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function getGapDays(lastSessionDate: Date | null, today: Date, timezone?: string | null): number | null {
  if (!lastSessionDate) return null

  try {
    const lastLocal = getLocalDateString(lastSessionDate, timezone)
    const todayLocal = getLocalDateString(today, timezone)
    const lastStartUtc = startOfLocalDayUtc(lastLocal, timezone).getTime()
    const todayStartUtc = startOfLocalDayUtc(todayLocal, timezone).getTime()
    return Math.max(0, Math.round((todayStartUtc - lastStartUtc) / MS_PER_DAY))
  } catch {
    const lastMidnight = toMidnightUTC(lastSessionDate)
    const todayMidnight = toMidnightUTC(today)
    return Math.max(0, Math.round((todayMidnight - lastMidnight) / MS_PER_DAY))
  }
}

/**
 * Pure helper -- exported for tests.
 * Given lastSessionDate (nullable) and today (Date),
 * returns: 'same_day' | 'consecutive' | 'broken'
 * Time component is stripped; same calendar day = 'same_day' regardless of hour.
 */
export function classifyStreakGap(
  lastSessionDate: Date | null,
  today: Date,
  timezone?: string | null,
): 'same_day' | 'consecutive' | 'broken' {
  if (!lastSessionDate) return 'broken'

  // Use student's local calendar date for streak calculations. Defaults to UTC.
  try {
    const lastLocal = getLocalDateString(lastSessionDate, timezone)
    const todayLocal = getLocalDateString(today, timezone)
    const lastStartUtc = startOfLocalDayUtc(lastLocal, timezone).getTime()
    const todayStartUtc = startOfLocalDayUtc(todayLocal, timezone).getTime()
    const diffDays = Math.round((todayStartUtc - lastStartUtc) / MS_PER_DAY)
    if (diffDays === 0) return 'same_day'
    if (diffDays === 1) return 'consecutive'
    return 'broken'
  } catch (_err) {
    // Fallback to UTC-based calculation on error; log the original error for diagnostics
    try { logger.debug('classifyStreakGap: local-date calculation failed, falling back to UTC', { error: String(_err) }) } catch {}
    const lastMidnight = toMidnightUTC(lastSessionDate)
    const todayMidnight = toMidnightUTC(today)
    const diffDays = (todayMidnight - lastMidnight) / MS_PER_DAY
    if (diffDays === 0) return 'same_day'
    if (diffDays === 1) return 'consecutive'
    return 'broken'
  }
}

/**
 * Call this once per qualifying activity: a completed full session (CONSOLIDATION reached)
 * or after the revision-card daily threshold is met.
 *
 * Logic:
 * 1. Load User.lastSessionDate, currentStreak, longestStreak.
 * 2. Get today's date (UTC, date-only -- strip time).
 * 3. If lastSessionDate is today → already counted, return current state (idempotent).
 * 4. If lastSessionDate is yesterday → increment streak.
 * 5. If lastSessionDate is older or null (broken) → check streak shield.
 *    a. Shield available → consume it, keep current streak, return shieldActivated=true.
 *    b. No shield → reset streak to 1.
 * 6. Update longestStreak if currentStreak > longestStreak.
 * 7. Set lastSessionDate = today.
 * 8. Persist via prisma.user.update -- not in a transaction (streak loss on crash is acceptable).
 * Never throws -- returns null on error.
 */
export async function updateStreak(studentId: string): Promise<{
  currentStreak: number
  longestStreak: number
  streakIncremented: boolean
  shieldActivated: boolean
} | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { lastSessionDate: true, currentStreak: true, longestStreak: true, timezone: true },
    })
    if (!user) return null

    const now = new Date()
    const gap = classifyStreakGap(user.lastSessionDate, now, (user as any).timezone)
    const gapDays = getGapDays(user.lastSessionDate, now, (user as any).timezone)

    let currentStreak: number
    let streakIncremented: boolean
    let shieldActivated = false

    if (gap === 'same_day') {
      // Already counted today -- idempotent return.
      return {
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        streakIncremented: false,
        shieldActivated: false,
      }
    } else if (gap === 'consecutive') {
      currentStreak = user.currentStreak + 1
      streakIncremented = true
    } else {
      // Gap ≥ 2 days -- streak would break. Check shield first.
      if (gapDays !== null && gapDays > 1) {
        void emitServerAnalyticsEvent(
          {
            eventType: ANALYTICS_EVENTS.STUDENT.STUDY_GAP_DAYS,
            userId: studentId,
            metadata: { gapDays },
          },
          'student.streak.update',
        )
      }
      const shieldAvail = await isShieldAvailable(studentId, now)
      if (shieldAvail && user.currentStreak > 0) {
        // Shield protects the streak -- keep current streak, mark shield consumed.
        await consumeShield(studentId, now)
        currentStreak = user.currentStreak + 1 // shield protected yesterday, today counts
        streakIncremented = true
        shieldActivated = true
        logger.info('streak.shield_activated', {
          event: 'streak_shield_activated',
          context: { studentId, previousStreak: user.currentStreak },
        })
        // F-STU-030 AC-03: notify student when shield auto-activates
        void sendPushSafe(studentId, PUSH_NOTIFICATIONS.streak_shield_used())
      } else {
        currentStreak = 1
        streakIncremented = true
      }
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

    void emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.STUDENT.STREAK_UPDATED,
        userId: studentId,
        metadata: {
          currentStreak,
          longestStreak,
          streakIncremented,
          shieldActivated,
        },
      },
      'student.streak.update',
    )

    // Clear any parent inactivity suppression keys so alerts reset if the student
    // studies after an inactivity alert was sent. This ensures "If student
    // studies after first alert, alert resets" behavior.
    try {
      const redis = getRedis()
      if (redis) {
        const links = await prisma.parentStudent.findMany({ where: { studentId, status: 'active' }, select: { parentId: true } })
        if (links && links.length > 0) {
          const keys: string[] = []
          for (const l of links) {
            // legacy suppression key
            keys.push(`parent:inactivity:${l.parentId}:${studentId}`)
            // new unified suppression key used by notification policy
            keys.push(`parent:notifications:suppression:inactivity:${l.parentId}:${studentId}`)
            // legacy/simple worker rate-limit key (per-parent) -- clear so activity resets alert window
            keys.push(`parent:alert:inactivity:last_sent:${l.parentId}`)
          }
          if (keys.length) await redis.del(...keys)
        }
      }
    } catch (err) {
      logger.error('streak.clearInactivitySuppression.error', { studentId, error: String(err) })
      try {
        const m = await import('@/lib/metrics')
        if (m && typeof (m as any).incSuppressionDeleteFailure === 'function') (m as any).incSuppressionDeleteFailure()
      } catch {}
    }

    return {
      currentStreak,
      longestStreak,
      streakIncremented,
      shieldActivated,
    }
  } catch {
    return null
  }
}

// Redis key: revision:daily:{studentId}:{YYYY-MM-DD}  value: count  TTL: 48h
const REVISION_DAILY_TTL_SECONDS = 48 * 60 * 60
const REVISION_STREAK_THRESHOLD = 10

function revisionDailyKey(studentId: string, dateStr: string): string {
  return `revision:daily:${studentId}:${dateStr}`
}

/**
 * Call after each revision card is answered/completed.
 *
 * Increments the student's daily revision counter in Redis.
 * When the counter first reaches REVISION_STREAK_THRESHOLD (10),
 * calls updateStreak() exactly once (idempotent via lastSessionDate check).
 *
 * Returns the new daily count, or null on Redis error.
 */
export async function trackRevisionAndMaybeUpdateStreak(
  studentId: string,
  now = new Date(),
): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null

  const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
  const key = revisionDailyKey(studentId, dateStr)

  try {
    const count = await redis.incr(key)
    // Set TTL only on first creation (count === 1)
    if (count === 1) {
      await redis.expire(key, REVISION_DAILY_TTL_SECONDS)
    }
    if (count === REVISION_STREAK_THRESHOLD) {
      // Fire-and-forget -- streak loss on crash is acceptable.
      void updateStreak(studentId)
      logger.info('streak.revision_threshold_reached', {
        event: 'streak_revision_threshold_reached',
        context: { studentId, count },
      })
    }
    return count
  } catch (err) {
    logger.error('streak.trackRevision.error', { studentId, error: String(err) })
    return null
  }
}
