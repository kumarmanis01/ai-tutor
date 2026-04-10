/**
 * FILE OBJECTIVE:
 * - Centralized helper for sending parent-facing notifications with simple
 *   weekly caps for milestone emails to avoid over-notifying parents.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/delivery.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created
 */

import { getRedis } from '@/lib/redis'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { canSendNotification, recordSendNotification, NotificationType } from '@/lib/notifications/policy'

export async function sendParentMilestoneNotification(
  parentId: string,
  opts: { email?: string; phone?: string; subject: string; html: string; text?: string; meta?: { studentId?: string; type?: NotificationType; channel?: string; locale?: string } },
): Promise<{ sent: boolean; reason?: string }> {
  const type = opts.meta?.type ?? 'milestone'

  const redis = getRedis()
  if (!redis) {
    // best-effort: try to send email without enforcement
    try {
      if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
      if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
      // Persist audit if prisma available
      try {
        await prisma.parentNotification.create({
          data: {
            parentId,
            studentId: opts.meta?.studentId ?? null,
            type,
            channel: opts.meta?.channel ?? (opts.email ? 'email' : opts.phone ? 'sms' : 'unknown'),
            subject: opts.subject,
            body: { html: opts.html, text: opts.text ?? null },
            sentAt: new Date(),
          },
        })
      } catch (e) {
        logger.warn('[notifications] audit persist failed (no-redis path)', { parentId, error: String(e) })
      }
      return { sent: true }
    } catch (err) {
      logger.error('[notifications] fallback send failed', { error: String(err) })
      return { sent: false, reason: 'no-redis' }
    }
  }

  try {
    const check = await canSendNotification(parentId, type, opts.meta?.studentId)
    if (!check.allowed) return { sent: false, reason: check.reason }

    if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
    if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)

    // Record in redis policy layer (caps/suppression)
    await recordSendNotification(parentId, type, opts.meta?.studentId)

    // Persist audit record for compliance
    try {
      await prisma.parentNotification.create({
        data: {
          parentId,
          studentId: opts.meta?.studentId ?? null,
          type,
          channel: opts.meta?.channel ?? (opts.email ? 'email' : opts.phone ? 'sms' : 'unknown'),
          subject: opts.subject,
          body: { html: opts.html, text: opts.text ?? null },
          sentAt: new Date(),
        },
      })
    } catch (e) {
      logger.warn('[notifications] audit persist failed', { parentId, error: String(e) })
    }

    return { sent: true }
  } catch (err) {
    logger.error('[notifications] sendParentMilestoneNotification failed', { error: String(err) })
    return { sent: false, reason: 'error' }
  }
}
