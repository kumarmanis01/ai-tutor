import { Deduper } from './types';

/**
 * In-memory deduper using a TTL map. For production use Redis SET with EXPIRE.
 */
export class InMemoryDeduper implements Deduper {
  private seen = new Map<string, number>();
  constructor(private ttlSeconds = 60 * 60) {}

  private prune() {
    const now = Date.now() / 1000;
    for (const [k, ts] of this.seen.entries()) {
      if (ts < now) this.seen.delete(k);
    }
  }

  async isDuplicate(key: string): Promise<boolean> {
    this.prune();
    return this.seen.has(key);
  }

  async touch(key: string): Promise<void> {
    const expiresAt = Date.now() / 1000 + this.ttlSeconds;
    this.seen.set(key, expiresAt);
  }
}
