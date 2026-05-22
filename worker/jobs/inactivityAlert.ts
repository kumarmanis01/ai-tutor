/**
 * FILE OBJECTIVE:
 * - Scheduled job to notify parents when a linked child has been inactive
 *   for a configurable threshold (default 3 days). Respects parent mute windows
 *   and ensures only one alert per 3-day window per parent.
 * - Threshold is now per-parent from ParentProfile.inactivityThresholdDays (F-PAR-021 AC-01).
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/inactivityAlert.spec.ts
 * - tests/unit/worker/inactivityAlert-threshold.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 * - 2026-04-14T00:00:00Z | claude | per-parent inactivityThresholdDays (F-PAR-021 AC-01)
 * - 2026-04-14T12:00:00Z | staff-engineer | fix: prefilter cutoff to include min threshold; use per-parent days in email
 */

import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'
import { buildInactivityTemplate } from '@/lib/whatsapp/templates'
import { inactivityNudgeHtml } from '@/lib/email/templates'
import { generateMuteToken } from '@/lib/parent/signedLink'
import { getLocalDateString, startOfLocalDayUtc } from '@/lib/engagement/timezone'
import { t } from '@/lib/i18n'
import { canSendNotification } from '@/lib/notifications/policy'

// Global fallback threshold (days). Per-parent value from ParentProfile.inactivityThresholdDays
// takes precedence when available (F-PAR-021 AC-01).
const DEFAULT_INACTIVITY_DAYS = Number(process.env.PARENT_INACTIVITY_DAYS ?? '3')
// Widest possible threshold so the prefilter query never misses a parent with a long threshold.
const MAX_INACTIVITY_DAYS = 7
// Minimum supported threshold (settings allow 2,3,5,7)
const MIN_INACTIVITY_DAYS = 2

export async function runInactivityAlerts(): Promise<number> {
  const redis = getRedis()
  if (!redis) {
    logger.warn('inactivityAlert: no redis configured -- skipping')
    return 0
  }

  // Prefilter uses the minimum supported threshold so we include anyone who could
  // be considered inactive by any parent setting (avoid missing short thresholds).
  // Per-parent threshold is applied below in the per-parent check.
  const prefilterCutoff = new Date(Date.now() - (MIN_INACTIVITY_DAYS + 1) * 24 * 60 * 60 * 1000)

  // Find candidate students (we'll apply timezone-aware logic per-student)
  const inactiveStudents = await prisma.user.findMany({
    where: {
      role: UserRole.user,
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
      const minThresholdStartUtc = new Date(startOfTodayUtc.getTime() - MIN_INACTIVITY_DAYS * 24 * 60 * 60 * 1000)
      const minThresholdLocalDateStr = getLocalDateString(minThresholdStartUtc, studentTz)

      // If the student's last local date is >= minThresholdLocalDateStr they are not
      // inactive even for the shortest configured parent threshold -- skip entirely.
      if (lastLocalDateStr && lastLocalDateStr >= minThresholdLocalDateStr) {
        continue
      }
      // otherwise fall through and check linked parents

      // Find active linked parents (include inactivityThresholdDays for per-parent threshold)
      const links = await prisma.parentStudent.findMany({
        where: { studentId: s.id, status: 'active' },
        include: {
          parent: {
              select: {
                id: true,
                email: true,
                phone: true,
                whatsappPhone: true,
                name: true,
                language: true,
                parentProfile: {
                  select: {
                    digestOptOut: true,
                    inactivityOptOut: true,
                    inactivityThresholdDays: true,
                  },
                },
              },
            },
        },
      })

      for (const link of links) {
        const parent = link.parent
        // Skip if parent has no contact methods
        if (!parent?.email && !parent?.whatsappPhone) continue

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

        // F-PAR-021 AC-01: apply per-parent threshold (overrides env default)
        const parentThresholdDays: number = parentProfile?.inactivityThresholdDays ?? DEFAULT_INACTIVITY_DAYS
        const parentThresholdStart = new Date(startOfTodayUtc.getTime() - parentThresholdDays * 24 * 60 * 60 * 1000)
        const parentThresholdDateStr = getLocalDateString(parentThresholdStart, studentTz)
        if (lastLocalDateStr && lastLocalDateStr >= parentThresholdDateStr) {
          // Student is not inactive by THIS parent's threshold -- skip
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

          // F-PAR-021 AC-05: generate mute links for 3 configurable durations so the parent
          // can choose how long to suppress alerts (school exams, travel, family events).
          const MUTE_OPTIONS = [7, 14, 30] // days
          const muteLinks: { days: number; url: string }[] = []
          try {
            const muteBaseUrl = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'
            for (const days of MUTE_OPTIONS) {
              const token = generateMuteToken({ parentStudentId: link.id, studentId: s.id, muteDays: days })
              muteLinks.push({ days, url: `${muteBaseUrl}/api/parent/alerts/mute?t=${encodeURIComponent(token)}` })
            }
          } catch (e) {
            logger.warn('inactivityAlert: failed to generate mute tokens', { parentId: parent.id, studentId: s.id, err: String(e) })
          }

          const muteHtml = muteLinks.length > 0
            ? ` <br/><small>Mute alerts for: ${muteLinks.map((m) => `<a href="${m.url}">${m.days} days</a>`).join(' | ')}</small>`
            : ''

          const lastStudiedLabel = s.lastSessionDate
            ? new Date(s.lastSessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : ''
          // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
          const brandedHtml = inactivityNudgeHtml({
            parentName: parent.name ?? 'Parent',
            studentName: s.name ?? 'your child',
            inactiveDays: parentThresholdDays,
            lastStudiedLabel,
            dashboardUrl: deepLink,
          }) + muteHtml

          const waTemplate = parent.whatsappPhone
            ? buildInactivityTemplate(
                parent.name ?? 'Parent',
                s.name ?? 'your child',
                parentThresholdDays,
                deepLink,
              )
            : undefined

          await sendParentMilestoneNotification(parent.id, {
            email: parent.email ?? undefined,
            whatsappPhone: parent.whatsappPhone ?? undefined,
            whatsappTemplate: waTemplate,
            subject,
            html: brandedHtml,
            text: t('inactivity.body_html', { parentName: parent.name ?? 'Parent', studentName: s.name, days: String(parentThresholdDays), deepLink }, locale),
            meta: { studentId: s.id, type: 'inactivity', locale },
          })

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
