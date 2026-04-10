/**
 * FILE OBJECTIVE:
 * - Centralized notification policy for parent-facing messages (caps, suppression
 *   and keys). Keeps capping logic consistent across milestone, digest and
 *   inactivity notifications.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/policy.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | created
 */

import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

const DEFAULT_WEEKLY_CAP = Number(process.env.PARENT_WEEKLY_NOTIFICATION_CAP ?? '2')
const DEFAULT_INACTIVITY_SUPPRESSION_DAYS = Number(process.env.PARENT_INACTIVITY_SUPPRESSION_DAYS ?? '3')
const MS_DAY = 24 * 60 * 60 * 1000

export type NotificationType = 'milestone' | 'digest' | 'inactivity'

function weekBucketKey(parentId: string, type: NotificationType) {
  const now = Date.now()
  const week = Math.floor(now / (7 * MS_DAY))
  return `parent:notifications:${parentId}:week:${type}:${week}`
}

function suppressionKey(parentId: string, studentId: string | undefined, type: NotificationType) {
  if (studentId) return `parent:notifications:suppression:${type}:${parentId}:${studentId}`
  return `parent:notifications:suppression:${type}:${parentId}`
}

export async function canSendNotification(parentId: string, type: NotificationType, studentId?: string) {
  const redis = getRedis()
  if (!redis) return { allowed: true }

  try {
    if (type === 'milestone' || type === 'digest') {
      const key = weekBucketKey(parentId, type)
      const count = await (redis as any).get(key)
      if (count && Number(count) >= DEFAULT_WEEKLY_CAP) return { allowed: false, reason: 'weekly-cap' }
      return { allowed: true }
    }

    if (type === 'inactivity') {
      if (!studentId) return { allowed: true }
      const key = suppressionKey(parentId, studentId, type)
      const v = await (redis as any).get(key)
      if (v) return { allowed: false, reason: 'suppressed' }
      return { allowed: true }
    }

    return { allowed: true }
  } catch (err) {
    logger.warn('notification.policy: canSend failed — permissive allow', { parentId, type, error: String(err) })
    return { allowed: true }
  }
}

export async function recordSendNotification(parentId: string, type: NotificationType, studentId?: string) {
  const redis = getRedis()
  if (!redis) return

  try {
    if (type === 'milestone' || type === 'digest') {
      const key = weekBucketKey(parentId, type)
      const n = await (redis as any).incr(key)
      if (n === 1) await (redis as any).expire(key, 8 * 24 * 60 * 60)
      return
    }

    if (type === 'inactivity' && studentId) {
      const key = suppressionKey(parentId, studentId, type)
      // NX to avoid overwriting an existing suppression window
      await (redis as any).set(key, '1', 'NX', 'EX', DEFAULT_INACTIVITY_SUPPRESSION_DAYS * 24 * 60 * 60)
      return
    }
  } catch (err) {
    logger.warn('notification.policy: recordSend failed (non-fatal)', { parentId, type, error: String(err) })
  }
}

export { DEFAULT_WEEKLY_CAP as weeklyCap, DEFAULT_INACTIVITY_SUPPRESSION_DAYS as inactivitySuppressionDays }
