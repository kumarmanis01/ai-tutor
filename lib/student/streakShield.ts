/**
 * Streak Shield -- one shield per calendar month per student.
 *
 * When a student misses a day that would break their streak, the shield
 * auto-activates (if available) to preserve the streak for that month.
 *
 * Redis key:  streak:shield:used:{studentId}:{YYYY-MM}
 * Value:      '1'
 * TTL:        seconds until midnight UTC on the 1st of next month.
 *
 * Key ABSENT  → shield is available this month.
 * Key PRESENT → shield has been consumed this month.
 */

import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/** Returns the YYYY-MM string for the month containing the given date (UTC). */
export function getYearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Seconds from now until midnight UTC on the 1st of next month. */
function secondsUntilEndOfMonth(now: Date): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  // 1st of next month, midnight UTC
  const nextMonthStart = Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1);
  return Math.max(1, Math.floor((nextMonthStart - now.getTime()) / 1000));
}

function shieldKey(studentId: string, yearMonth: string): string {
  return `streak:shield:used:${studentId}:${yearMonth}`;
}

/**
 * Returns true if the student's shield is still available this month
 * (i.e. it has not been consumed yet).
 * Falls back to false on Redis error so streak-breaking remains the safe default.
 */
export async function isShieldAvailable(studentId: string, now = new Date()): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const key = shieldKey(studentId, getYearMonth(now));
    const val = await redis.get(key);
    return val === null; // key absent = shield available
  } catch (err) {
    logger.error('streakShield.isShieldAvailable.error', { studentId, error: String(err) });
    return false;
  }
}

/**
 * Marks the shield as consumed for this month.
 * Idempotent: calling twice is safe (just refreshes TTL).
 * Returns true on success, false on Redis error.
 */
export async function consumeShield(studentId: string, now = new Date()): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const key = shieldKey(studentId, getYearMonth(now));
    const ttl = secondsUntilEndOfMonth(now);
    await redis.set(key, '1', 'EX', ttl);
    logger.info('streakShield.consumed', {
      event: 'streak_shield_consumed',
      context: { studentId, yearMonth: getYearMonth(now) },
    });
    return true;
  } catch (err) {
    logger.error('streakShield.consumeShield.error', { studentId, error: String(err) });
    return false;
  }
}
