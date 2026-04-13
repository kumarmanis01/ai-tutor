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
import { UserRole } from '@prisma/client'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'
import { generateMuteToken } from '@/lib/parent/signedLink'
import { getLocalDateString, startOfLocalDayUtc } from '@/lib/engagement/timezone'
import { t } from '@/lib/i18n'
import { canSendNotification } from '@/lib/notifications/policy'

// Configurable threshold (days) that triggers inactivity alert
const DEFAULT_INACTIVITY_DAYS = Number(process.env.PARENT_INACTIVITY_DAYS ?? '3')

export async function runInactivityAlerts(): Promise<number> {
  const redis = getRedis()
  if (!redis) {
    logger.warn('inactivityAlert: no redis configured -- skipping')
    return 0
  }

  // Prefilter candidates using a UTC cutoff (slightly larger window to be safe)
  const prefilterCutoff = new Date(Date.now() - (DEFAULT_INACTIVITY_DAYS + 1) * 24 * 60 * 60 * 1000)

  // Find candidate students (we'll apply timezone-aware logic per-student)
  const inactiveStudents = await prisma.user.findMany({
    where: {
      role: UserRole.student,
      OR: [
        { lastSessionDate: { lt: prefilterCutoff } },
        { lastSessionDate: null },
      ],
    },
    select: { id: true, name: true, timezone: true, lastSessionDate: true },
    take: 500,
  })

  let sent = 0

  for (const s of inactiveStudents) {
    try {
      // Determine student's local date and whether they are inactive by local-days semantics
      const studentTz = (s as any).timezone ?? null
      const lastLocalDateStr = s.lastSessionDate ? getLocalDateString(new Date(s.lastSessionDate), studentTz) : null
      // start of local today UTC
      const todayLocalStr = getLocalDateString(new Date(), studentTz)
      const startOfTodayUtc = startOfLocalDayUtc(todayLocalStr, studentTz)
      const thresholdStartUtc = new Date(startOfTodayUtc.getTime() - DEFAULT_INACTIVITY_DAYS * 24 * 60 * 60 * 1000)
      const thresholdLocalDateStr = getLocalDateString(thresholdStartUtc, studentTz)

      // If the student's last local date is >= thresholdLocalDateStr they are not inactive
      if (lastLocalDateStr && lastLocalDateStr >= thresholdLocalDateStr) {
        // Not inactive by local-days semantics
        continue
      }
      // otherwise fall through and check linked parents

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
                language: true,
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

        // Respect per-child inactivity opt-out
        if ((link as any).inactivityOptOut) {
          logger.info('inactivityAlert: child opted out of inactivity alerts', { parentId: parent.id, studentId: s.id })
          continue
        }

        if ((link as any).isPaused) {
          const pausedUntil = (link as any).pausedUntil
          if (pausedUntil && new Date(pausedUntil) > new Date()) {
            logger.info('inactivityAlert: child paused by parent', { parentId: parent.id, studentId: s.id, pausedUntil })
            continue
          }
        }

        // Acquire a short lock to serialize checks and avoid races.
        const lockKey = `parent:inactivity:lock:${parent.id}:${s.id}`
        const lockRes = await (redis as any).set(lockKey, '1', 'EX', 60, 'NX')
        if (!lockRes) continue

        try {
          // Check centralized policy for suppression/cap
          const allowed = await canSendNotification(parent.id, 'inactivity', s.id)
          if (!allowed.allowed) {
            logger.info('inactivityAlert: policy prevents send', { parentId: parent.id, studentId: s.id, reason: allowed.reason })
            continue
          }

          // Compose deep-link to student's next planned session if available
          const nextItem = await prisma.learningPlanItem.findFirst({
            where: { plan: { studentId: s.id }, status: 'UPCOMING' },
            include: { concept: { select: { id: true, name: true } } },
            orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
          })

          // Resolve the student's next planned session for a deep-link (if available)
          const nextTopic = nextItem?.concept?.name ?? 'their next planned session'
          const baseUrl = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'
          const deepLink = nextItem
            ? `${baseUrl}/student/session/${nextItem.id}?focus=next&itemId=${encodeURIComponent(nextItem.id)}`
            : `${baseUrl}/parent/progress/${s.id}`

          const locale = parent.language ?? undefined
          const subject = t('inactivity.subject', { studentName: s.name }, locale)
          // Build a mute link token so parent can mute alerts for a period from the email
          const muteDays = 7
          let muteLink = ''
          try {
            const token = generateMuteToken({ parentStudentId: link.id, studentId: s.id, muteDays })
            const baseUrl = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'
            muteLink = `${baseUrl}/api/parent/alerts/mute?t=${encodeURIComponent(token)}`
          } catch (e) {
            logger.warn('inactivityAlert: failed to generate mute token', { parentId: parent.id, studentId: s.id, err: String(e) })
          }

          const muteHtml = muteLink ? ` <br/><small><a href="${muteLink}">Mute inactivity alerts for ${muteDays} days</a></small>` : ''

          const bodyHtml = t('inactivity.body_html', { parentName: parent.name ?? 'Parent', studentName: s.name, days: String(DEFAULT_INACTIVITY_DAYS), deepLink }, locale) + muteHtml

          await sendParentMilestoneNotification(parent.id, { email: parent.email ?? undefined, phone: parent.phone ?? undefined, subject, html: bodyHtml, meta: { studentId: s.id, type: 'inactivity', channel: parent.email ? 'email' : parent.phone ? 'sms' : 'unknown', locale } })

          sent++
        } catch (err) {
          logger.error('inactivityAlert: send_failed', { parentId: parent.id, studentId: s.id, error: String(err) })
        } finally {
          // Always remove the short lock so future runs can proceed
          try {
            await (redis as any).del(lockKey)
          } catch {}
        }
      }
    } catch (err) {
      logger.error('inactivityAlert: error processing student', { studentId: s.id, error: String(err) })
    }
  }

  logger.info('inactivityAlert: completed', { sent })
  return sent
}
