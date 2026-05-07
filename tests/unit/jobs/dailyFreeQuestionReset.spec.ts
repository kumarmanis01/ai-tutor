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
 */

import { DAILY_FREE_QUESTION_LIMIT } from '@/lib/constants/freeTier';
import { runDailyFreeQuestionReset } from '@/jobs/dailyFreeQuestionReset';
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
