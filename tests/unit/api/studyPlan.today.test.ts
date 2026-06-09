/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/study-plan/today: auth guard, cache hit,
 *   and live-computation fallback.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetServerSession = jest.fn();
jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: () => mockGetServerSession(),
}));

const mockGetCachedDailyPlan = jest.fn();
const mockComputeDailyPlan = jest.fn();
const mockCacheDailyPlan = jest.fn();
jest.mock('@/lib/studyPlan/dailyPlan', () => ({
  getCachedDailyPlan: (...args: unknown[]) => mockGetCachedDailyPlan(...args),
  computeDailyPlan: (...args: unknown[]) => mockComputeDailyPlan(...args),
  cacheDailyPlan: (...args: unknown[]) => mockCacheDailyPlan(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/study-plan/today/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockSession(userId = 'user-1') {
  mockGetServerSession.mockResolvedValue({ user: { id: userId } });
}

const fakePlan = {
  topics: [
    {
      topicSlug: 'quadratic-equations',
      subject: 'Mathematics',
      grade: '10',
      board: 'cbse',
      state: 'DEVELOPING',
      score: 0.6,
      lastStudiedAt: new Date('2026-06-01T10:00:00Z'),
      suggestedDifficulty: 5,
    },
  ],
  generatedAt: new Date('2026-06-09T10:00:00Z'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/study-plan/today', () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
    mockGetCachedDailyPlan.mockReset();
    mockComputeDailyPlan.mockReset();
    mockCacheDailyPlan.mockReset();
  });

  it('should return 401 when session is missing', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('should return cached plan when Redis hit occurs', async () => {
    mockSession();
    mockGetCachedDailyPlan.mockResolvedValue(fakePlan);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.plan).toHaveLength(1);
    expect(mockComputeDailyPlan).not.toHaveBeenCalled();
  });

  it('should compute plan live on cache miss and return cached: false', async () => {
    mockSession();
    mockGetCachedDailyPlan.mockResolvedValue(null);
    mockComputeDailyPlan.mockResolvedValue(fakePlan);
    mockCacheDailyPlan.mockResolvedValue(undefined);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.plan).toHaveLength(1);
    expect(mockComputeDailyPlan).toHaveBeenCalledWith('user-1');
  });
});
