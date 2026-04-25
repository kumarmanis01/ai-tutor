/**
 * Integration test for runInactivityAlerts using a real Redis instance.
 * This test is placed under tests/integration and is excluded from CI by
 * default Jest config; run locally when Redis is available.
 */

import Redis from 'ioredis';

describe('runInactivityAlerts (integration with Redis)', () => {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  let redis: Redis.Redis;

  beforeAll(async () => {
    redis = new Redis(redisUrl);
    // ensure connection
    await redis.ping();
  });

  afterAll(async () => {
    if (redis) {
      try {
        await redis.quit();
      } catch {
        try {
          redis.disconnect();
        } catch {}
      }
    }
  });

  it('sets suppression key, prevents double-send, and updateStreak clears it', async () => {
    // Skip if Redis is not reachable
    try {
      await redis.ping();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Skipping integration test: Redis not reachable at', redisUrl);
      return;
    }

    jest.resetModules();

    const parentId = 'parent-int-1';
    const studentId = 'student-int-1';
    const key = `parent:notifications:suppression:inactivity:${parentId}:${studentId}`;

    // Mock prisma to return one student and one parent link
    const prismaMock = {
      user: {
        findMany: jest.fn(async () => [
          {
            id: studentId,
            name: 'Ivy',
            timezone: 'UTC',
            lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ]),
        findUnique: jest.fn(async () => ({
          lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          currentStreak: 2,
          longestStreak: 5,
          timezone: 'UTC',
        })),
        update: jest.fn(async (args: any) => args),
      },
      parentStudent: {
        findMany: jest.fn(async (args: any) => {
          if (args && args.select) return [{ parentId }];
          return [
            {
              parent: {
                id: parentId,
                email: 'p@ex.com',
                phone: null,
                name: 'P',
                parentProfile: { digestOptOut: false, inactivityOptOut: false },
              },
            },
          ];
        }),
      },
      learningPlanItem: { findFirst: jest.fn(async () => ({ id: 'lp-1' })) },
      parentNotification: { create: jest.fn(async () => ({})) },
    };

    // Provide our real Redis client to the module
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redis }));
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

    const sendMock = jest.fn(async (parentId: string, opts: any) => {
      // Simulate side-effect of recordSendNotification by setting the suppression key
      const key = `parent:notifications:suppression:inactivity:${parentId}:${opts?.meta?.studentId}`;
      const ttlSeconds =
        Number(process.env.PARENT_INACTIVITY_SUPPRESSION_DAYS ?? '3') * 24 * 60 * 60;
      try {
        await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      } catch (e) {
        // best-effort in test
      }
      return { sent: true };
    });
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    // clean key
    await redis.del(key);

    const sent1 = await runInactivityAlerts();
    expect(sendMock).toHaveBeenCalledTimes(1);
    // key should be present after first run
    const v = await redis.get(key);
    expect(v).toBeTruthy();

    // second run should not send again
    const sent2 = await runInactivityAlerts();
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Now call updateStreak to clear suppression keys
    const { updateStreak } = await import('@/lib/student/streak');
    await updateStreak(studentId);
    const vAfter = await redis.get(key);
    expect(vAfter).toBeNull();
  });
});
