/**
 * FILE OBJECTIVE:
 * - Centralized helper for sending parent-facing notifications with simple
 *   weekly caps for milestone emails to avoid over-notifying parents.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/delivery.spec.ts
 */

import { getRedis } from '@/lib/redis'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { canSendNotification, recordSendNotification, NotificationType } from '@/lib/notifications/policy'
import { incNotificationSent, incNotificationFailed } from '@/lib/metrics'

export async function sendParentMilestoneNotification(
  parentId: string,
  opts: { email?: string; phone?: string; subject: string; html: string; text?: string; meta?: { studentId?: string; type?: NotificationType; channel?: string; locale?: string } },
): Promise<{ sent: boolean; reason?: string }> {
  const type = opts.meta?.type ?? 'milestone'

  // Respect parent/child opt-outs before performing Redis-backed policy checks.
  try {
    const profile = await prisma.parentProfile.findUnique({ where: { userId: parentId } })
    // Parent-level digest opt-out short-circuits
    if (type === 'digest' && profile?.digestOptOut) return { sent: false, reason: 'parent_digest_opt_out' }
    // Child-level inactivity opt-out short-circuits
    if (type === 'inactivity' && opts.meta?.studentId) {
      try {
        const pp = await prisma.parentStudent.findFirst({ where: { parentId, studentId: opts.meta.studentId } })
        if (pp?.inactivityOptOut) return { sent: false, reason: 'child_inactivity_opt_out' }
      } catch (e) {
        logger.debug('[notifications] parentStudent lookup failed (best-effort)', { parentId, studentId: opts.meta?.studentId, error: String(e) })
      }
    }
  } catch (e) {
    // best-effort: ignore failures to fetch preferences and continue - log for visibility
    logger.debug('[notifications] failed to load parent profile (best-effort)', { parentId, error: String(e) })
  }

  const redis = getRedis()
  if (!redis) {
    // best-effort: try to send without enforcement
    try {
      // honor explicit channel override in meta
      const channel = opts.meta?.channel
      if (!channel || channel === 'email') {
        if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
      }
      if (!channel || channel === 'sms') {
        if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
      }
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
      // record metric for best-effort success
      incNotificationSent(type)
      return { sent: true }
    } catch (err) {
      logger.error('[notifications] fallback send failed', { error: String(err) })
      incNotificationFailed(type, 'no-redis')
      return { sent: false, reason: 'no-redis' }
    }
  }

  try {
    const check = await canSendNotification(parentId, type, opts.meta?.studentId)
    if (!check.allowed) return { sent: false, reason: check.reason }

    // honor explicit channel override in meta when Redis is present
    const channel = opts.meta?.channel
    if (!channel || channel === 'email') {
      if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
    }
    if (!channel || channel === 'sms') {
      if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
    }

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

    incNotificationSent(type)
    return { sent: true }
  } catch (err) {
    logger.error('[notifications] sendParentMilestoneNotification failed', { error: String(err) })
    incNotificationFailed(type, 'error')
    return { sent: false, reason: 'error' }
  }
}
