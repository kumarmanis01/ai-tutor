/**
 * FILE OBJECTIVE:
 * - Unit tests for weekly free question reset job (freeQuestionsCount).
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/dailyFreeQuestionReset.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-30T00:00:00Z | copilot | created for weekly freeQuestionsCount reset
 */


const updateManyMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerErrorMock = jest.fn();

jest.mock('@/jobs/jobLock', () => ({
  acquireJobLock: jest.fn(async () => ({})),
  releaseJobLock: jest.fn(async () => {}),
}));
jest.mock('@/lib/audit/log', () => jest.fn());
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { updateMany: updateManyMock },
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: loggerInfoMock, error: loggerErrorMock },
}));

import { runWeeklyFreeQuestionReset } from '@/jobs/dailyFreeQuestionReset';

describe('runWeeklyFreeQuestionReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets freeQuestionsCount for eligible users', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 5 });
    const result = await runWeeklyFreeQuestionReset();
    expect(result.success).toBe(true);
    expect(result.usersUpdated).toBe(5);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Weekly free question reset completed',
      expect.objectContaining({ usersUpdated: 5 })
    );
  });

  it('handles lock skip', async () => {
    const { acquireJobLock } = require('@/jobs/jobLock');
    acquireJobLock.mockResolvedValueOnce({ skipped: true, reason: 'locked' });
    const result = await runWeeklyFreeQuestionReset();
    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('locked');
  });

  it('handles errors gracefully', async () => {
    updateManyMock.mockRejectedValueOnce(new Error('db error'));
    const result = await runWeeklyFreeQuestionReset();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/db error/);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Weekly free question reset failed',
      expect.objectContaining({ error: expect.stringMatching(/db error/) })
    );
  });
});
