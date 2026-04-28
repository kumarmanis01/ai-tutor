/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/surprise-me
 *
 * LINKED UNIT TEST:
 * - tests/unit/student/surpriseMe.test.ts
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    studentTopicProgress: { findFirst: jest.fn() },
    topicDef: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/student/surprise-me/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

const mockPrisma = prisma as unknown as {
  studentTopicProgress: { findFirst: jest.Mock };
};
const mockGetSession = getServerSessionForHandlers as jest.Mock;

describe('GET /api/student/surprise-me', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/student/surprise-me');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('returns a weak topic when present', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    mockPrisma.studentTopicProgress.findFirst.mockResolvedValueOnce({
      id: 'p1',
      topic: {
        id: 'topic-1',
        name: 'Fractions',
        chapter: { name: 'Numbers', subject: { name: 'Math' } },
      },
    });

    const req = new Request('http://localhost/api/student/surprise-me');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBeDefined();
    expect(body.action.topicId).toBe('topic-1');
    expect(body.source).toBe('surprise_me');
  });
});
