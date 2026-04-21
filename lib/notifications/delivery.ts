/**
 * FILE OBJECTIVE:
 * - Centralized helper for sending parent-facing notifications.
 * - Primary channels: email + WhatsApp (via approved Meta templates for system nudges).
 * - SMS deliberately excluded: lib/sms.sendSms() is an OTP-only endpoint (MSG91 v5)
 *   and cannot carry transactional notification messages. Keeping it here would produce
 *   silent non-delivery. A general-purpose SMS sender can be added later if needed.
 * - Enforces weekly caps via Redis-backed policy layer.
 * - All sends are audited in ParentNotification -- one row per channel actually sent.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/delivery.spec.ts
 */

import { getRedis } from '@/lib/redis'
import { sendMailSafe } from '@/lib/mailer'
import { sendWhatsAppTemplate, sendWhatsAppText } from '@/lib/whatsapp/sender'
import type { WaTemplateMessage } from '@/lib/whatsapp/sender'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { canSendNotification, recordSendNotification, NotificationType } from '@/lib/notifications/policy'
import { incNotificationSent, incNotificationFailed } from '@/lib/metrics'

export type { WaTemplateMessage }

export async function sendParentMilestoneNotification(
  parentId: string,
  opts: {
    email?: string
    whatsappPhone?: string
    // Provide a pre-built WaTemplateMessage for system nudges (inactivity, digest, milestone, trial).
    // If absent the delivery layer falls back to free-form text -- only valid for admin sends
    // that arrive within the 24-hour customer service window.
    whatsappTemplate?: WaTemplateMessage
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
  const useEmail    = !channelOverride || channelOverride === 'email'
  const useWhatsApp = !channelOverride || channelOverride === 'whatsapp'

  const redis = getRedis()

  if (!redis) {
    try {
      const sentChannels = await doSend(opts, useEmail, useWhatsApp)
      await persistAuditMulti(parentId, opts, type, sentChannels)
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

    const sentChannels = await doSend(opts, useEmail, useWhatsApp)
    await recordSendNotification(parentId, type, opts.meta?.studentId)
    await persistAuditMulti(parentId, opts, type, sentChannels)
    incNotificationSent(type)
    return { sent: true }
  } catch (err) {
    logger.error('[notifications] sendParentMilestoneNotification failed', { error: String(err) })
    incNotificationFailed(type, 'error')
    return { sent: false, reason: 'error' }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function doSend(
  opts: Parameters<typeof sendParentMilestoneNotification>[1],
  useEmail: boolean,
  useWhatsApp: boolean,
): Promise<string[]> {
  const sent: string[] = []

  if (useEmail && opts.email) {
    await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
    sent.push('email')
  }

  if (useWhatsApp && opts.whatsappPhone) {
    if (opts.whatsappTemplate) {
      // System nudge: use pre-approved Meta template to guarantee delivery
      await sendWhatsAppTemplate(opts.whatsappPhone, opts.whatsappTemplate)
    } else {
      // Admin custom send: free-form text (valid only within 24h customer service window)
      await sendWhatsAppText(opts.whatsappPhone, opts.text ?? opts.subject)
    }
    sent.push('whatsapp')
  }

  return sent
}

/** Write one ParentNotification audit row per channel that was actually sent. */
async function persistAuditMulti(
  parentId: string,
  opts: Parameters<typeof sendParentMilestoneNotification>[1],
  type: NotificationType,
  sentChannels: string[],
): Promise<void> {
  if (sentChannels.length === 0) return
  const now = new Date()
  await Promise.allSettled(
    sentChannels.map((channel) =>
      prisma.parentNotification.create({
        data: {
          parentId,
          studentId: opts.meta?.studentId ?? null,
          type,
          channel,
          subject: opts.subject,
          body: { html: opts.html, text: opts.text ?? null },
          sentAt: now,
        },
      }).catch((e) => {
        logger.warn('[notifications] audit persist failed', { parentId, channel, error: String(e) })
      }),
    ),
  )
}

export const PRIMARY_CHANNELS = ['email', 'whatsapp'] as const
