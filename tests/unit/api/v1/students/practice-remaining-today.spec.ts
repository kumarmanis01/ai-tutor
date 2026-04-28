/**
 * Unit tests for GET /api/v1/students/[studentId]/practice/remaining-today (S2.3).
 */

const mockRedisGet = jest.fn();
const mockRedisInstance = { get: mockRedisGet };

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn() }));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { GET } from '@/app/api/v1/students/[studentId]/practice/remaining-today/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockGetRedis = getRedis as jest.Mock;

function makeParams(studentId = 's1') {
  return { params: Promise.resolve({ studentId }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 's1' } });
  mockGetRedis.mockReturnValue(mockRedisInstance);
  mockRedisGet.mockResolvedValue(null);
});

describe('GET /api/v1/students/[studentId]/practice/remaining-today', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 403 when userId does not match studentId', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'other' } });
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams('s1'));
    expect(res.status).toBe(403);
  });

  it('should return isPremium: true and remaining: null for premium students', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'active' });
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPremium).toBe(true);
    expect(body.remaining).toBeNull();
    expect(body.limit).toBeNull();
  });

  it('should return remaining count for free student with no usage', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockRedisGet.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPremium).toBe(false);
    expect(body.remaining).toBe(5);
    expect(body.limit).toBe(5);
    expect(body.used).toBe(0);
  });

  it('should return correct remaining when student has used some questions', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockRedisGet.mockResolvedValueOnce('3');
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining).toBe(2);
    expect(body.used).toBe(3);
  });

  it('should return remaining: 0 when daily limit exhausted', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockRedisGet.mockResolvedValueOnce('5');
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining).toBe(0);
  });

  it('should return full limit when Redis is unavailable', async () => {
    mockGetRedis.mockReturnValueOnce(null);
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    const res = await GET(new Request('https://example.com/api/v1/students/s1/practice/remaining-today'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining).toBe(5);
  });
});
