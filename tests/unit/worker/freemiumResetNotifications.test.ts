/**
 * FILE OBJECTIVE:
 * - Unit tests for `worker/jobs/freemiumResetNotifications.ts`.
 * - Verify skip behavior when not 3 days before reset and push sending when it is.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/freemiumResetNotifications.test.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | created
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('sendFreemiumResetNotifications', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('skips when daysUntilFreeTierReset !== 3', async () => {
    jest.doMock('@/lib/freemium', () => ({
      daysUntilFreeTierReset: jest.fn(() => 7),
      getStudentsNearingReset: jest.fn(async () => []),
    }));

    const sendMock = jest.fn();
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: sendMock }));
    jest.doMock('@/lib/push/notifications', () => ({
      PUSH_NOTIFICATIONS: { free_tier_reset_soon: jest.fn(() => ({ title: 't', body: 'b' })) },
    }));

    const { sendFreemiumResetNotifications } =
      await import('../../../worker/jobs/freemiumResetNotifications');

    const result = await sendFreemiumResetNotifications();

    expect(result.skipped).toBe(true);
    expect(result.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends push for eligible students when daysUntilFreeTierReset === 3', async () => {
    const ids = ['s1', 's2'];
    jest.doMock('@/lib/freemium', () => ({
      daysUntilFreeTierReset: jest.fn(() => 3),
      getStudentsNearingReset: jest.fn(async () => ids),
    }));

    const sendMock = jest.fn(async () => {});
    jest.doMock('@/lib/push/send', () => ({ sendPushSafe: sendMock }));
    jest.doMock('@/lib/push/notifications', () => ({
      PUSH_NOTIFICATIONS: { free_tier_reset_soon: jest.fn(() => ({ title: 't', body: 'b' })) },
    }));

    const { sendFreemiumResetNotifications } =
      await import('../../../worker/jobs/freemiumResetNotifications');

    const result = await sendFreemiumResetNotifications();

    expect(result.skipped).toBe(false);
    expect(result.eligible).toBe(ids.length);
    expect(result.sent).toBe(ids.length);
    expect(sendMock).toHaveBeenCalledTimes(ids.length);
  });
});
