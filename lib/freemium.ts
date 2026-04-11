import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'

// AC-01 (F-STU-040): 3 AI tutoring sessions per month on free tier
export const FREE_TIER_SESSION_LIMIT = 3

export interface FreeTierStatus {
  allowed: boolean
  sessionsUsed: number
  sessionsRemaining: number
  periodStart: Date
}

function getCurrentPeriodStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
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

    let usage = await prisma.freeTierUsage.findUnique({
      where: { studentId },
    })

    if (!usage) {
      usage = await prisma.freeTierUsage.create({
        data: {
          studentId,
          periodStart: currentPeriodStart,
          sessionsUsed: 0,
        },
      })
    } else {
      const sameMonth =
        usage.periodStart.getFullYear() === currentPeriodStart.getFullYear() &&
        usage.periodStart.getMonth() === currentPeriodStart.getMonth()

      if (!sameMonth) {
        usage = await prisma.freeTierUsage.update({
          where: { studentId },
          data: {
            periodStart: currentPeriodStart,
            sessionsUsed: 0,
          },
        })
      }
    }

    const sessionsRemaining = Math.max(0, FREE_TIER_SESSION_LIMIT - usage.sessionsUsed)
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
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.ceil((firstOfNextMonth.getTime() - now.getTime()) / 86_400_000)
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
        periodStart: currentPeriodStart,
        sessionsUsed: { gt: 0 },
      },
      select: { studentId: true },
    })

    if (usageRows.length === 0) return []

    const studentIds = usageRows.map((r) => r.studentId)

    // Only notify students who are still on the free tier
    const freeStudents = await prisma.user.findMany({
      where: { id: { in: studentIds }, subscriptionStatus: 'free' },
      select: { id: true },
    })

    return freeStudents.map((u) => u.id)
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

    const currentPeriodStart = getCurrentPeriodStart()

    await prisma.$transaction(async (tx) => {
      const usage = await tx.freeTierUsage.findUnique({
        where: { studentId },
      })

      if (!usage) {
        await tx.freeTierUsage.create({
          data: {
            studentId,
            periodStart: currentPeriodStart,
            sessionsUsed: 1,
          },
        })
        return
      }

      let sessionsUsed = usage.sessionsUsed
      let periodStart = usage.periodStart

      const sameMonth =
        periodStart.getFullYear() === currentPeriodStart.getFullYear() &&
        periodStart.getMonth() === currentPeriodStart.getMonth()

      if (!sameMonth) {
        periodStart = currentPeriodStart
        sessionsUsed = 0
      }

      await tx.freeTierUsage.update({
        where: { studentId },
        data: {
          periodStart,
          sessionsUsed: sessionsUsed + 1,
        },
      })
    })
  } catch {
    // Swallow all errors - freemium enforcement must never break session start.
  }
}

