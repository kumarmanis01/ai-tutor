/**
 * FILE OBJECTIVE:
 * - Daily AI credit tracking via Redis. Provides atomic INCR-based counters keyed by
 *   userId + IST date. Expiry is set to the next IST midnight so counters reset daily.
 *
 * LINKED UNIT TEST:
 * - tests/unit/credits/dailyCredits.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial implementation for task S1-3
 */

import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { isPremiumUser } from '@/lib/subscription';
import { DAILY_FREE_LIMIT, DAILY_PAID_LIMIT } from '@/lib/constants/credits';

// IST is UTC+5:30 = 330 minutes ahead of UTC.
const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Returns the current date string (YYYY-MM-DD) in the Asia/Kolkata (IST) timezone.
 * Computed arithmetically to avoid a tz-data dependency.
 */
export function getISTDateString(): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10);
}

/**
 * Returns the Unix timestamp (seconds) of the next IST midnight.
 * Used as the EXPIREAT argument so each counter automatically resets at 00:00 IST.
 *
 * Derivation: next IST midnight = (tomorrow at 00:00 UTC) - IST_OFFSET_MS
 * where "tomorrow" is computed from the current IST calendar date.
 */
export function getNextISTMidnightUnix(): number {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istDateStr = istNow.toISOString().slice(0, 10);
  const [year, month, day] = istDateStr.split('-').map(Number);
  // Date.UTC(year, month-1, day+1) = "tomorrow at 00:00 UTC" based on IST date parts.
  // Subtracting IST offset gives "tomorrow at 00:00 IST" expressed as a UTC timestamp.
  const nextMidnightMs = Date.UTC(year, month - 1, day + 1) - IST_OFFSET_MS;
  return Math.floor(nextMidnightMs / 1000);
}

/** Builds the Redis key for a given user's daily credit counter. */
function buildCreditKey(userId: string): string {
  return `credits:${userId}:${getISTDateString()}`;
}

/**
 * Returns the current daily AI interaction count for a user.
 * Returns 0 on Redis failure -- never blocks the request.
 *
 * @param userId - The student's user ID (from session, never client-supplied).
 * @returns Current count, or 0 if Redis is unavailable.
 */
export async function getDailyUsage(userId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const raw = await redis.get(buildCreditKey(userId));
    return raw ? parseInt(raw, 10) : 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('credits.getDailyUsage.failed', { userId, error: message });
    return 0;
  }
}

/**
 * Atomically increments the daily credit counter and sets expiry to the next IST midnight.
 * Returns the new count. Returns 0 on Redis failure -- never throws.
 *
 * @param userId - The student's user ID (from session, never client-supplied).
 * @returns New count after increment, or 0 if Redis is unavailable.
 */
export async function incrementDailyUsage(userId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const key = buildCreditKey(userId);
  try {
    const newCount = await redis.incr(key);
    // Set expiry atomically after INCR. EXPIREAT is idempotent -- safe to re-apply.
    await redis.expireat(key, getNextISTMidnightUnix());
    return newCount;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('credits.incrementDailyUsage.failed', { userId, error: message });
    return 0;
  }
}

/**
 * Returns the daily AI interaction limit for a user based on their subscription plan.
 * Falls back to DAILY_FREE_LIMIT on any error.
 *
 * @param userId - The student's user ID (from session, never client-supplied).
 * @returns DAILY_PAID_LIMIT for active subscribers, DAILY_FREE_LIMIT otherwise.
 */
export async function getDailyLimit(userId: string): Promise<number> {
  try {
    const isPaid = await isPremiumUser(userId);
    return isPaid ? DAILY_PAID_LIMIT : DAILY_FREE_LIMIT;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('credits.getDailyLimit.failed', { userId, error: message });
    return DAILY_FREE_LIMIT;
  }
}

/**
 * Returns true when a user has reached their daily AI interaction limit.
 * Returns false on any failure -- never blocks the request.
 *
 * @param userId - The student's user ID (from session, never client-supplied).
 * @returns True only when usage is confirmed at or above the user's limit.
 */
export async function isAtLimit(userId: string): Promise<boolean> {
  try {
    const [used, limit] = await Promise.all([getDailyUsage(userId), getDailyLimit(userId)]);
    return used >= limit;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('credits.isAtLimit.failed', { userId, error: message });
    return false;
  }
}
