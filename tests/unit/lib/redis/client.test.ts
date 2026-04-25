/**
 * FILE OBJECTIVE:
 * - Unit tests for `lib/redis/client.ts` ensuring lazy init, reuse, and graceful disconnect.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/redis/client.test.ts
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | added tests for Redis client wrapper
 */

jest.mock('ioredis', () => {
  return class MockRedis {
    public on = jest.fn();
    public once = jest.fn();
    public quit = jest.fn().mockResolvedValue(undefined);
    public disconnect = jest.fn();
    constructor(..._args: any[]) {}
  };
});

import { getRedis, disconnectRedis } from '@/lib/redis/client';

describe('lib/redis/client', () => {
  beforeEach(() => {
    // ensure module cache reset so tests get a fresh client
    jest.resetModules();
  });

  it('returns same instance on multiple getRedis() calls', () => {
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
  });

  it('disconnectRedis allows new instance after quit', async () => {
    const first = getRedis();
    await disconnectRedis();
    const second = getRedis();
    expect(second).not.toBe(first);
  });
});
