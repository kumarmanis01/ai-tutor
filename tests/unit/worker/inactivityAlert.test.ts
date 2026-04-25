/**
 * Unit tests for runInactivityAlerts - mocks Redis, Prisma and the notification sender
 */

describe('runInactivityAlerts (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('sends alert when redis.set returns OK', async () => {
    const fakeRedis = { set: jest.fn(async () => 'OK'), del: jest.fn(async () => 1) };
    const sendMock = jest.fn(async () => ({ sent: true }));

    const prismaMock = {
      user: {
        findMany: jest.fn(async () => [
          {
            id: 'student1',
            name: 'Sam',
            timezone: 'UTC',
            lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ]),
      },
      parentStudent: {
        findMany: jest.fn(async () => [
          {
            parent: {
              id: 'parent1',
              email: 'p@example.com',
              phone: null,
              name: 'Parent',
              parentProfile: { digestOptOut: false, inactivityOptOut: false },
            },
          },
        ]),
      },
      learningPlanItem: { findFirst: jest.fn(async () => ({ id: 'item1' })) },
    };

    jest.doMock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(fakeRedis.set).toHaveBeenCalled();
    expect(sent).toBe(1);
  });

  it('skips when redis.set returns null (already claimed)', async () => {
    jest.resetModules();
    const fakeRedis = { set: jest.fn(async () => null), del: jest.fn() };
    const sendMock = jest.fn();

    const prismaMock = {
      user: {
        findMany: jest.fn(async () => [
          {
            id: 'student1',
            name: 'Sam',
            timezone: 'UTC',
            lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ]),
      },
      parentStudent: {
        findMany: jest.fn(async () => [
          {
            parent: {
              id: 'parent1',
              email: 'p@example.com',
              phone: null,
              name: 'Parent',
              parentProfile: { digestOptOut: false, inactivityOptOut: false },
            },
          },
        ]),
      },
      learningPlanItem: { findFirst: jest.fn(async () => ({ id: 'item1' })) },
    };

    jest.doMock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('removes suppression key on send failure', async () => {
    jest.resetModules();
    const fakeRedis = { set: jest.fn(async () => 'OK'), del: jest.fn(async () => 1) };
    const sendMock = jest.fn(async () => {
      throw new Error('send failed');
    });

    const prismaMock = {
      user: {
        findMany: jest.fn(async () => [
          {
            id: 'student1',
            name: 'Sam',
            timezone: 'UTC',
            lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ]),
      },
      parentStudent: {
        findMany: jest.fn(async () => [
          {
            parent: {
              id: 'parent1',
              email: 'p@example.com',
              phone: null,
              name: 'Parent',
              parentProfile: { digestOptOut: false, inactivityOptOut: false },
            },
          },
        ]),
      },
      learningPlanItem: { findFirst: jest.fn(async () => ({ id: 'item1' })) },
    };

    jest.doMock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).toHaveBeenCalled();
    expect(fakeRedis.del).toHaveBeenCalled();
    expect(sent).toBe(0);
  });
});
/**
 * FILE OBJECTIVE:
 * - Unit tests for worker/jobs/inactivityAlert.ts covering opt-out, pause, suppression behaviour
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/inactivityAlert.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | created tests for inactivity alerts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('worker/jobs/inactivityAlert', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 0 when no redis configured', async () => {
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();
    expect(sent).toBe(0);
  });

  it('skips sending when parent has inactivityOptOut', async () => {
    const redisMock = {
      set: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
    };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's1', name: 'Arjun' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's1',
              excludeFromParentReport: false,
              isPaused: false,
              parent: {
                id: 'p1',
                email: 'p@example.test',
                phone: null,
                name: 'Parent',
                parentProfile: { inactivityOptOut: true },
              },
            },
          ]),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    // parent opted out -> nothing sent
    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('skips when a lock cannot be acquired (suppression or concurrent run)', async () => {
    // Simulate inability to acquire short lock (SET NX returns null)
    const redisMock = {
      set: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      get: jest.fn().mockResolvedValue(null),
    };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's2', name: 'Riya' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's2',
              excludeFromParentReport: false,
              isPaused: false,
              parent: {
                id: 'p2',
                email: 'p2@example.test',
                phone: null,
                name: 'Parent2',
                parentProfile: { inactivityOptOut: false },
              },
            },
          ]),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).not.toHaveBeenCalled();
    expect(redisMock.set).toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('skips when ParentStudent.excludeFromParentReport is true', async () => {
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's3', name: 'Nisha' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's3',
              excludeFromParentReport: true,
              isPaused: false,
              parent: {
                id: 'p3',
                email: 'p3@example.test',
                phone: null,
                name: 'Parent3',
                parentProfile: { digestOptOut: false },
              },
            },
          ]),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('skips when ParentStudent.inactivityOptOut is true (per-child)', async () => {
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's5', name: 'Ishaan' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's5',
              excludeFromParentReport: false,
              isPaused: false,
              inactivityOptOut: true,
              parent: {
                id: 'p5',
                email: 'p5@example.test',
                phone: null,
                name: 'Parent5',
                parentProfile: { digestOptOut: false },
              },
            },
          ]),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('skips when ParentStudent.isPaused with pausedUntil in future', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({
      sendParentMilestoneNotification: sendMock,
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's4', name: 'Kabir' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's4',
              excludeFromParentReport: false,
              isPaused: true,
              pausedUntil: future,
              parent: {
                id: 'p4',
                email: 'p4@example.test',
                phone: null,
                name: 'Parent4',
                parentProfile: { digestOptOut: false },
              },
            },
          ]),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });
});
