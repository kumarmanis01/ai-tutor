/**
 * FILE OBJECTIVE:
 * - Unit tests for invalidateDashboardCache: asserts it deletes the correct
 *   dash:v1:<userId> Redis key and is a no-op on empty userId.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/dashboardCache.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation.
 */

jest.mock('@/lib/cache', () => ({
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

import { cacheDel } from '@/lib/cache';
import {
  DASHBOARD_CACHE_KEY,
  invalidateDashboardCache,
} from '@/lib/student/dashboardCache';

const cacheDelMock = cacheDel as jest.Mock;

describe('invalidateDashboardCache', () => {
  beforeEach(() => {
    cacheDelMock.mockClear();
  });

  test('builds the dash:v1:<userId> key', () => {
    expect(DASHBOARD_CACHE_KEY('user-42')).toBe('dash:v1:user-42');
  });

  test('calls cacheDel with the dash:v1:<userId> key', async () => {
    await invalidateDashboardCache('user-42');
    expect(cacheDelMock).toHaveBeenCalledTimes(1);
    expect(cacheDelMock).toHaveBeenCalledWith('dash:v1:user-42');
  });

  test('is a no-op when userId is empty', async () => {
    await invalidateDashboardCache('');
    expect(cacheDelMock).not.toHaveBeenCalled();
  });
});
