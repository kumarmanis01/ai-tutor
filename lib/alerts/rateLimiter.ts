import { RateLimiter } from './types';

/**
 * Simple in-memory token-bucket limiter per key.
 * - capacity: tokens available
 * - refillRate: tokens per second
 *
 * For production, replace with Redis-based limiter and persistent counters.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();

  constructor(private capacity = 5, private refillRate = 0.1) {}

  async allow(key: string, points = 1): Promise<boolean> {
    const now = Date.now() / 1000;
    const b = this.buckets.get(key) ?? { tokens: this.capacity, last: now };
    const elapsed = Math.max(0, now - b.last);
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillRate);
    b.last = now;
    if (b.tokens >= points) {
      b.tokens -= points;
      this.buckets.set(key, b);
      return true;
    }
    this.buckets.set(key, b);
    return false;
  }
}
