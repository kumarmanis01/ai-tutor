import { getRedis } from '@/lib/redis'

// Redis keys:
//   cb:llm:failures  → integer count, TTL 30s (auto-expires, resets failure window)
//   cb:llm:open      → '1' when circuit is open, TTL 60s (auto-closes after 60s)
const KEYS = {
  failures: 'cb:llm:failures',
  open: 'cb:llm:open',
} as const

const FAILURE_WINDOW_TTL = 30 // seconds -- sliding failure window
const OPEN_TTL = 60           // seconds -- auto-closes after this
const FAILURE_THRESHOLD = 3

/** Returns true if cb:llm:open key exists in Redis. Never throws. */
export async function isCircuitOpen(): Promise<boolean> {
  try {
    const redis = getRedis()
    if (!redis) return false
    const val = await redis.get(KEYS.open)
    return val === '1'
  } catch {
    return false
  }
}

/**
 * INCR cb:llm:failures with 30s TTL.
 * If count >= 3: SET cb:llm:open '1' EX 60.
 * Never throws.
 */
export async function recordFailure(): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const count = await redis.incr(KEYS.failures)
    if (count === 1) {
      // Set expiry on first increment to start the sliding window
      await redis.expire(KEYS.failures, FAILURE_WINDOW_TTL)
    }
    if (count >= FAILURE_THRESHOLD) {
      await redis.set(KEYS.open, '1', 'EX', OPEN_TTL)
    }
  } catch {
    // silent no-op
  }
}

/**
 * DEL cb:llm:failures, DEL cb:llm:open.
 * Never throws.
 */
export async function recordSuccess(): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.del(KEYS.failures, KEYS.open)
  } catch {
    // silent no-op
  }
}

export const _circuitBreakerInternals = { KEYS, FAILURE_THRESHOLD, OPEN_TTL, FAILURE_WINDOW_TTL }
