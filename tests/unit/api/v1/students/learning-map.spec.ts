/**
 * Unit tests for GET /api/v1/students/[studentId]/learning-map (S2.1).
 */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    subjectDef: { findMany: jest.fn() },
    studentTopicProgress: { findMany: jest.fn() },
  },
}));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/v1/students/[studentId]/learning-map/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockSubjectFind = prisma.subjectDef.findMany as jest.Mock;
const mockProgressFind = prisma.studentTopicProgress.findMany as jest.Mock;

const BASE_URL = 'https://example.com/api/v1/students/s1/learning-map';

function makeParams(studentId = 's1') {
  return { params: Promise.resolve({ studentId }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 's1' } });
});

describe('GET /api/v1/students/[studentId]/learning-map', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 403 when userId does not match studentId', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'other' } });
    const res = await GET(new Request(BASE_URL), makeParams('s1'));
    expect(res.status).toBe(403);
  });

  it('should return empty chapters when student has no board or grade', async () => {
    mockUserFind.mockResolvedValueOnce({ id: 's1', board: null, grade: null, totalXp: 50, currentStreak: 3, subscriptionStatus: 'free' });
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toEqual([]);
    expect(body.topBar.xp).toBe(50);
    expect(body.topBar.streak).toBe(3);
  });

  it('should return 400 when student grade is non-numeric', async () => {
    mockUserFind.mockResolvedValueOnce({ id: 's1', board: 'CBSE', grade: 'X', totalXp: 0, currentStreak: 0, subscriptionStatus: 'free' });
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(400);
  });

  it('should return chapter nodes with correct states for free student', async () => {
    mockUserFind.mockResolvedValueOnce({ id: 's1', board: 'cbse', grade: '6', totalXp: 200, currentStreak: 5, subscriptionStatus: 'free' });

    const topicA = { id: 'ta', name: 'Topic A' };
    const topicB = { id: 'tb', name: 'Topic B' };
    mockSubjectFind.mockResolvedValueOnce([
      {
        id: 'sub1',
        name: 'Math',
        chapters: [
          { id: 'ch1', name: 'Chapter 1', order: 1, topics: [topicA, topicB] },
          { id: 'ch2', name: 'Chapter 2', order: 2, topics: [{ id: 'tc', name: 'Topic C' }] },
        ],
      },
    ]);
    mockProgressFind.mockResolvedValueOnce([
      { topicId: 'ta', mastery: 0.8, practiceCount: 2 },
      { topicId: 'tb', mastery: 0.75, practiceCount: 1 },
    ]);

    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toHaveLength(2);
    expect(body.chapters[0].state).toBe('completed');
    expect(body.chapters[1].state).toBe('current');
    expect(body.topBar.xp).toBe(200);
  });

  it('should mark chapters beyond 2 as premium-locked for free students', async () => {
    mockUserFind.mockResolvedValueOnce({ id: 's1', board: 'cbse', grade: '6', totalXp: 0, currentStreak: 0, subscriptionStatus: 'free' });
    mockSubjectFind.mockResolvedValueOnce([
      {
        id: 'sub1',
        name: 'Math',
        chapters: [
          { id: 'ch1', name: 'Ch1', order: 1, topics: [{ id: 't1', name: 'T1' }] },
          { id: 'ch2', name: 'Ch2', order: 2, topics: [{ id: 't2', name: 'T2' }] },
          { id: 'ch3', name: 'Ch3', order: 3, topics: [{ id: 't3', name: 'T3' }] },
        ],
      },
    ]);
    mockProgressFind.mockResolvedValueOnce([]);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters[2].state).toBe('premium-locked');
  });

  it('should not premium-lock chapters for paid students', async () => {
    mockUserFind.mockResolvedValueOnce({ id: 's1', board: 'cbse', grade: '6', totalXp: 0, currentStreak: 0, subscriptionStatus: 'active' });
    mockSubjectFind.mockResolvedValueOnce([
      {
        id: 'sub1',
        name: 'Math',
        chapters: [
          { id: 'ch1', name: 'Ch1', order: 1, topics: [{ id: 't1', name: 'T1' }] },
          { id: 'ch2', name: 'Ch2', order: 2, topics: [{ id: 't2', name: 'T2' }] },
          { id: 'ch3', name: 'Ch3', order: 3, topics: [{ id: 't3', name: 'T3' }] },
        ],
      },
    ]);
    mockProgressFind.mockResolvedValueOnce([]);
    const res = await GET(new Request(BASE_URL), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters[2].state).not.toBe('premium-locked');
  });
});
