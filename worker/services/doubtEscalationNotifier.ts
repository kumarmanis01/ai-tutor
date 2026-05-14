/**
 * FILE OBJECTIVE:
 * - Worker service to notify students when an admin resolves an escalated doubt.
 * - On resolved escalations (resolvedAt != null && notifiedAt IS NULL):
 *   1. Cache resolution into shared `DoubtKb` (via `recordDoubt`) where possible.
 *   2. Send a push notification to the student.
 *   3. Mark `notifiedAt` on the `DoubtEscalation` row.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/doubtEscalationNotifier.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | senior-engineer | created worker to notify students on doubt resolution
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendPushToUser } from '@/lib/push/send'
import { sendMailSafe } from '@/lib/mailer'
import { adminBroadcastEmailHtml } from '@/lib/email/templates'
import { sendSms } from '@/lib/sms'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'
import { recordDoubt } from '@/lib/ai/tutor/doubtKb'

/**
 * Process a batch of resolved but un-notified escalations.
 * Returns the number of processed rows.
 */
async function processEscalation(esc: any, now: Date): Promise<void> {
  try {
    // Cache resolution into shared DoubtKb when we have a concept and resolution note
    let kbId: string | null = null
    if (esc.conceptId && esc.resolutionNote) {
      try {
        const concept = await prisma.concept.findUnique({ where: { id: esc.conceptId }, select: { subjectId: true } })
        if (concept?.subjectId) {
          // Use shared KB insertion (dedup logic). Fire-and-forget for heavy embedding work.
          try {
            void recordDoubt(esc.doubtText, esc.resolutionNote, concept.subjectId, esc.conceptId)
            // Attempt to find the KB row that was created/updated
            const found = await prisma.doubtKb.findFirst({
              where: { subjectId: concept.subjectId, questionText: esc.doubtText },
              orderBy: { updatedAt: 'desc' },
              select: { id: true },
            })
            if (found) kbId = found.id
          } catch (e) {
            logger.warn('doubtEscalationNotifier.cacheSharedFailed', { escalationId: esc.id, err: String((e as any)?.message ?? e) })
          }
        } else {
          // As a fallback, save student-scoped doubt so it's discoverable for that student
          try {
            const created = await prisma.doubtKb.create({
              data: {
                studentId: esc.studentId,
                sessionId: esc.sessionId,
                conceptId: esc.conceptId,
                question: esc.doubtText,
                answer: esc.resolutionNote,
              },
              select: { id: true },
            })
            kbId = created.id
          } catch (e) {
            logger.warn('doubtEscalationNotifier.cacheStudentFailed', { escalationId: esc.id, err: String((e as any)?.message ?? e) })
          }
        }
      } catch (e) {
        logger.warn('doubtEscalationNotifier.cacheFailed', { escalationId: esc.id, err: String((e as any)?.message ?? e) })
      }
    }

    // Send student push notification (prefer to know whether any push subscriptions exist)
    let pushSent = 0
    try {
      const res = await sendPushToUser(esc.studentId, PUSH_NOTIFICATIONS.doubt_resolved())
      pushSent = res?.sent ?? 0
    } catch (e) {
      logger.warn('doubtEscalationNotifier.pushCallFailed', { escalationId: esc.id, err: String((e as any)?.message ?? e) })
      pushSent = 0
    }

    // Fallback to email/SMS if push didn't reach the user
    if (pushSent === 0) {
      try {
        const user = await prisma.user.findUnique({ where: { id: esc.studentId }, select: { email: true, phone: true, name: true } })
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://app.spinzyacademy.com').replace(/\/$/, '')
        const deepLink = kbId ? `${appUrl}/student/doubts?id=${kbId}` : `${appUrl}/student/doubts`

        if (user?.email) {
          const subject = 'Improved explanation available'
          const bodyHtml = `<p>Hi ${user.name ?? ''},</p><p>We've updated our explanation for a topic you asked about. View the improved answer below.</p>`
          const html = adminBroadcastEmailHtml({ title: subject, body: `${bodyHtml}<p><a href="${deepLink}">View the improved answer</a></p>`, ctaUrl: deepLink })
          const text = `We've updated our explanation for a topic you asked about. View: ${deepLink}`
          await sendMailSafe({ to: user.email, subject, html, text })
        }

        if (user?.phone) {
          const smsText = `We've updated an explanation for a topic you asked about. Open: ${deepLink}`
          try { await sendSms(user.phone, smsText) } catch (e) { logger.warn('doubtEscalationNotifier.smsFailed', { escalationId: esc.id, err: String((e as any)?.message ?? e) }) }
        }
      } catch (e) {
        logger.warn('doubtEscalationNotifier.fallbackFailed', { escalationId: esc.id, err: String((e as any)?.message ?? e) })
      }
    }

    // Mark notifiedAt and optionally attach KB link
    const updateData: any = { notifiedAt: now }
    if (kbId) updateData.doubtKbId = kbId
    await prisma.doubtEscalation.update({ where: { id: esc.id }, data: updateData }).catch(() => {})
  } catch (err) {
    logger.error('doubtEscalationNotifier.rowProcessingError', { err: err instanceof Error ? err.message : String(err), escalationId: esc.id })
  }
}

export async function processDoubtEscalationNotifications(now = new Date()): Promise<number> {
  try {
    const rows = await prisma.doubtEscalation.findMany({
      where: { resolvedAt: { not: null }, notifiedAt: null },
      orderBy: { resolvedAt: 'asc' },
      take: 200,
    })

    for (const esc of rows) {
      await processEscalation(esc, now)
    }

    return rows.length
  } catch (err) {
    logger.error('doubtEscalationNotifier.failed', { err: err instanceof Error ? err.message : String(err) })
    return 0
  }
}

export async function processSingleDoubtEscalationNotification(id: string, now = new Date()): Promise<boolean> {
  const esc = await prisma.doubtEscalation.findUnique({ where: { id } })
  if (!esc) return false
  await processEscalation(esc, now)
  return true
}

export default processDoubtEscalationNotifications
