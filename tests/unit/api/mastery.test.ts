/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/mastery route: auth guard, happy path, limit param.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-2 PART B tests: initial creation
 */

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockGetServerSessionForHandlers = jest.fn();
const mockGetDevelopingTopics = jest.fn();
const mockGetProgressByState = jest.fn();

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: mockGetServerSessionForHandlers,
}));

jest.mock('@/lib/mastery/topicProgress', () => ({
  getDevelopingTopics: mockGetDevelopingTopics,
  getProgressByState: mockGetProgressByState,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAPI: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '@/app/api/mastery/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string): Request {
  return { url, method: 'GET' } as unknown as Request;
}

function makeTopicRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tp-001',
    userId: 'user-001',
    topicSlug: 'quadratic-equations',
    subject: 'Mathematics',
    grade: '10',
    board: 'cbse',
    state: 'DEVELOPING',
    score: 0.65,
    attempts: 2,
    lastStudiedAt: new Date('2026-06-01'),
    masteredAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/mastery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when unauthenticated', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/mastery'));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return DEVELOPING topics for authenticated user', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-001' } });
    const topics = [makeTopicRecord(), makeTopicRecord({ id: 'tp-002', topicSlug: 'trigonometry' })];
    mockGetDevelopingTopics.mockResolvedValue(topics);

    const res = await GET(makeRequest('http://localhost/api/mastery?state=DEVELOPING'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.topics).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(mockGetDevelopingTopics).toHaveBeenCalledWith('user-001', 20);
  });

  it('should respect the limit param', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-001' } });
    mockGetDevelopingTopics.mockResolvedValue([makeTopicRecord()]);

    const res = await GET(makeRequest('http://localhost/api/mastery?state=DEVELOPING&limit=5'));
    expect(res.status).toBe(200);

    expect(mockGetDevelopingTopics).toHaveBeenCalledWith('user-001', 5);
  });

  it('should return 400 for invalid state param', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-001' } });

    const res = await GET(makeRequest('http://localhost/api/mastery?state=INVALID'));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid state parameter');
  });

  it('should return 500 and log when service throws', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-001' } });
    mockGetDevelopingTopics.mockRejectedValue(new Error('db error'));

    const res = await GET(makeRequest('http://localhost/api/mastery?state=DEVELOPING'));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('Failed to fetch mastery data');
  });
});
