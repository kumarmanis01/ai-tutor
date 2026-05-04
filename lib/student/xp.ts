import { prisma } from '@/lib/prisma'
import { sendPushSafe } from '@/lib/push/send'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'
import { milestoneEmailHtml } from '@/lib/email/templates'
import { buildMilestoneTemplate } from '@/lib/whatsapp/templates'
import { logger } from '@/lib/logger'
import {
  getLevelFromXP,
  getXPToNextLevel,
  getProgressPercent,
  getLevelTierName,
  getTierColor,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
} from '@/lib/student/xpLevels'

// Re-export pure level functions and constants for existing callers.
export { getLevelFromXP, getXPToNextLevel, getProgressPercent, getLevelTierName, getTierColor, LEVEL_THRESHOLDS, MAX_LEVEL }

export type StudentXPSource =
  | 'session_correct'
  | 'streak_bonus'
  | 'revision_complete'
  | 'badge'

/**
 * Award XP to a student.
 * 1. Insert StudentXP row.
 * 2. Increment User.totalXp atomically.
 * 3. Recalculate level from new totalXp.
 * 4. If level changed -- update User.level, return leveledUp: true.
 * All in a Prisma transaction. Never throws -- returns null on error.
 */
export async function awardXP(params: {
  studentId: string
  amount: number
  source: StudentXPSource
  sessionId?: string
}): Promise<{
  xpAwarded: number
  totalXp: number
  level: number
  leveledUp: boolean
  newLevel: number | null
} | null> {
  const amount = Math.max(0, Math.floor(params.amount))
  if (amount === 0) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.studentId },
        select: { totalXp: true, level: true },
      })
      if (!user) return null
      return {
        xpAwarded: 0,
        totalXp: user.totalXp,
        level: user.level,
        leveledUp: false,
        newLevel: null,
      }
    } catch {
      return null
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: params.studentId },
        select: { totalXp: true, level: true },
      })
      if (!user) return null

      await tx.studentXP.create({
        data: {
          studentId: params.studentId,
          source: params.source,
          amount,
          sessionId: params.sessionId ?? null,
        },
      })

      const newTotalXp = user.totalXp + amount
      const newLevel = getLevelFromXP(newTotalXp)
      const levelChanged = newLevel !== user.level

      await tx.user.update({
        where: { id: params.studentId },
        data: {
          totalXp: newTotalXp,
          ...(levelChanged ? { level: newLevel } : {}),
        },
      })

      return {
        xpAwarded: amount,
        totalXp: newTotalXp,
        level: newLevel,
        leveledUp: levelChanged,
        newLevel: levelChanged ? newLevel : null,
      }
    })
    // Fire level-up push notification (best-effort, outside transaction)
    if (result?.leveledUp && result.newLevel !== null) {
      void sendPushSafe(params.studentId, PUSH_NOTIFICATIONS.level_up(result.newLevel))

      // Parent milestone notification for level-up (F-PAR-022 AC-01).
      void (async () => {
        try {
          const [student, links] = await Promise.all([
            prisma.user.findUnique({ where: { id: params.studentId }, select: { name: true } }),
            prisma.parentStudent.findMany({
              where: { studentId: params.studentId, status: 'active' },
              include: { parent: { select: { id: true, email: true, whatsappPhone: true, name: true, language: true } } },
            }),
          ])

          if (links.length === 0) return

          const studentName = student?.name ?? 'Your child'
          const milestoneLabel = `Level up: Level ${result.newLevel}`
          const dashboardUrl = `${(process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com').replace(/\/$/, '')}/parent/dashboard`

          await Promise.allSettled(links.map((pl) => {
            const brandedHtml = milestoneEmailHtml({
              parentName: pl.parent.name ?? 'Parent',
              studentName,
              milestoneLabel,
              milestoneDetail: `Great momentum. A short celebratory check-in can reinforce this learning habit.`,
              dashboardUrl,
            })
            const waTemplate = pl.parent.whatsappPhone
              ? buildMilestoneTemplate(pl.parent.name ?? 'Parent', studentName, milestoneLabel, dashboardUrl)
              : undefined
            return sendParentMilestoneNotification(pl.parent.id, {
              email: pl.parent.email ?? undefined,
              whatsappPhone: pl.parent.whatsappPhone ?? undefined,
              whatsappTemplate: waTemplate,
              subject: `${studentName} reached Level ${result.newLevel}`,
              html: brandedHtml,
              text: `${studentName} reached Level ${result.newLevel}. View progress: ${dashboardUrl}`,
              meta: { studentId: params.studentId, type: 'milestone', locale: pl.parent.language ?? undefined },
            })
          }))
        } catch (err) {
          logger.warn('xp.levelUp.parentNotifyFailed', { studentId: params.studentId, error: String(err) })
        }
      })()
    }
    return result
  } catch {
    return null
  }
}
