/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Tests for per-parent inactivityThresholdDays (F-PAR-021 AC-01).
 *
 * Verifies that runInactivityAlerts() uses each parent's ParentProfile.inactivityThresholdDays
 * rather than the global env-var default, and falls back to 3 days when the field is absent.
 */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/redis', () => ({ getRedis: () => mockRedis }));
jest.mock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: jest.fn().mockResolvedValue({ sent: true }) }));
jest.mock('@/lib/parent/signedLink', () => ({ generateMuteToken: jest.fn().mockReturnValue('token123') }));
jest.mock('@/lib/engagement/timezone', () => ({
  getLocalDateString: jest.fn((_d: Date, _tz: any) => _d.toISOString().slice(0, 10)),
  startOfLocalDayUtc: jest.fn((_s: string, _tz: any) => new Date()),
}));
jest.mock('@/lib/i18n', () => ({ t: jest.fn((_key: string, _ctx: any) => 'test message') }));
jest.mock('@/lib/notifications/policy', () => ({ canSendNotification: jest.fn().mockResolvedValue({ allowed: true }) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery';
import { getLocalDateString } from '@/lib/engagement/timezone';

const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
};

function makeStudent(lastSessionDate: string | null) {
  return { id: 'stu-1', name: 'Priya', timezone: 'Asia/Kolkata', lastSessionDate: lastSessionDate ? new Date(lastSessionDate) : null };
}

function makeLink(thresholdDays: number | null) {
  return {
    id: 'link-1',
    isPaused: false,
    excludeFromParentReport: false,
    inactivityOptOut: false,
    parent: {
      id: 'par-1',
      email: 'parent@example.test',
      phone: null,
      name: 'Parent',
      language: 'en',
      parentProfile: {
        digestOptOut: false,
        inactivityOptOut: false,
        inactivityThresholdDays: thresholdDays,
      },
    },
  };
}

describe('inactivityAlert per-parent threshold (F-PAR-021 AC-01)', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    // Make date calculations deterministic: freeze system time to 2026-04-14
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    // Default: getLocalDateString returns deterministic values
    (getLocalDateString as jest.Mock).mockImplementation((d: Date) => d.toISOString().slice(0, 10));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should send alert when student inactive beyond parent threshold of 5 days', async () => {
    const lastSession = '2026-04-08'; // 6 days ago
    prismaMock.user.findMany.mockResolvedValue([makeStudent(lastSession)]);
    prismaMock.parentStudent.findMany.mockResolvedValue([makeLink(5)] as any);
    prismaMock.learningPlanItem.findFirst.mockResolvedValue(null);

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    await runInactivityAlerts();

    expect(sendParentMilestoneNotification).toHaveBeenCalled();
  });

  it('should NOT send alert when student inactive for 4 days but parent threshold is 5 days', async () => {
    const lastSession = '2026-04-10'; // 4 days ago
    prismaMock.user.findMany.mockResolvedValue([makeStudent(lastSession)]);
    prismaMock.parentStudent.findMany.mockResolvedValue([makeLink(5)] as any);
    prismaMock.learningPlanItem.findFirst.mockResolvedValue(null);

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    await runInactivityAlerts();

    expect(sendParentMilestoneNotification).not.toHaveBeenCalled();
  });

  it('should fall back to DEFAULT_INACTIVITY_DAYS (3) when inactivityThresholdDays is null', async () => {
    const lastSession = '2026-04-10'; // 4 days ago -- beyond default 3, but we pass null threshold
    prismaMock.user.findMany.mockResolvedValue([makeStudent(lastSession)]);
    prismaMock.parentStudent.findMany.mockResolvedValue([makeLink(null)] as any);
    prismaMock.learningPlanItem.findFirst.mockResolvedValue(null);

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    await runInactivityAlerts();

    // 4 days > 3-day default => alert should fire
    expect(sendParentMilestoneNotification).toHaveBeenCalled();
  });

  it('should respect parent threshold of 7 days and skip alert at 6 days inactive', async () => {
    const lastSession = '2026-04-08'; // 6 days ago
    prismaMock.user.findMany.mockResolvedValue([makeStudent(lastSession)]);
    prismaMock.parentStudent.findMany.mockResolvedValue([makeLink(7)] as any);
    prismaMock.learningPlanItem.findFirst.mockResolvedValue(null);

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert');
    await runInactivityAlerts();

    expect(sendParentMilestoneNotification).not.toHaveBeenCalled();
  });
});
