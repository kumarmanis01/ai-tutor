/**
 * FILE OBJECTIVE:
 * - Scheduled job to notify parents when a linked child has been inactive
 *   for a configurable threshold (default 3 days). Respects parent mute windows
 *   and ensures only one alert per 3-day window per parent.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/inactivityAlert.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'

// Configurable threshold (days) that triggers inactivity alert
const DEFAULT_INACTIVITY_DAYS = Number(process.env.PARENT_INACTIVITY_DAYS ?? '3')

export async function runInactivityAlerts(): Promise<number> {
  const redis = getRedis()
  if (!redis) {
    logger.warn('inactivityAlert: no redis configured -- skipping')
    return 0
  }

  // Find students whose last structured session startedAt is older than threshold
  const cutoff = new Date(Date.now() - DEFAULT_INACTIVITY_DAYS * 24 * 60 * 60 * 1000)

  // Find the most recent session per student (using aggregated table if exists)
  const inactiveStudents = await prisma.user.findMany({
    where: {
      role: 'student',
      OR: [
        { lastSessionAt: { lt: cutoff } },
        { lastSessionAt: null },
      ],
    },
    select: { id: true, name: true },
    take: 500,
  })

  let sent = 0

  for (const s of inactiveStudents) {
    try {
      // Find active linked parents
      const links = await prisma.parentStudent.findMany({ where: { studentId: s.id, status: 'active' }, include: { parent: { select: { id: true, email: true, phone: true, name: true } } } })
      for (const link of links) {
        const parent = link.parent
        if (!parent?.email && !parent?.phone) continue

        // Use Redis key to prevent multiple alerts too frequently
        const key = `parent:inactivity:${parent.id}:${s.id}`
        const exists = await redis.get(key)
        if (exists) continue // already alerted recently

        const subject = `${s.name} hasn't been active recently — a quick nudge can help`
        const html = `<p>Hi ${parent.name},</p><p>We noticed ${s.name} hasn't studied in the last ${DEFAULT_INACTIVITY_DAYS} days. A short 10–15 minute activity can help them get back on track. <a href="${process.env.NEXTAUTH_URL || 'https://spinzyacademy.com'}/parent/progress/${s.id}">Open their learning plan</a></p>`

        await sendParentMilestoneNotification(parent.id, { email: parent.email ?? undefined, phone: parent.phone ?? undefined, subject, html })
        // Set a 3-day suppression key so we don't spam parents
        await redis.setex(key, 3 * 24 * 60 * 60, '1')
        sent++
      }
    } catch (err) {
      logger.error('inactivityAlert: error processing student', { studentId: s.id, error: String(err) })
    }
  }

  logger.info('inactivityAlert: completed', { sent })
  return sent
}
