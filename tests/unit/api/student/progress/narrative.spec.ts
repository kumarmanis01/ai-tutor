/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/progress/narrative.
 * - Validates the three execution paths:
 *   (a) Redis cache HIT  → return cached narrative immediately.
 *   (b) Redis cache MISS → enqueue job, return FALLBACK_NARRATIVE.
 *   (c) Redis unavailable → enqueue job (best-effort), return FALLBACK_NARRATIVE.
 * - Ensures the API contract always returns { narrative: string } (never 202/queued).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/progress/narrative.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created — Gap 1 fix coverage (PROGRESS_PAGE_GAP_AUDIT.md)
 */

const FALLBACK =
  'Keep going! Your consistent practice is building strong foundations. ' +
  'Every session adds to your knowledge -- you are making real progress.';

// ── Shared mocks ─────────────────────────────────────────────────────────────

const mockSession = { user: { id: 'user-1' } };
const mockGetServerSession = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisInstance = { get: mockRedisGet, set: mockRedisSet };
const mockGetRedis = jest.fn();
const mockPrismaSessionCount = jest.fn();
const mockPrismaUserFindUnique = jest.fn();
const mockPrismaSubjectDefFindMany = jest.fn();
const mockQueueAdd = jest.fn();
const mockGetAIRequestQueue = jest.fn(() => ({ add: mockQueueAdd }));
const mockComputeReadinessScore = jest.fn();
const mockLoggerLogAPI = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: mockGetServerSession,
}));

jest.mock('@/lib/redis', () => ({
  getRedis: mockGetRedis,
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    structuredSession: { count: mockPrismaSessionCount },
    user: { findUnique: mockPrismaUserFindUnique },
    subjectDef: { findMany: mockPrismaSubjectDefFindMany },
  },
}));

jest.mock('@/lib/student/examReadiness', () => ({
  computeReadinessScore: mockComputeReadinessScore,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: mockLoggerLogAPI,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// aiQueue is dynamically imported in the route — mock the module
jest.mock('@/queues/aiQueue', () => ({
  getAIRequestQueue: mockGetAIRequestQueue,
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function buildRequest(url = 'http://localhost/api/student/progress/narrative'): Request {
  return new Request(url);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/student/progress/narrative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrismaSessionCount.mockResolvedValue(5);
    mockPrismaUserFindUnique.mockResolvedValue({ subjects: ['Mathematics'] });
    mockPrismaSubjectDefFindMany.mockResolvedValue([{ id: 'subj-1' }]);
    mockComputeReadinessScore.mockResolvedValue({
      chapters: [
        { chapterId: 'ch-1', chapterName: 'Algebra', masteryScore: 0.9 },
        { chapterId: 'ch-2', chapterName: 'Geometry', masteryScore: 0.3 },
      ],
    });
    mockQueueAdd.mockResolvedValue({ id: 'job-123' });
  });

  // ── (a) Cache HIT ──────────────────────────────────────────────────────────
  describe('when Redis cache is warm', () => {
    beforeEach(() => {
      mockGetRedis.mockReturnValue(mockRedisInstance);
      mockRedisGet.mockResolvedValue('You improved 18% in Algebra this month!');
    });

    it('returns the cached narrative immediately', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.narrative).toBe('You improved 18% in Algebra this month!');
    });

    it('does NOT enqueue a new job when cache is warm', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      await GET(buildRequest());

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('does NOT hit the database when cache is warm', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      await GET(buildRequest());

      expect(mockPrismaSessionCount).not.toHaveBeenCalled();
    });
  });

  // ── (b) Cache MISS ─────────────────────────────────────────────────────────
  describe('when Redis cache is cold (no cached value)', () => {
    beforeEach(() => {
      mockGetRedis.mockReturnValue(mockRedisInstance);
      mockRedisGet.mockResolvedValue(null);
    });

    it('returns { narrative } with the fallback string', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(typeof body.narrative).toBe('string');
      expect(body.narrative.length).toBeGreaterThan(0);
      // Must not return the old 202/queued contract
      expect(body.status).toBeUndefined();
      expect(body.jobId).toBeUndefined();
    });

    it('returns the FALLBACK_NARRATIVE text', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(body.narrative).toBe(FALLBACK);
    });

    it('enqueues an AI_NARRATIVE job with cacheKey and cacheTtlSeconds', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      await GET(buildRequest());

      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
      const [jobName, jobData] = mockQueueAdd.mock.calls[0];
      expect(jobName).toBe('AI_NARRATIVE');
      expect(jobData.type).toBe('NARRATIVE');
      expect(jobData.payload.cacheKey).toBe('narrative:user-1');
      expect(typeof jobData.payload.cacheTtlSeconds).toBe('number');
      expect(jobData.payload.cacheTtlSeconds).toBeGreaterThan(0);
    });

    it('includes userId and sessionCount in the job payload', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      await GET(buildRequest());

      const jobData = mockQueueAdd.mock.calls[0][1];
      expect(jobData.payload.userId).toBe('user-1');
      expect(jobData.payload.sessionCount).toBe(5);
    });
  });

  // ── (c) Redis unavailable ──────────────────────────────────────────────────
  describe('when Redis is unavailable (getRedis returns null)', () => {
    beforeEach(() => {
      mockGetRedis.mockReturnValue(null);
    });

    it('returns a valid { narrative } response', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(typeof body.narrative).toBe('string');
      expect(body.narrative.length).toBeGreaterThan(0);
    });

    it('still enqueues the job despite Redis being unavailable', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      await GET(buildRequest());

      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    });
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────
  describe('when not authenticated', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(null);
    });

    it('returns 401 without hitting DB or Redis', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      const res = await GET(buildRequest());

      expect(res.status).toBe(401);
      expect(mockPrismaSessionCount).not.toHaveBeenCalled();
      expect(mockRedisGet).not.toHaveBeenCalled();
    });
  });

  // ── Redis read error ───────────────────────────────────────────────────────
  describe('when Redis.get throws', () => {
    beforeEach(() => {
      mockGetRedis.mockReturnValue(mockRedisInstance);
      mockRedisGet.mockRejectedValue(new Error('ECONNRESET'));
    });

    it('continues to return a valid { narrative } without crashing', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(typeof body.narrative).toBe('string');
    });

    it('logs a warning for the Redis read failure', async () => {
      const { GET } = await import('@/app/api/student/progress/narrative/route');
      await GET(buildRequest());

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Redis'),
        expect.objectContaining({ event: 'progress_narrative_cache_miss' }),
      );
    });
  });
});
