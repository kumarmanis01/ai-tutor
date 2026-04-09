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

const DEFAULT_WEEKLY_MILESTONE_CAP = 2

function weekBucketKey(parentId: string): string {
  // simple week bucket using Unix epoch weeks to avoid timezone issues
  const now = Date.now()
  const week = Math.floor(now / (7 * 24 * 60 * 60 * 1000))
  return `parent:milestones:${parentId}:week:${week}`
}

export async function sendParentMilestoneNotification(parentId: string, opts: { email?: string; phone?: string; subject: string; html: string; text?: string; }): Promise<{ sent: boolean; reason?: string }> {
  const redis = getRedis()
  if (!redis) {
    // best-effort: try to send email without enforcement
    try {
      if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
      if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
      return { sent: true }
    } catch (err) {
      logger.error('[notifications] fallback send failed', { error: String(err) })
      return { sent: false, reason: 'no-redis' }
    }
  }

  try {
    const key = weekBucketKey(parentId)
    const count = await redis.incr(key)
    if (count === 1) {
      // expire after 8 days to cover weekly boundary
      await redis.expire(key, 8 * 24 * 60 * 60)
    }
    if (count > DEFAULT_WEEKLY_MILESTONE_CAP) {
      return { sent: false, reason: 'cap-exceeded' }
    }

    if (opts.email) await sendMailSafe({ to: opts.email, subject: opts.subject, html: opts.html, text: opts.text })
    if (opts.phone) await sendSms(opts.phone, opts.text ?? opts.subject)
    return { sent: true }
  } catch (err) {
    logger.error('[notifications] sendParentMilestoneNotification failed', { error: String(err) })
    return { sent: false, reason: 'error' }
  }
}
