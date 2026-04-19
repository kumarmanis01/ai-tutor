/**
 * FILE OBJECTIVE:
 * - Use the shared Redis client for rate-limiting to avoid creating per-instance
 *   Redis connections that can exhaust the server's `maxclients` limit.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/alerts/redisRateLimiter.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T16:57:05Z | copilot | switch to shared Redis client and avoid disconnecting shared instance
 */

import type { RateLimiter } from './types';
import Redis from 'ioredis';
import { getRedis } from '@/lib/redis'

/**
 * Redis-backed fixed-window rate limiter.
 * - Uses INCR + EXPIRE to implement a fixed-window counter per key.
 * - Not as precise as a token-bucket, but is simple, horizontally safe and predictable.
 */
export class RedisRateLimiter implements RateLimiter {
  private client: Redis;
  private _ownsClient = false;

  /**
   * @param client Optional ioredis client. If omitted, the shared `getRedis()` client is used when available.
   * @param capacity Max events allowed per window.
   * @param windowSeconds Window length in seconds.
   */
  constructor(private opts?: { client?: Redis; capacity?: number; windowSeconds?: number }) {
    // Prefer an injected client, then the shared application client, then fall back
    // to creating a local client only when no shared client is available.
    const shared = getRedis();
    if (opts?.client) {
      this.client = opts.client;
      this._ownsClient = false;
    } else if (shared) {
      this.client = shared as unknown as Redis;
      this._ownsClient = false;
    } else {
      this.client = new Redis(process.env.REDIS_URL ? process.env.REDIS_URL : undefined);
      this._ownsClient = true;
    }

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
    // Only disconnect if this instance created its own client. Shared client
    // should not be closed by helpers.
    if (!this._ownsClient) return;
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
