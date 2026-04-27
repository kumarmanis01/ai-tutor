/**
 * Unit tests for POST /api/v1/students/[studentId]/freemium/request-upgrade (S2.4).
 */

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisTtl = jest.fn();
const mockRedisInstance = { get: mockRedisGet, set: mockRedisSet, ttl: mockRedisTtl };

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    parentStudent: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn() }));
jest.mock('@/lib/push/send', () => ({ sendPushSafe: jest.fn() }));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { sendPushSafe } from '@/lib/push/send';
import { POST } from '@/app/api/v1/students/[studentId]/freemium/request-upgrade/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockParentFind = prisma.parentStudent.findFirst as jest.Mock;
const mockAuditCreate = prisma.auditLog.create as jest.Mock;
const mockGetRedis = getRedis as jest.Mock;
const mockSendPush = sendPushSafe as jest.Mock;

function makeParams(studentId = 's1') {
  return { params: Promise.resolve({ studentId }) };
}

function makeRequest(body: unknown = { featureType: 'practice' }) {
  return new Request('https://example.com/api/v1/students/s1/freemium/request-upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 's1' } });
  mockGetRedis.mockReturnValue(mockRedisInstance);
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
  mockRedisTtl.mockResolvedValue(3600);
  mockUserFind.mockResolvedValue({ name: 'Rahul' });
  mockParentFind.mockResolvedValue(null);
  mockAuditCreate.mockResolvedValue({});
  mockSendPush.mockResolvedValue(undefined);
});

describe('POST /api/v1/students/[studentId]/freemium/request-upgrade', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 403 when userId does not match studentId', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'other' } });
    const res = await POST(makeRequest(), makeParams('s1'));
    expect(res.status).toBe(403);
  });

  it('should return 429 when cooldown is active', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ requestedAt: new Date().toISOString(), featureType: 'practice' }));
    mockRedisTtl.mockResolvedValueOnce(3600);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('COOLDOWN_ACTIVE');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should succeed and return ok:true when no cooldown', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.featureType).toBe('practice');
  });

  it('should send push notification to parent when parent link exists', async () => {
    mockParentFind.mockResolvedValueOnce({ parentId: 'p1' });
    await POST(makeRequest(), makeParams());
    expect(mockSendPush).toHaveBeenCalledWith('p1', expect.objectContaining({ tag: 'freemium-upgrade-request' }));
  });

  it('should not send push notification when no parent link', async () => {
    mockParentFind.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parentNotified).toBe(false);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('should respect featureType ai_tutor variant', async () => {
    const res = await POST(makeRequest({ featureType: 'ai_tutor' }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.featureType).toBe('ai_tutor');
  });

  it('should set cooldown in Redis after successful request', async () => {
    await POST(makeRequest(), makeParams());
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining('freemium:upgrade-request:s1:practice'),
      expect.any(String),
      'EX',
      86400
    );
  });
});
