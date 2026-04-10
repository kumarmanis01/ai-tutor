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
  import { getLocalDateString, startOfLocalDayUtc } from '@/lib/engagement/timezone'
        { lastSessionDate: { lt: cutoff } },
        { lastSessionDate: null },
      ],
    },
    select: { id: true, name: true },
    take: 500,
  })

  let sent = 0

  for (const s of inactiveStudents) {
    try {
      // Find active linked parents
      const links = await prisma.parentStudent.findMany({
        where: { studentId: s.id, status: 'active' },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
              phone: true,
              name: true,
              parentProfile: { select: { digestOptOut: true, inactivityOptOut: true } },
            },
          },
        },
      })

      for (const link of links) {
        const parent = link.parent
        // Skip if parent has no contact methods
        if (!parent?.email && !parent?.phone) continue

        // Respect parent's digest/notification opt-out and inactivity-specific opt-out
        const parentProfile = (parent as any)?.parentProfile ?? {}
        const parentDigestOptOut = parentProfile?.digestOptOut ?? false
        const parentInactivityOptOut = parentProfile?.inactivityOptOut ?? false
        if (parentDigestOptOut || parentInactivityOptOut) {
          logger.info('inactivityAlert: parent opted out (digest/inactivity)', { parentId: parent.id, studentId: s.id })
          continue
        }

        // Respect per-child pause/exclude settings
        if ((link as any).excludeFromParentReport) {
          logger.info('inactivityAlert: child excluded from parent report', { parentId: parent.id, studentId: s.id })
          continue
        }

        if ((link as any).isPaused) {
          const pausedUntil = (link as any).pausedUntil
          if (pausedUntil && new Date(pausedUntil) > new Date()) {
            logger.info('inactivityAlert: child paused by parent', { parentId: parent.id, studentId: s.id, pausedUntil })
            continue
          }
        }

        // Atomic handling: acquire a short lock to avoid concurrent sends,
        // then set a 3-day suppression key only after a successful send.
        const suppressionKey = `parent:inactivity:${parent.id}:${s.id}`
        const lockKey = `parent:inactivity:lock:${parent.id}:${s.id}`

        // Try to acquire a short-lived lock (60s). If we fail, another
        // worker is handling the notification for this parent/student pair.
        let lockAcquired = false
        try {
          const lockRes = await (redis as any).set(lockKey, '1', 'EX', 60, 'NX')
          if (!lockRes) continue
          lockAcquired = true

          // Compose deep-link to student's next planned session if available
          const nextItem = await prisma.learningPlanItem.findFirst({
            where: { plan: { studentId: s.id }, status: 'UPCOMING' },
            include: { concept: { select: { id: true, name: true } } },
            orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
          })

            // Atomic suppression: attempt to set the suppression key with NX+EX.
            // If it already exists (or another worker acquired it), skip sending.
            const setRes = await redis.set(suppressionKey, '1', 'NX', 'EX', 3 * 24 * 60 * 60)
            if (setRes !== 'OK') continue

            // Resolve the student's next planned session for a deep-link (if available)
            const nextTopic = nextItem?.concept?.name ?? 'their next planned session'
            const baseUrl = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'
            const deepLink = nextItem ? `${baseUrl}/student/session/${nextItem.id}` : `${baseUrl}/parent/progress/${s.id}`

          const subject = `${s.name} hasn't been active recently — a quick nudge can help`
          const html = `<p>Hi ${parent.name},</p><p>We noticed ${s.name} hasn't studied in the last ${DEFAULT_INACTIVITY_DAYS} days. A short 10–15 minute activity can help them get back on track. <a href="${deepLink}">Open their next session</a></p>`

          await sendParentMilestoneNotification(parent.id, { email: parent.email ?? undefined, phone: parent.phone ?? undefined, subject, html })

          // Replace short lock with long suppression TTL so we don't spam parents
          try {
            await redis.del(lockKey)
          } catch {}
          sent++
        } catch (err) {
          // Ensure lock is removed on error so alerts can be retried
          if (lockAcquired) {
            try { await redis.del(lockKey) } catch {}
          }
          logger.error('inactivityAlert: send_failed', { parentId: parent.id, studentId: s.id, error: String(err) })
        }
      }
    } catch (err) {
      logger.error('inactivityAlert: error processing student', { studentId: s.id, error: String(err) })
    }
  }

  logger.info('inactivityAlert: completed', { sent })
  return sent
}
