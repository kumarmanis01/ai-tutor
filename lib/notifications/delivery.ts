/**
 * FILE OBJECTIVE:
 * - Centralized helper for sending parent-facing notifications.
 * - Primary channels: email + WhatsApp.
 * - SMS is available as an explicit opt-in channel only (not sent by default).
 * - Enforces weekly caps via Redis-backed policy layer.
 * - All sends are audited in ParentNotification table.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/delivery.spec.ts
 */

import { getRedis } from '@/lib/redis'
import { sendMailSafe } from '@/lib/mailer'
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { canSendNotification, recordSendNotification, NotificationType } from '@/lib/notifications/policy'
import { incNotificationSent, incNotificationFailed } from '@/lib/metrics'

// Channels that are treated as primary (sent by default when no channel override).
// SMS is deliberately excluded from defaults -- too noisy, low open rate.
const PRIMARY_CHANNELS = ['email', 'whatsapp'] as const

export async function sendParentMilestoneNotification(
  parentId: string,
  opts: {
    email?: string
    phone?: string
    whatsappPhone?: string
    subject: string
    html: string
    text?: string
    meta?: {
      studentId?: string
      type?: NotificationType
      channel?: string
      locale?: string
    }
  },
): Promise<{ sent: boolean; reason?: string }> {
  const type = opts.meta?.type ?? 'milestone'

  // Respect parent/child opt-outs before performing Redis-backed policy checks.
  try {
    const profile = await prisma.parentProfile.findUnique({ where: { userId: parentId } })
    if (type === 'digest' && profile?.digestOptOut) return { sent: false, reason: 'parent_digest_opt_out' }
    if (type === 'inactivity' && opts.meta?.studentId) {
      try {
        const pp = await prisma.parentStudent.findFirst({ where: { parentId, studentId: opts.meta.studentId } })
        if (pp?.inactivityOptOut) return { sent: false, reason: 'child_inactivity_opt_out' }
      } catch (e) {
        logger.debug('[notifications] parentStudent lookup failed (best-effort)', { parentId, studentId: opts.meta?.studentId, error: String(e) })
      }
    }
  } catch (e) {
    logger.debug('[notifications] failed to load parent profile (best-effort)', { parentId, error: String(e) })
  }

  const channelOverride = opts.meta?.channel ?? null
  // Determine which channels to use for this send.
  const useEmail    = !channelOverride || channelOverride === 'email'
  const useWhatsApp = !channelOverride || channelOverride === 'whatsapp'
  // SMS only sent when explicitly requested via channel override.
  const useSms      = channelOverride === 'sms'

  const redis = getRedis()

  if (!redis) {
    // Best-effort: send without rate-limit enforcement, log the gap.
    try {
      if (useEmail && opts.email)         await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
      if (useWhatsApp && opts.whatsappPhone) await sendWhatsAppSafe(opts.whatsappPhone, opts.text ?? opts.subject)
      if (useSms && opts.phone) {
        const { sendSms } = await import('@/lib/sms')
        await sendSms(opts.phone, opts.text ?? opts.subject)
      }
      await persistAudit(parentId, opts, type, channelOverride)
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

    if (useEmail && opts.email)            await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
    if (useWhatsApp && opts.whatsappPhone) await sendWhatsAppSafe(opts.whatsappPhone, opts.text ?? opts.subject)
    if (useSms && opts.phone) {
      const { sendSms } = await import('@/lib/sms')
      await sendSms(opts.phone, opts.text ?? opts.subject)
    }

    await recordSendNotification(parentId, type, opts.meta?.studentId)
    await persistAudit(parentId, opts, type, channelOverride)
    incNotificationSent(type)
    return { sent: true }
  } catch (err) {
    logger.error('[notifications] sendParentMilestoneNotification failed', { error: String(err) })
    incNotificationFailed(type, 'error')
    return { sent: false, reason: 'error' }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function persistAudit(
  parentId: string,
  opts: Parameters<typeof sendParentMilestoneNotification>[1],
  type: NotificationType,
  channelOverride: string | null,
): Promise<void> {
  const channel = channelOverride ?? (opts.email ? 'email' : opts.whatsappPhone ? 'whatsapp' : 'unknown')
  try {
    await prisma.parentNotification.create({
      data: {
        parentId,
        studentId: opts.meta?.studentId ?? null,
        type,
        channel,
        subject: opts.subject,
        body: { html: opts.html, text: opts.text ?? null },
        sentAt: new Date(),
      },
    })
  } catch (e) {
    logger.warn('[notifications] audit persist failed', { parentId, error: String(e) })
  }
}

export { PRIMARY_CHANNELS }
