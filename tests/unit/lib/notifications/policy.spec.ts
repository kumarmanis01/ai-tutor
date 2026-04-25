/**
 * FILE OBJECTIVE:
 * - Unit tests for notification policy suppression lifecycle (recordSendNotification
 *   and canSendNotification) using an in-memory fake Redis client.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/policy.spec.ts
 */

import { jest } from '@jest/globals';

describe('notification policy suppression lifecycle', () => {
  let map: Map<string, string>;
  const fakeRedis = {
    async get(k: string) {
      return map.get(k) ?? null;
    },
    async set(k: string, v: string, ...args: any[]) {
      // emulate SET ... NX EX semantics: if 'NX' present and key exists, return null
      const nx = args.includes('NX');
      if (nx && map.has(k)) return null;
      map.set(k, v);
      return 'OK';
    },
    async ttl(k: string) {
      return map.has(k) ? -1 : -2;
    },
    async expire(k: string) {
      return map.has(k) ? 1 : 0;
    },
  };

  beforeEach(() => {
    map = new Map();
    jest.resetModules();
    jest.doMock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));
  });

  it('records suppression and then prevents sending', async () => {
    const { canSendNotification, recordSendNotification } =
      await import('@/lib/notifications/policy');
    const parentId = 'p1';
    const studentId = 's1';

    // initially allowed
    const before = await canSendNotification(parentId, 'inactivity', studentId);
    expect(before.allowed).toBe(true);

    await recordSendNotification(parentId, 'inactivity', studentId);

    // after recording, should be suppressed
    const after = await canSendNotification(parentId, 'inactivity', studentId);
    expect(after.allowed).toBe(false);
  });
});
