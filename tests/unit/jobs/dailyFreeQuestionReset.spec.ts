/**
 * FILE OBJECTIVE:
 * - Unit tests for the daily free question reset job.
 * - Verifies lock handling, reset behavior, and error/audit paths.
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/dailyFreeQuestionReset.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | created tests for daily free question reset job
 * - 2026-05-07T00:00:00Z | copilot | add schedule tests for midnight UTC and daily cadence
 * - 2026-05-07T00:00:00Z | copilot | add minute-based schedule configuration coverage
 * - 2026-05-07T00:00:00Z | copilot | update default schedule test for UTC+5 midnight equivalent
 */

import { DAILY_FREE_QUESTION_LIMIT } from '@/lib/constants/freeTier';
import { runDailyFreeQuestionReset, scheduleDailyFreeQuestionReset } from '@/jobs/dailyFreeQuestionReset';
import { acquireJobLock, releaseJobLock } from '@/jobs/jobLock';
import logAuditEvent from '@/lib/audit/log';
import { prisma } from '@/lib/prisma';

jest.mock('@/jobs/jobLock', () => ({
  acquireJobLock: jest.fn(),
  releaseJobLock: jest.fn(),
}));

jest.mock('@/lib/audit/log', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('runDailyFreeQuestionReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets non-premium users to the daily free question limit', async () => {
    (acquireJobLock as jest.Mock).mockResolvedValue({ acquired: true });
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 17 });

    const result = await runDailyFreeQuestionReset();

    expect(result.success).toBe(true);
    expect(result.usersUpdated).toBe(17);
    expect(typeof result.durationMs).toBe('number');

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        subscriptions: {
          none: {
            active: true,
            plan: { not: 'free' },
            startDate: { lte: expect.any(Date) },
            endDate: { gte: expect.any(Date) },
          },
        },
        todaysFreeQuestionsCount: {
          lt: DAILY_FREE_QUESTION_LIMIT,
        },
      },
      data: {
        todaysFreeQuestionsCount: DAILY_FREE_QUESTION_LIMIT,
      },
    });

    expect(logAuditEvent).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        details: expect.objectContaining({
          legacyAction: 'DAILY_FREE_RESET_RUN',
          status: 'SUCCESS',
          usersUpdated: 17,
        }),
      })
    );

    expect(releaseJobLock).toHaveBeenCalledWith('daily_free_question_reset');
  });

  it('skips when another reset run already holds the job lock', async () => {
    (acquireJobLock as jest.Mock).mockResolvedValue({ skipped: true, reason: 'locked' });

    const result = await runDailyFreeQuestionReset();

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('locked');
    expect(result.error).toContain('locked');

    expect(prisma.user.updateMany).not.toHaveBeenCalled();

    expect(logAuditEvent).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        details: expect.objectContaining({
          legacyAction: 'DAILY_FREE_RESET_RUN',
          status: 'SKIPPED',
          reason: 'locked',
        }),
      })
    );

    expect(releaseJobLock).not.toHaveBeenCalled();
  });

  it('returns failure and releases lock when update fails', async () => {
    (acquireJobLock as jest.Mock).mockResolvedValue({ acquired: true });
    (prisma.user.updateMany as jest.Mock).mockRejectedValue(new Error('database unavailable'));

    const result = await runDailyFreeQuestionReset();

    expect(result.success).toBe(false);
    expect(result.error).toContain('database unavailable');

    expect(logAuditEvent).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        details: expect.objectContaining({
          legacyAction: 'DAILY_FREE_RESET_RUN',
          status: 'FAILED',
          error: expect.stringContaining('database unavailable'),
        }),
      })
    );

    expect(releaseJobLock).toHaveBeenCalledWith('daily_free_question_reset');
  });
});

describe('scheduleDailyFreeQuestionReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    delete process.env.FREE_QUESTION_RESET_HOUR;
    delete process.env.FREE_QUESTION_RESET_MINUTE;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('schedules first run at default UTC+5 midnight equivalent and repeats every 24h', () => {
    jest.setSystemTime(new Date('2026-05-07T18:50:00.000Z'));

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    scheduleDailyFreeQuestionReset();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10 * 60 * 1000);

    const callback = setTimeoutSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(callback).toBeDefined();
    callback?.();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 24 * 60 * 60 * 1000);
  });

  it('uses FREE_QUESTION_RESET_HOUR when configured', () => {
    process.env.FREE_QUESTION_RESET_HOUR = '5';
    jest.setSystemTime(new Date('2026-05-07T04:30:00.000Z'));

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    scheduleDailyFreeQuestionReset();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
  });

  it('uses FREE_QUESTION_RESET_MINUTE for exact UTC scheduling', () => {
    process.env.FREE_QUESTION_RESET_HOUR = '18';
    process.env.FREE_QUESTION_RESET_MINUTE = '30';
    jest.setSystemTime(new Date('2026-05-07T18:20:00.000Z'));

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    scheduleDailyFreeQuestionReset();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10 * 60 * 1000);
  });
});
