/**
 * FILE OBJECTIVE:
 * - Unit tests for processDailyPlans: happy path, per-user error isolation,
 *   and pagination across multiple batches.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockComputeDailyPlan = jest.fn();
const mockCacheDailyPlan = jest.fn();
jest.mock('@/lib/studyPlan/dailyPlan', () => ({
  computeDailyPlan: (...args: unknown[]) => mockComputeDailyPlan(...args),
  cacheDailyPlan: (...args: unknown[]) => mockCacheDailyPlan(...args),
}));

const mockFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { topicProgress: { findMany: (...args: unknown[]) => mockFindMany(...args) } },
}));
jest.mock('@/lib/redis', () => ({ getSharedConnection: jest.fn(() => ({})) }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
// Queue is only used by registerDailyPlanJob -- not needed for processDailyPlans tests
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    add: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { processDailyPlans } from '@/jobs/dailyPlan';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processDailyPlans', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockComputeDailyPlan.mockReset();
    mockCacheDailyPlan.mockReset();
  });

  it('should process all users and return correct counts on happy path', async () => {
    const users = [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }];
    mockFindMany.mockResolvedValueOnce(users).mockResolvedValueOnce([]);
    mockComputeDailyPlan.mockResolvedValue({ topics: [], generatedAt: new Date() });
    mockCacheDailyPlan.mockResolvedValue(undefined);

    const { processed, failed } = await processDailyPlans();

    expect(processed).toBe(3);
    expect(failed).toBe(0);
  });

  it('should isolate per-user errors and count them as failed', async () => {
    const users = [{ userId: 'u1' }, { userId: 'u2' }];
    mockFindMany.mockResolvedValueOnce(users).mockResolvedValueOnce([]);
    mockComputeDailyPlan
      .mockResolvedValueOnce({ topics: [], generatedAt: new Date() })
      .mockRejectedValueOnce(new Error('DB timeout'));
    mockCacheDailyPlan.mockResolvedValue(undefined);

    const { processed, failed } = await processDailyPlans();

    expect(processed).toBe(1);
    expect(failed).toBe(1);
  });

  it('should paginate correctly across multiple batches', async () => {
    // Simulate two pages: first returns 100 users, second returns 0
    const batch1 = Array.from({ length: 100 }, (_, i) => ({ userId: `u${i}` }));
    mockFindMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce([]);
    mockComputeDailyPlan.mockResolvedValue({ topics: [], generatedAt: new Date() });
    mockCacheDailyPlan.mockResolvedValue(undefined);

    const { processed } = await processDailyPlans();
    expect(processed).toBe(100);
    // findMany called twice: once for first batch, once to detect end
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
