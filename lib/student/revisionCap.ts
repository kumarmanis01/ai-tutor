/**
 * AC-06 (F-STU-022): Daily 20-minute revision cap tracking via Redis.
 *
 * Key:  revision:daily-minutes:{userId}:{YYYY-MM-DD}
 * TTL:  seconds remaining until midnight UTC (auto-reset each day).
 * Unit: minutes (integer).
 */

import { getRedis } from '@/lib/redis'

export const REVISION_DAILY_CAP_MINUTES = 20

function todayKey(userId: string): string {
  const d = new Date()
  const dateStr = d.toISOString().slice(0, 10) // YYYY-MM-DD
  return `revision:daily-minutes:${userId}:${dateStr}`
}

function secondsUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = new Date()
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 1000))
}

/**
 * Increment the student's daily revision minutes by the given amount.
 * Silent no-op when Redis is unavailable.
 */
export async function addRevisionMinutes(userId: string, minutes: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    const key = todayKey(userId)
    const ttl = secondsUntilMidnightUTC()
    await redis.incrby(key, Math.max(1, Math.round(minutes)))
    await redis.expire(key, ttl)
  } catch {
    // Non-fatal: cap enforcement degrades gracefully when Redis is down
  }
}

/**
 * Get how many revision minutes the student has logged today.
 * Returns 0 when Redis is unavailable.
 */
export async function getRevisionMinutesToday(userId: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0
  try {
    const key = todayKey(userId)
    const raw = await redis.get(key)
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

/** Returns true when the student has hit the daily cap. */
export function isCapReached(minutesUsed: number): boolean {
  return minutesUsed >= REVISION_DAILY_CAP_MINUTES
}
