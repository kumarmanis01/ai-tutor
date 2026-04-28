/**
 * FILE OBJECTIVE:
 * - Integration-style test for worker/jobs/inactivityAlert to exercise the
 *   Prisma + Redis + notification delivery interaction. Uses lightweight
 *   in-memory mocks to emulate Redis and capture DB writes.
 *
 * LINKED UNIT TEST:
 * - n/a (integration)
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | created
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('worker/jobs/inactivityAlert (integration-ish)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('sends inactivity alert and persists audit record', async () => {
    // Simple in-memory redis mock
    const store = new Map<string, any>();
    const redisMock: any = {
      get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      set: jest.fn((k: string, v: any, ...rest: any[]) => {
        // emulate set with NX/XX/EX variants by checking args
        const nx = rest.includes('NX');
        const xx = rest.includes('XX');
        if (nx && store.has(k)) return Promise.resolve(null);
        store.set(k, v);
        return Promise.resolve('OK');
      }),
      del: jest.fn((k: string) => Promise.resolve(store.delete(k) ? 1 : 0)),
      incr: jest.fn((k: string) => {
        const v = Number(store.get(k) ?? 0) + 1;
        store.set(k, v);
        return Promise.resolve(v);
      }),
      expire: jest.fn(() => Promise.resolve(1)),
    };

    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));

    // Mock mailer so send attempt succeeds
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(true) }));
    jest.doMock('@/lib/sms', () => ({ sendSms: jest.fn().mockResolvedValue(true) }));

    // Capture prisma calls
    const parentNotificationCreates: any[] = [];

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              {
                id: 's1',
                name: 'Riya',
                timezone: 'Asia/Kolkata',
                lastSessionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              },
            ]),
        },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'link-1',
              studentId: 's1',
              excludeFromParentReport: false,
              isPaused: false,
              inactivityOptOut: false,
              parent: {
                id: 'p1',
                email: 'parent@example.test',
                phone: null,
                name: 'Parent',
                parentProfile: { inactivityOptOut: false },
                language: 'en',
              },
            },
          ]),
        },
        learningPlanItem: { findFirst: jest.fn().mockResolvedValue(null) },
        parentNotification: {
          create: jest.fn((args: any) => {
            parentNotificationCreates.push(args);
            return Promise.resolve({ id: 'pn1', ...args.data });
          }),
        },
      },
    }));

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert');
    const sent = await runInactivityAlerts();

    expect(sent).toBeGreaterThanOrEqual(1);
    expect(parentNotificationCreates.length).toBeGreaterThanOrEqual(1);
  });
});
