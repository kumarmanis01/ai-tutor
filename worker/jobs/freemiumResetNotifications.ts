/**
 * FILE OBJECTIVE:
 * - AC-05 (F-STU-040): Send push notifications to free-tier students whose
 *   monthly session cap resets in 3 days.
 * - Runs daily; skips silently on days that are not 3 days before month-end.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/freemiumResetNotifications.test.ts
 */

import { logger } from '@/lib/logger'
import { getStudentsNearingReset, daysUntilFreeTierReset } from '@/lib/freemium'
import { sendPushSafe } from '@/lib/push/send'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'

export interface FreemiumResetResult {
  daysLeft: number
  eligible: number
  sent: number
  skipped: boolean
}

/**
 * Send "sessions reset in 3 days" push to all free-tier students with usage.
 * Idempotent: each run checks the actual calendar; if today is not 3 days
 * before the 1st it returns immediately without touching the DB.
 */
export async function sendFreemiumResetNotifications(): Promise<FreemiumResetResult> {
  const daysLeft = daysUntilFreeTierReset()

  // Only fire on the day that is exactly 3 days before the reset
  if (daysLeft !== 3) {
    return { daysLeft, eligible: 0, sent: 0, skipped: true }
  }

  const studentIds = await getStudentsNearingReset(3)

  let sent = 0
  for (const studentId of studentIds) {
    try {
      await sendPushSafe(studentId, PUSH_NOTIFICATIONS.free_tier_reset_soon(3, 'Your'))
      sent++
    } catch (err) {
      logger.error('freemiumResetNotifications.sendFailed', {
        event: 'freemium_reset_notification_failed',
        context: {
          studentId,
          error: err instanceof Error ? err.message : String(err),
        },
      })
    }
  }

  logger.info('freemiumResetNotifications.completed', {
    event: 'freemium_reset_notifications_sent',
    context: { daysLeft, eligible: studentIds.length, sent },
  })

  return { daysLeft, eligible: studentIds.length, sent, skipped: false }
}
