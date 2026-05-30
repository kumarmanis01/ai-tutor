/**
 * FILE OBJECTIVE:
 * - Freemium enforcement helpers: free-tier limits, counters and utilities.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/freemium.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | strict-mode: annotate map callbacks and add header
 * - 2026-05-04T00:00:00Z | copilot | scope usage rows by subjectScope+periodStart and enforce chapter-test caps per subject
 */

import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'
import { logger } from '@/lib/logger'
export { FREE_TIER_SESSION_LIMIT, FREE_TIER_CHAPTER_TEST_LIMIT } from '@/lib/constants/freemium'
import { FREE_TIER_SESSION_LIMIT, FREE_TIER_CHAPTER_TEST_LIMIT } from '@/lib/constants/freemium'
const SESSION_SCOPE = '__ALL__'

export interface FreeTierStatus {
  allowed: boolean
  sessionsUsed: number
  sessionsRemaining: number
  periodStart: Date
}

export interface ChapterTestCapStatus {
  allowed: boolean
  testsUsed: number
  testsRemaining: number
  periodStart: Date
}

function getCurrentPeriodStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/**
 * Returns true if any active parent control pauses this student now.
 */
async function isStudentPaused(studentId: string): Promise<boolean> {
  try {
    const now = new Date()

    // Check explicit parent child control first (existing behavior)
    const control = await prisma.parentChildControl.findFirst({
      where: {
        studentId,
        isPaused: true,
        OR: [
          { pausedUntil: null },
          { pausedUntil: { gt: now } },
        ],
      },
    })
    if (control) return true

    // Additionally consider parent-student links that may be paused (per-link pause)
    const linkPause = await prisma.parentStudent.findFirst({
      where: {
        studentId,
        status: 'active',
        isPaused: true,
        OR: [
          { pausedUntil: null },
          { pausedUntil: { gt: now } },
        ],
      },
    })

    return !!linkPause
  } catch (_err) {
    // On error, assume not paused to avoid unintentionally allowing unlimited sessions
    // Log for visibility in diagnostics
    try { logger.debug('isStudentPaused: DB lookup failed (best-effort)', { studentId, error: String(_err) }) } catch {}
    return false
  }
}


/**
 * Check if student can start a new session.
 * Resets counter if current period is a new calendar month.
 * Never throws -- returns allowed: false on any DB or subscription error.
 */
export async function checkFreeTierCap(studentId: string): Promise<FreeTierStatus> {
  const fallback: FreeTierStatus = {
    allowed: false,
    sessionsUsed: 0,
    sessionsRemaining: 0,
    periodStart: getCurrentPeriodStart(),
  }

  try {
    // Premium students bypass cap entirely.
    const isPremium = await isPremiumUser(studentId)
    if (isPremium) {
      const periodStart = getCurrentPeriodStart()
      return {
        allowed: true,
        sessionsUsed: 0,
        sessionsRemaining: FREE_TIER_SESSION_LIMIT,
        periodStart,
      }
    }

    const currentPeriodStart = getCurrentPeriodStart()

    let usage = await prisma.freeTierUsage.findFirst({
      where: {
        studentId,
        subjectScope: SESSION_SCOPE,
        periodStart: currentPeriodStart,
      },
    })

    if (!usage) {
      usage = await prisma.freeTierUsage.create({
        data: {
          studentId,
          subjectScope: SESSION_SCOPE,
          periodStart: currentPeriodStart,
          sessionsUsed: 0,
          chapterTestsUsed: 0,
        },
      })
    }

    // If a parent has paused this child, sessions during the pause do not count
    // against free-tier limits. Report allowed=true and do not decrement usage.
    const paused = await isStudentPaused(studentId)
    const sessionsRemaining = Math.max(0, FREE_TIER_SESSION_LIMIT - usage.sessionsUsed)
    if (paused) {
      return {
        allowed: true,
        sessionsUsed: usage.sessionsUsed,
        sessionsRemaining,
        periodStart: usage.periodStart,
      }
    }

    const allowed = usage.sessionsUsed < FREE_TIER_SESSION_LIMIT

    return {
      allowed,
      sessionsUsed: usage.sessionsUsed,
      sessionsRemaining,
      periodStart: usage.periodStart,
    }
  } catch {
    return fallback
  }
}

/**
 * Return the number of days until the 1st of next month (calendar reset day).
 */
export function daysUntilFreeTierReset(): number {
  const now = new Date()
  // Use UTC-based arithmetic so this function is timezone-independent and
  // deterministic in tests that mock global Date with UTC ISO strings.
  const firstOfNextMonthUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds(),
  )
  return Math.ceil((firstOfNextMonthUtc - nowUtc) / 86_400_000)
}

/**
 * Find all free-tier students who have used at least 1 session this period
 * and whose reset is exactly `targetDaysOut` days away.
 * Returns array of studentIds.
 * Never throws -- returns [] on error.
 */
export async function getStudentsNearingReset(targetDaysOut: number = 3): Promise<string[]> {
  try {
    const daysLeft = daysUntilFreeTierReset()
    if (daysLeft !== targetDaysOut) return []

    const currentPeriodStart = getCurrentPeriodStart()

    const usageRows = await prisma.freeTierUsage.findMany({
      where: {
        subjectScope: SESSION_SCOPE,
        periodStart: currentPeriodStart,
        sessionsUsed: { gt: 0 },
      },
      select: { studentId: true },
    })

    if (usageRows.length === 0) return []

    const studentIds = Array.from(new Set(usageRows.map((r: { studentId: string }) => r.studentId)))

    // Only notify students who are still on the free tier
    const freeStudents = await prisma.user.findMany({
      where: { id: { in: studentIds }, subscriptionStatus: 'free' },
      select: { id: true },
    })

    return freeStudents.map((u: { id: string }) => u.id)
  } catch {
    return []
  }
}

/**
 * Increment sessionsUsed for the student's current period.
 * Call AFTER session successfully starts -- not before.
 * Never throws.
 */
export async function incrementFreeTierUsage(studentId: string): Promise<void> {
  try {
    // Premium students bypass cap entirely.
    const isPremium = await isPremiumUser(studentId)
    if (isPremium) return

    // If paused by parent, do not count this session against free limits.
    const paused = await isStudentPaused(studentId)
    if (paused) return

    const currentPeriodStart = getCurrentPeriodStart()

    await prisma.$transaction(async (tx) => {
      const usage = await tx.freeTierUsage.findFirst({
        where: {
          studentId,
          subjectScope: SESSION_SCOPE,
          periodStart: currentPeriodStart,
        },
      })

      if (!usage) {
        await tx.freeTierUsage.create({
          data: {
            studentId,
            subjectScope: SESSION_SCOPE,
            periodStart: currentPeriodStart,
            sessionsUsed: 1,
            chapterTestsUsed: 0,
          },
        })
        return
      }

      await tx.freeTierUsage.update({
        where: { id: usage.id },
        data: {
          sessionsUsed: usage.sessionsUsed + 1,
        },
      })
    })
  } catch {
    // Swallow all errors - freemium enforcement must never break session start.
  }
}

/**
 * Check if a free-tier student can start a new chapter test.
 * AC-01 (F-STU-040): 1 chapter test per subject per month.
 * Premium students bypass the cap.
 * Never throws -- returns allowed: false on DB or subscription error.
 */
export async function checkChapterTestCap(studentId: string, subjectScope: string): Promise<ChapterTestCapStatus> {
  const periodStart = getCurrentPeriodStart()
  const fallback: ChapterTestCapStatus = {
    allowed: false,
    testsUsed: 0,
    testsRemaining: 0,
    periodStart,
  }

  try {
    if (!subjectScope) return fallback

    const isPremium = await isPremiumUser(studentId)
    if (isPremium) {
      return { allowed: true, testsUsed: 0, testsRemaining: FREE_TIER_CHAPTER_TEST_LIMIT, periodStart }
    }

    const currentPeriodStart = getCurrentPeriodStart()

    let usage = await prisma.freeTierUsage.findFirst({
      where: {
        studentId,
        subjectScope,
        periodStart: currentPeriodStart,
      },
    })

    if (!usage) {
      usage = await prisma.freeTierUsage.create({
        data: { studentId, subjectScope, periodStart: currentPeriodStart, sessionsUsed: 0, chapterTestsUsed: 0 },
      })
    }

    const testsUsed = usage.chapterTestsUsed ?? 0
    const testsRemaining = Math.max(0, FREE_TIER_CHAPTER_TEST_LIMIT - testsUsed)
    return { allowed: testsUsed < FREE_TIER_CHAPTER_TEST_LIMIT, testsUsed, testsRemaining, periodStart: usage.periodStart }
  } catch {
    return fallback
  }
}

/**
 * Increment chapterTestsUsed for the student's current period.
 * Call AFTER chapter test successfully starts -- not before.
 * Never throws.
 */
export async function incrementChapterTestUsage(studentId: string, subjectScope: string): Promise<void> {
  try {
    if (!subjectScope) return

    const isPremium = await isPremiumUser(studentId)
    if (isPremium) return

    const currentPeriodStart = getCurrentPeriodStart()

    await prisma.$transaction(async (tx) => {
      const usage = await tx.freeTierUsage.findFirst({
        where: {
          studentId,
          subjectScope,
          periodStart: currentPeriodStart,
        },
      })

      if (!usage) {
        await tx.freeTierUsage.create({
          data: { studentId, subjectScope, periodStart: currentPeriodStart, sessionsUsed: 0, chapterTestsUsed: 1 },
        })
        return
      }

      await tx.freeTierUsage.update({
        where: { id: usage.id },
        data: {
          chapterTestsUsed: usage.chapterTestsUsed + 1,
        },
      })
    })
  } catch {
    // Swallow -- freemium enforcement must never break chapter test start.
  }
}

