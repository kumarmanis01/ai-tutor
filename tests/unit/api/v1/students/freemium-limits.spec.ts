/**
 * Unit tests for GET /api/v1/students/[studentId]/freemium/limits (S2.4).
 */

const mockRedisGet = jest.fn();
const mockRedisTtl = jest.fn();
const mockRedisInstance = { get: mockRedisGet, ttl: mockRedisTtl };

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn() }));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { GET } from '@/app/api/v1/students/[studentId]/freemium/limits/route';

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
  mockRedisTtl.mockResolvedValue(-2);
});

describe('GET /api/v1/students/[studentId]/freemium/limits', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/students/s1/freemium/limits'), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 403 when userId does not match studentId', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'other' } });
    const res = await GET(new Request('https://example.com/api/v1/students/s1/freemium/limits'), makeParams('s1'));
    expect(res.status).toBe(403);
  });

  it('should return null limits for premium student', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'active' });
    const res = await GET(new Request('https://example.com/api/v1/students/s1/freemium/limits'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPremium).toBe(true);
    expect(body.limits.practice.limit).toBeNull();
    expect(body.limits.practice.remaining).toBeNull();
  });

  it('should return correct limits for free student', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockRedisGet.mockResolvedValue(null);
    const res = await GET(new Request('https://example.com/api/v1/students/s1/freemium/limits'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPremium).toBe(false);
    expect(body.limits.practice.limit).toBe(5);
    expect(body.limits.practice.remaining).toBe(5);
    expect(body.limits.aiTutor.limit).toBe(3);
  });

  it('should show cooldown state when upgrade request was recently sent', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockRedisGet.mockImplementation((key: string) => {
      if (key.includes('upgrade-request') && key.includes('practice')) {
        return Promise.resolve(JSON.stringify({ requestedAt: new Date().toISOString() }));
      }
      return Promise.resolve(null);
    });
    mockRedisTtl.mockImplementation((key: string) => {
      if (key.includes('upgrade-request')) return Promise.resolve(3600);
      return Promise.resolve(-2);
    });

    const res = await GET(new Request('https://example.com/api/v1/students/s1/freemium/limits'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limits.practice.cooldown.active).toBe(true);
    expect(body.limits.practice.cooldown.retryAfterSeconds).toBe(3600);
  });

  it('should show cooldown inactive when no upgrade request was sent', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    const res = await GET(new Request('https://example.com/api/v1/students/s1/freemium/limits'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limits.practice.cooldown.active).toBe(false);
  });
});
