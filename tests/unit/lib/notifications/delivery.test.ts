/**
 * FILE OBJECTIVE:
 * - Unit tests for `sendParentMilestoneNotification` to validate per-parent
 *   opt-outs, per-child exclusions, channel selection, and Redis fallback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications/delivery.test.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('sendParentMilestoneNotification', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('respects parent digest opt-out', async () => {
    const prismaMock: any = {
      parentProfile: { findUnique: jest.fn(async () => ({ digestOptOut: true })) },
      parentStudent: { findFirst: jest.fn(async () => null) },
      parentNotification: { create: jest.fn(async () => ({})) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({}) }));
    const mailMock = jest.fn();
    const smsMock = jest.fn();
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: mailMock }));
    jest.doMock('@/lib/sms', () => ({ sendSms: smsMock }));

    const { sendParentMilestoneNotification } = await import('@/lib/notifications/delivery');

    const res = await sendParentMilestoneNotification('p1', {
      email: 'p@example.test',
      subject: 'Digest',
      html: '<p/>',
      meta: { type: 'digest' },
    });
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('parent_digest_opt_out');
    expect(mailMock).not.toHaveBeenCalled();
  });

  it('respects child inactivity opt-out', async () => {
    const prismaMock: any = {
      parentProfile: { findUnique: jest.fn(async () => ({ inactivityOptOut: false })) },
      parentStudent: { findFirst: jest.fn(async () => ({ inactivityOptOut: true })) },
      parentNotification: { create: jest.fn(async () => ({})) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({}) }));
    const mailMock = jest.fn();
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: mailMock }));

    const { sendParentMilestoneNotification } = await import('@/lib/notifications/delivery');

    const res = await sendParentMilestoneNotification('p1', {
      email: 'p@example.test',
      subject: 'Alert',
      html: '<p/>',
      meta: { type: 'inactivity', studentId: 's1' },
    });
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('child_inactivity_opt_out');
    expect(mailMock).not.toHaveBeenCalled();
  });

  it('honors meta.channel override and sends only via sms', async () => {
    const prismaMock: any = {
      parentProfile: { findUnique: jest.fn(async () => ({ inactivityOptOut: false })) },
      parentStudent: { findFirst: jest.fn(async () => ({ inactivityOptOut: false })) },
      parentNotification: { create: jest.fn(async () => ({})) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    // provide a redis client so normal path is followed
    jest.doMock('@/lib/redis', () => ({
      getRedis: () => ({ get: jest.fn(), incr: jest.fn(), expire: jest.fn(), set: jest.fn() }),
    }));
    const mailMock = jest.fn();
    const smsMock = jest.fn();
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: mailMock }));
    jest.doMock('@/lib/sms', () => ({ sendSms: smsMock }));
    const metrics = { incNotificationSent: jest.fn(), incNotificationFailed: jest.fn() };
    jest.doMock('@/lib/metrics', () => metrics);

    const { sendParentMilestoneNotification } = await import('@/lib/notifications/delivery');

    const res = await sendParentMilestoneNotification('p1', {
      email: 'p@example.test',
      phone: '+911234',
      subject: 'Chapter',
      html: '<p/>',
      meta: { type: 'milestone', channel: 'sms' },
    });
    expect(res.sent).toBe(true);
    // sms should be called, mail should not
    const sms = (await import('@/lib/sms')).sendSms;
    const mail = (await import('@/lib/mailer')).sendMailSafe;
    expect(sms).toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();
  });

  it('uses Redis fallback path when redis missing and still audits', async () => {
    const createdSpy = jest.fn(async () => ({}));
    const prismaMock: any = {
      parentProfile: { findUnique: jest.fn(async () => ({})) },
      parentStudent: { findFirst: jest.fn(async () => null) },
      parentNotification: { create: createdSpy },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    // Simulate no redis available
    jest.doMock('@/lib/redis', () => ({ getRedis: () => null }));
    const mailMock = jest.fn(async () => undefined);
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: mailMock }));

    const { sendParentMilestoneNotification } = await import('@/lib/notifications/delivery');

    const res = await sendParentMilestoneNotification('p1', {
      email: 'p@example.test',
      subject: 'Fallback',
      html: '<p/>',
      meta: { type: 'milestone' },
    });
    expect(res.sent).toBe(true);
    expect(mailMock).toHaveBeenCalled();
    expect(createdSpy).toHaveBeenCalled();
  });
});
