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
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();
    expect(sent).toBe(0);
  });

  it('skips sending when parent has digestOptOut', async () => {
    const redisMock = { get: jest.fn().mockResolvedValue(null), setex: jest.fn().mockResolvedValue('OK') };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's1', name: 'Arjun' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's1',
              excludeFromParentReport: false,
              isPaused: false,
              parent: { id: 'p1', email: 'p@example.test', phone: null, name: 'Parent', parentProfile: { digestOptOut: true } },
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

  it('skips when suppression key exists', async () => {
    const redisMock = { get: jest.fn().mockResolvedValue('1'), setex: jest.fn().mockResolvedValue('OK') };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's2', name: 'Riya' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 's2',
              excludeFromParentReport: false,
              isPaused: false,
              parent: { id: 'p2', email: 'p2@example.test', phone: null, name: 'Parent2', parentProfile: { digestOptOut: false } },
            },
          ]),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sendMock).not.toHaveBeenCalled();
    expect(redisMock.get).toHaveBeenCalled();
    expect(sent).toBe(0);
  });
});
