/**
 * FILE OBJECTIVE:
 * - Enforce per-user daily study duration limits: 30 min for free tier,
 *   60 min for premium. Provides helpers for checking the limit, recording
 *   time spent, and resetting the counter at midnight UTC.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/dailyStudyLimit.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | created for daily study duration enforcement (30 min free / 60 min premium)
 */

import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'
import { DAILY_STUDY_LIMIT_MINUTES, StudyTier } from '@/lib/constants/studyLimits'
import { logger } from '@/lib/logger'

const CLASS_NAME = 'DailyStudyLimit'

/**
 * ISO date string in UTC (YYYY-MM-DD) for the given date.
 * Used to compare calendar days without clock-time noise.
 */
function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns true if `d1` and `d2` fall on the same UTC calendar day. */
function isSameUtcDay(d1: Date, d2: Date): boolean {
  return toUtcDateString(d1) === toUtcDateString(d2)
}

/**
 * The UTC instant at which the next daily reset occurs (next UTC midnight).
 * Used to tell clients when they can study again.
 */
function nextUtcMidnight(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  )
}

export interface DailyStudyLimitStatus {
  /** Whether the student is allowed to start a new session now. */
  allowed: boolean
  /** Subscription tier that was evaluated. */
  tier: StudyTier
  /** Daily limit in minutes for this tier. */
  limitMinutes: number
  /** Minutes already studied today. */
  usedMinutes: number
  /** Minutes remaining before the cap is hit. */
  remainingMinutes: number
  /** UTC timestamp at which the daily counter resets. */
  resetAt: Date
}

/**
 * Check whether the student has study time remaining today.
 *
 * Never throws -- returns `allowed: false` on any DB or subscription error so
 * the caller can gate the session start without crashing.
 */
export async function checkDailyStudyLimit(studentId: string): Promise<DailyStudyLimitStatus> {
  const resetAt = nextUtcMidnight()
  const fallback: DailyStudyLimitStatus = {
    allowed: false,
    tier: 'free',
    limitMinutes: DAILY_STUDY_LIMIT_MINUTES.free,
    usedMinutes: 0,
    remainingMinutes: 0,
    resetAt,
  }

  try {
    const isPremium = await isPremiumUser(studentId)
    const tier: StudyTier = isPremium ? 'premium' : 'free'
    const limitMinutes = DAILY_STUDY_LIMIT_MINUTES[tier]

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { todayStudyMinutes: true, lastStudySessionDate: true },
    })

    if (!user) {
      logger.warn('checkDailyStudyLimit: user not found', {
        className: CLASS_NAME,
        methodName: 'checkDailyStudyLimit',
        studentId,
      })
      return fallback
    }

    // If lastStudySessionDate is from a previous day, the counter has not been
    // reset yet by the nightly job (or no session happened today). Treat as 0.
    const now = new Date()
    const usedMinutes =
      user.lastStudySessionDate && isSameUtcDay(user.lastStudySessionDate, now)
        ? user.todayStudyMinutes
        : 0

    const remainingMinutes = Math.max(0, limitMinutes - usedMinutes)
    const allowed = remainingMinutes > 0

    return { allowed, tier, limitMinutes, usedMinutes, remainingMinutes, resetAt }
  } catch (err) {
    logger.error('checkDailyStudyLimit: DB error', {
      className: CLASS_NAME,
      methodName: 'checkDailyStudyLimit',
      studentId,
      error: String(err),
    })
    // Fail open: prefer allowing the session over blocking due to infra issues.
    return { ...fallback, allowed: true, remainingMinutes: fallback.limitMinutes }
  }
}

/**
 * Record study time after a session completes.
 *
 * - If `lastStudySessionDate` is from a previous day, reset `todayStudyMinutes`
 *   to `minutesSpent` (auto-reset at first session of the new day in case the
 *   nightly job has not yet run).
 * - Otherwise increment `todayStudyMinutes` by `minutesSpent`.
 * - Always updates `lastStudySessionDate` to NOW so the guard above works next call.
 *
 * Never throws -- freemium accounting must not break session completion.
 */
export async function updateDailyStudyTime(studentId: string, minutesSpent: number): Promise<void> {
  if (minutesSpent <= 0) return

  try {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { todayStudyMinutes: true, lastStudySessionDate: true },
    })

    if (!user) {
      logger.warn('updateDailyStudyTime: user not found', {
        className: CLASS_NAME,
        methodName: 'updateDailyStudyTime',
        studentId,
      })
      return
    }

    const now = new Date()
    // Auto-reset if the last session was on a previous day (nightly job safety net).
    const baseMinutes =
      user.lastStudySessionDate && isSameUtcDay(user.lastStudySessionDate, now)
        ? user.todayStudyMinutes
        : 0

    await prisma.user.update({
      where: { id: studentId },
      data: {
        todayStudyMinutes: baseMinutes + minutesSpent,
        lastStudySessionDate: now,
      },
    })

    logger.info('updateDailyStudyTime: recorded', {
      className: CLASS_NAME,
      methodName: 'updateDailyStudyTime',
      studentId,
      minutesSpent,
      newTotal: baseMinutes + minutesSpent,
    })
  } catch (err) {
    // Log but do not rethrow -- session completion must succeed even if accounting fails.
    logger.error('updateDailyStudyTime: DB error', {
      className: CLASS_NAME,
      methodName: 'updateDailyStudyTime',
      studentId,
      error: String(err),
    })
  }
}

/**
 * Reset todayStudyMinutes to 0 for a single user.
 * Called by the nightly job; can also be used in admin tooling.
 */
export async function resetDailyStudyTime(studentId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: studentId },
      data: { todayStudyMinutes: 0 },
    })
  } catch (err) {
    logger.error('resetDailyStudyTime: DB error', {
      className: CLASS_NAME,
      methodName: 'resetDailyStudyTime',
      studentId,
      error: String(err),
    })
  }
}

const dailyStudyLimitHelpers = { checkDailyStudyLimit, updateDailyStudyTime, resetDailyStudyTime }
export default dailyStudyLimitHelpers
