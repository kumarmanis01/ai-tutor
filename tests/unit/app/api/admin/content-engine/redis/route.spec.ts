/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/admin/content-engine/redis authorization and response behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/redis/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T00:00:00Z | copilot | add auth and success/error-path tests for redis admin status route
 */

describe('GET /api/admin/content-engine/redis', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns 403 when admin guard fails', async () => {
    const ping = jest.fn();
    const info = jest.fn();

    jest.doMock('@/lib/admin/guards', () => ({
      requireActiveAdmin: jest.fn().mockResolvedValue({ ok: false }),
    }));

    jest.doMock('@/lib/redis', () => ({
      getRedis: jest.fn(() => ({ ping, info })),
    }));

    const route = await import('@/app/api/admin/content-engine/redis/route');
    const res = await route.GET();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe('Forbidden');
    expect(ping).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('returns parsed redis details for authorized admin', async () => {
    jest.doMock('@/lib/admin/guards', () => ({
      requireActiveAdmin: jest.fn().mockResolvedValue({ ok: true, adminUserId: 'a1' }),
    }));

    jest.doMock('@/lib/redis', () => ({
      getRedis: jest.fn(() => ({
        ping: jest.fn().mockResolvedValue('PONG'),
        info: jest
          .fn()
          .mockResolvedValue(
            [
              'used_memory_human:1.2M',
              'maxmemory_policy:noeviction',
              'connected_clients:12',
              'uptime_in_seconds:3456',
              'redis_version:7.2.4',
            ].join('\r\n')
          ),
      })),
    }));

    const route = await import('@/app/api/admin/content-engine/redis/route');
    const res = await route.GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ping).toBe('PONG');
    expect(body.usedMemory).toBe('1.2M');
    expect(body.maxmemoryPolicy).toBe('noeviction');
    expect(body.connectedClients).toBe(12);
    expect(body.uptimeSeconds).toBe(3456);
    expect(body.redisVersion).toBe('7.2.4');
  });

  it('returns 500 when redis query fails', async () => {
    const loggerError = jest.fn();

    jest.doMock('@/lib/admin/guards', () => ({
      requireActiveAdmin: jest.fn().mockResolvedValue({ ok: true, adminUserId: 'a1' }),
    }));

    jest.doMock('@/lib/redis', () => ({
      getRedis: jest.fn(() => ({
        ping: jest.fn().mockRejectedValue(new Error('redis unavailable')),
        info: jest.fn().mockResolvedValue(''),
      })),
    }));

    jest.doMock('@/lib/logger', () => ({
      logger: {
        error: loggerError,
      },
    }));

    jest.doMock('@/lib/errorResponse', () => ({
      formatErrorForResponse: jest.fn(() => ({ name: 'Error', message: 'Internal error' })),
    }));

    const route = await import('@/app/api/admin/content-engine/redis/route');
    const res = await route.GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe('Internal error');
    expect(loggerError).toHaveBeenCalled();
  });
});
