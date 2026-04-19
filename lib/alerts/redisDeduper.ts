/**
 * FILE OBJECTIVE:
 * - Use the shared Redis client for deduplication helpers to avoid creating
 *   per-instance Redis connections that can exhaust the server's `maxclients` limit.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/alerts/redisDeduper.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T16:57:05Z | copilot | switch to shared Redis client and avoid disconnecting shared instance
 */

import type { Deduper } from './types';
import Redis from 'ioredis';
import { getRedis } from '@/lib/redis'

/**
 * Redis-backed deduper using SET NX + EX semantics.
 * - `isDuplicate` checks existence.
 * - `touch` sets the key with TTL.
 */
export class RedisDeduper implements Deduper {
  private client: Redis;
  private _ownsClient = false;
  constructor(private opts?: { client?: Redis; ttlSeconds?: number }) {
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
    this.ttlSeconds = opts?.ttlSeconds ?? 60 * 10;
  }

  ttlSeconds: number;

  async isDuplicate(key: string): Promise<boolean> {
    const rkey = `alerter:dedupe:${key}`;
    const exists = await this.client.exists(rkey);
    return exists === 1;
  }

  async touch(key: string): Promise<void> {
    const rkey = `alerter:dedupe:${key}`;
    // set with TTL (overwrite existing TTL)
    await this.client.set(rkey, '1', 'EX', this.ttlSeconds);
  }

  async disconnect(): Promise<void> {
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

export default RedisDeduper;
