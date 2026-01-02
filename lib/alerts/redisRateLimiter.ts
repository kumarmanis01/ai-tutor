import type { RateLimiter } from './types';
import Redis from 'ioredis';

/**
 * Redis-backed fixed-window rate limiter.
 * - Uses INCR + EXPIRE to implement a fixed-window counter per key.
 * - Not as precise as a token-bucket, but is simple, horizontally safe and predictable.
 */
export class RedisRateLimiter implements RateLimiter {
  private client: Redis;

  /**
   * @param client Optional ioredis client. If omitted, a lazy client is created from `REDIS_URL`.
   * @param capacity Max events allowed per window.
   * @param windowSeconds Window length in seconds.
   */
  constructor(private opts?: { client?: Redis; capacity?: number; windowSeconds?: number }) {
    this.client = opts?.client ?? (process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis());
    if (this.client && typeof this.client.on === 'function') {
      // swallow network errors when Redis is not available in dev/dry-run
      this.client.on('error', () => { });
    }
    this.capacity = opts?.capacity ?? 5;
    this.windowSeconds = opts?.windowSeconds ?? 60;
  }

  capacity: number;
  windowSeconds: number;

  async allow(key: string): Promise<boolean> {
    // Use a namespace to avoid collisions
    const rkey = `alerter:rl:${key}`;
    const val = await this.client.incr(rkey);
    if (val === 1) {
      await this.client.expire(rkey, this.windowSeconds);
    }
    return val <= this.capacity;
  }

  // Close the underlying redis client if we created one
  async disconnect(): Promise<void> {
    try {
      if (this.client && typeof this.client.disconnect === 'function') {
        this.client.disconnect();
      } else if (this.client && typeof this.client.quit === 'function') {
        await this.client.quit();
      }
    } catch {

      // swallow
    }
  }
}

export default RedisRateLimiter;
