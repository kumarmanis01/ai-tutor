import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

// Remove a user's short-lived JWT session cache entry.
// Extracted here so worker processes can import it without pulling in lib/auth.ts
// (which depends on next-auth/providers/google, incompatible with the ESM worker build).
export async function invalidateUserSessionCache(email?: string | null) {
  if (!email) return;
  const redis = getRedis?.();
  if (!redis) return;
  const cacheKey = `session:user:${String(email).toLowerCase()}`;
  try {
    await redis.del(cacheKey);
    logger.add('jwt.cache.invalidate', { className: 'auth', methodName: 'invalidateUserSessionCache', cacheKey });
  } catch (err) {
    logger.warn('jwt cache invalidate failed', { className: 'auth', methodName: 'invalidateUserSessionCache', error: String(err) });
  }
}
