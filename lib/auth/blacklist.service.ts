/**
 * FILE OBJECTIVE:
 * - JWT blacklist service. Stores revoked JTIs in Redis so that even valid
 *   tokens (not yet expired) are rejected after logout or rotation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/auth/blacklist.service.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B2.1 token blacklist service
 */

import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// ── Key helpers ────────────────────────────────────────────────────────────────

function blacklistKey(jti: string): string {
  return `blacklist:token:${jti}`
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Add a JTI to the blacklist with a TTL equal to the token's remaining lifetime.
 * Called on logout or refresh-token rotation.
 *
 * @param jti  - JWT ID from the token payload
 * @param expiresAt - UNIX epoch seconds when the token expires
 */
export async function blacklistToken(jti: string, expiresAt: number): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const ttlSeconds = Math.max(expiresAt - nowSeconds, 1)

  const redis = getRedis()
  if (!redis) {
    logger.warn('Redis unavailable -- cannot blacklist token', { jti })
    return
  }
  try {
    await redis.set(blacklistKey(jti), '1', 'EX', ttlSeconds)
    logger.info('Token blacklisted', { jti, ttlSeconds })
  } catch (err: unknown) {
    logger.error('Failed to blacklist token', { jti, error: err })
    throw err
  }
}

/**
 * Check whether a JTI is on the blacklist.
 * Returns true if the token has been revoked.
 */
export async function isBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return true // fail-safe: no Redis = treat as revoked
  try {
    const value = await redis.exists(blacklistKey(jti))
    return value === 1
  } catch (err: unknown) {
    logger.error('Failed to check token blacklist', { jti, error: err })
    // Fail-safe: treat Redis errors as revoked to prevent access with stale tokens
    return true
  }
}
