import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'

export const FREE_TIER_SESSION_LIMIT = 10

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
  } catch (err) {
    // On error, assume not paused to avoid unintentionally allowing unlimited sessions
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

