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
  // Load parent-level preferences and parent-student link when available
  let parentProfile: { digestOptOut?: boolean; inactivityOptOut?: boolean } | null = null
  let parentLink: { inactivityOptOut?: boolean; excludeFromParentReport?: boolean } | null = null
  try {
    const pProm = prisma.parentProfile.findUnique({ where: { userId: parentId }, select: { digestOptOut: true, inactivityOptOut: true } }).catch(() => null)
    const lProm = opts.meta?.studentId ? prisma.parentStudent.findFirst({ where: { parentId, studentId: opts.meta.studentId }, select: { inactivityOptOut: true, excludeFromParentReport: true } }).catch(() => null) : Promise.resolve(null)
    ;[parentProfile, parentLink] = await Promise.all([pProm, lProm])
  } catch (e) {
    // best-effort — don't fail delivery due to DB issues
    logger.warn('[notifications] could not load parent preferences', { parentId, error: String(e) })
  }

  // Respect parent-level and per-child opt-outs
  if (type === 'digest') {
    if (parentProfile?.digestOptOut) return { sent: false, reason: 'parent_digest_opt_out' }
    if (opts.meta?.studentId && parentLink?.excludeFromParentReport) return { sent: false, reason: 'exclude_from_report' }
  }
  if (type === 'inactivity') {
    if (parentProfile?.inactivityOptOut) return { sent: false, reason: 'parent_inactivity_opt_out' }
    if (opts.meta?.studentId && parentLink?.inactivityOptOut) return { sent: false, reason: 'child_inactivity_opt_out' }
  }

  const redis = getRedis()
  // Decide preferred channel: explicit meta.channel -> email -> sms -> unknown
  const preferredChannel = (opts.meta && opts.meta.channel) ? opts.meta.channel : (opts.email ? 'email' : opts.phone ? 'sms' : 'unknown')

  if (!redis) {
    // best-effort: try to send on preferred channel without enforcement
    try {
      if (preferredChannel === 'email' && opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
      else if (preferredChannel === 'sms' && opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
      else {
        // fallback: try both channels if no clear preference
        if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
        if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
      }
      // Persist audit if prisma available
      try {
        await prisma.parentNotification.create({
          data: {
            parentId,
            studentId: opts.meta?.studentId ?? null,
            type,
            channel: opts.meta?.channel ?? preferredChannel ?? (opts.email ? 'email' : opts.phone ? 'sms' : 'unknown'),
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

    // Send only via preferred channel when possible
    if (preferredChannel === 'email') {
      if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
      else if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
    } else if (preferredChannel === 'sms') {
      if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
      else if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
    } else {
      // unknown: attempt both where available
      if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
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
          channel: opts.meta?.channel ?? preferredChannel ?? (opts.email ? 'email' : opts.phone ? 'sms' : 'unknown'),
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
