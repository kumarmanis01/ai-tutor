/**
 * FILE OBJECTIVE:
 * - Worker to notify parents when linked children are inactive for a configured
 *   threshold (default: 3 days). Enforces one-alert-per-window (3 days),
 *   supports mute window via Redis, and includes a deep-link to the parent dashboard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/inactivityAlertWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created inactivity alert worker
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { getRedis } from '@/lib/redis'

const DEFAULT_THRESHOLD_DAYS = 3
const RATE_LIMIT_DAYS = 3

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000))
}

export async function processParentInactivityAlerts(now = new Date()): Promise<void> {
  const appUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.spinzyacademy.com').replace(/\/$/, '')
  try {
    const links = await prisma.parentStudent.findMany({
      where: { status: 'active' },
      select: {
        parentId: true,
        studentId: true,
        parent: { select: { name: true, email: true, phone: true } },
        student: { select: { name: true, lastSessionDate: true } },
      },
    })

    // Group children by parent
    const parentMap = new Map<string, { name?: string; email?: string; phone?: string; children: { studentId: string; name?: string; lastSessionDate?: Date | null }[] }>()
    for (const l of links) {
      if (!parentMap.has(l.parentId)) {
        parentMap.set(l.parentId, { name: l.parent?.name ?? 'Parent', email: l.parent?.email ?? undefined, phone: l.parent?.phone ?? undefined, children: [] })
      }
      parentMap.get(l.parentId)!.children.push({ studentId: l.studentId, name: l.student?.name ?? 'Student', lastSessionDate: l.student?.lastSessionDate ?? null })
    }

    const redis = getRedis()

    for (const [parentId, info] of parentMap) {
      try {
        // Mute window: parent may mute alerts (best-effort; stored in Redis key)
        if (redis) {
          const muted = await redis.get(`parent:alerts:muted:${parentId}`)
          if (muted) continue
        }

        // Rate-limit: max 1 inactivity alert per parent per RATE_LIMIT_DAYS
        if (redis) {
          const last = await redis.get(`parent:alert:inactivity:last_sent:${parentId}`)
          if (last) continue
        }

        const thresholdDays = DEFAULT_THRESHOLD_DAYS
        const inactiveChildren: { studentId: string; name?: string; daysSince: number }[] = []

        for (const c of info.children) {
          if (!c.lastSessionDate) continue
          const days = daysBetween(now, c.lastSessionDate)
          if (days >= thresholdDays) inactiveChildren.push({ studentId: c.studentId, name: c.name, daysSince: days })
        }

        if (inactiveChildren.length === 0) continue

        // Build messages
        const childNames = inactiveChildren.map((c) => `${c.name ?? 'your child'} (${c.daysSince}d)`).join(', ')
        const dashboardLink = `${appUrl}/parent/dashboard?child=${inactiveChildren[0].studentId}`
        const smsText = `Hi ${info.name ?? ''}, we noticed ${childNames} haven't had a study session in ${thresholdDays} days. A short 20-minute session today will help keep their progress. Open: ${dashboardLink}`
        const subject = inactiveChildren.length === 1
          ? `Reminder: ${inactiveChildren[0].name ?? 'Your child'} hasn't studied recently`
          : `Reminder: ${inactiveChildren.length} children haven't studied recently`
        const html = `<!doctype html><html><body><p>Hi ${info.name ?? ''},</p><p>We noticed the following children haven't had a study session in ${thresholdDays} days:</p><ul>${inactiveChildren.map(c => `<li>${c.name ?? 'Student'} — ${c.daysSince} day(s)</li>`).join('')}</ul><p>A short 20-minute session today will help keep their progress on track.</p><p><a href="${dashboardLink}">Open the parent dashboard</a> to see suggested next activities.</p><p>— Team Spinzy</p></body></html>`

        // Send email (best-effort)
        if (info.email) {
          await sendMailSafe({ to: info.email, subject, html, text: `${subject} — ${childNames}` })
        }

        if (info.phone) {
          // Fire-and-forget; sendSms returns a Promise
          sendSms(info.phone, smsText).catch((e) => logger.error('inactivityAlert.sendSmsFailed', { err: String(e), parentId }))
        }

        // Mark rate-limit key
        if (redis) {
          await redis.set(`parent:alert:inactivity:last_sent:${parentId}`, '1', 'EX', RATE_LIMIT_DAYS * 24 * 60 * 60)
        }

        logger.info('inactivityAlert.sent', { parentId, children: inactiveChildren.map(c => c.studentId), count: inactiveChildren.length })
      } catch (err) {
        logger.error('inactivityAlert.failedForParent', { parentId, err: err instanceof Error ? err.message : String(err) })
      }
    }
  } catch (err) {
    logger.error('inactivityAlert.failed', { err: err instanceof Error ? err.message : String(err) })
  }
}

export default processParentInactivityAlerts
