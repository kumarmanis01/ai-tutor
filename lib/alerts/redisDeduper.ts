import type { Deduper } from './types';
import Redis from 'ioredis';

/**
 * Redis-backed deduper using SET NX + EX semantics.
 * - `isDuplicate` checks existence.
 * - `touch` sets the key with TTL.
 */
export class RedisDeduper implements Deduper {
  private client: Redis;
  constructor(private opts?: { client?: Redis; ttlSeconds?: number }) {
    this.client = opts?.client ?? (process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis());
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
