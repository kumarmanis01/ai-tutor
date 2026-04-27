/**
 * lib/cache.ts
 *
 * Thin Redis cache layer over getRedis(). All functions are no-ops when
 * Redis is unavailable -- the DB is always the source of truth.
 *
 * Usage:
 *   const hit = await cacheGet<MyType>('key')
 *   if (hit) return hit
 *   const data = await expensiveDbQuery()
 *   await cacheSet('key', data, 60) // 60-second TTL
 *
 * Key naming convention:
 *   <resource>:v<version>:<id>
 *   e.g. dash:v1:user_abc, lplan:v1:user_abc
 *
 * Version the key (v1, v2 ...) whenever the shape changes so old cached
 * values are silently ignored rather than causing type errors.
 */

import { getRedis } from './redis'

/**
 * Read a cached value. Returns null on miss or any error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Write a value with a TTL in seconds. Silent no-op on any error.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // Cache write failures must never crash callers
  }
}

/**
 * Delete a single cache key (call after a mutation that invalidates data).
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(key)
  } catch {
    // ignore
  }
}

/**
 * Delete all keys matching a glob pattern using SCAN (non-blocking).
 * Use sparingly -- only for broad invalidation (e.g. after bulk updates).
 * Example: cacheDelPattern('dash:v1:*')
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = next
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== '0')
  } catch {
    // ignore
  }
}
