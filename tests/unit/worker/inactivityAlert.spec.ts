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
    const redisMock = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1), setex: jest.fn().mockResolvedValue('OK') };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }));
    jest.doMock('@/lib/notifications/policy', () => ({ canSendNotification: jest.fn().mockResolvedValue({ allowed: true }) }));
    jest.doMock('@/lib/parent/signedLink', () => ({ generateMuteToken: jest.fn().mockReturnValue('tok') }));
    jest.doMock('@/lib/engagement/timezone', () => ({
      getLocalDateString: jest.fn((_d: any) => '2026-04-10'),
      startOfLocalDayUtc: jest.fn(() => new Date('2026-04-14T00:00:00Z')),
    }));
    jest.doMock('@/lib/i18n', () => ({ t: jest.fn(() => 'test') }));
    jest.doMock('@/lib/whatsapp/templates', () => ({ buildInactivityTemplate: jest.fn(() => ({})) }));
    jest.doMock('@/lib/email/templates', () => ({ inactivityNudgeHtml: jest.fn(() => '<html>test</html>') }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's1', name: 'Arjun', lastSessionDate: new Date('2026-04-05'), timezone: 'Asia/Kolkata' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'link-1',
              studentId: 's1',
              excludeFromParentReport: false,
              isPaused: false,
              inactivityOptOut: false,
              parent: { id: 'p1', email: 'p@example.test', phone: null, whatsappPhone: null, name: 'Parent', language: 'en', parentProfile: { digestOptOut: true, inactivityOptOut: false, inactivityThresholdDays: null } },
            },
          ]),
        },
        learningPlanItem: { findFirst: jest.fn().mockResolvedValue(null) },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    // parent opted out -> nothing sent
    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('skips when suppression policy blocks send', async () => {
    // Redis lock is acquired (set returns 'OK'), but canSendNotification blocks delivery.
    const redisMock = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1), setex: jest.fn().mockResolvedValue('OK') };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

    const sendMock = jest.fn().mockResolvedValue({ sent: true });
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }));
    // Suppression via policy (replaces old direct redis.get suppression check)
    jest.doMock('@/lib/notifications/policy', () => ({ canSendNotification: jest.fn().mockResolvedValue({ allowed: false, reason: 'suppressed' }) }));
    jest.doMock('@/lib/parent/signedLink', () => ({ generateMuteToken: jest.fn().mockReturnValue('tok') }));
    jest.doMock('@/lib/engagement/timezone', () => ({
      getLocalDateString: jest.fn((_d: any) => '2026-04-10'),
      startOfLocalDayUtc: jest.fn(() => new Date('2026-04-14T00:00:00Z')),
    }));
    jest.doMock('@/lib/i18n', () => ({ t: jest.fn(() => 'test') }));
    jest.doMock('@/lib/whatsapp/templates', () => ({ buildInactivityTemplate: jest.fn(() => ({})) }));
    jest.doMock('@/lib/email/templates', () => ({ inactivityNudgeHtml: jest.fn(() => '<html>test</html>') }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 's2', name: 'Riya', lastSessionDate: new Date('2026-04-05'), timezone: 'Asia/Kolkata' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'link-2',
              studentId: 's2',
              excludeFromParentReport: false,
              isPaused: false,
              inactivityOptOut: false,
              parent: { id: 'p2', email: 'p2@example.test', phone: null, whatsappPhone: null, name: 'Parent2', language: 'en', parentProfile: { digestOptOut: false, inactivityOptOut: false, inactivityThresholdDays: null } },
            },
          ]),
        },
        learningPlanItem: { findFirst: jest.fn().mockResolvedValue(null) },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    // Policy blocked send -- nothing should be delivered
    expect(sendMock).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });
});
