/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/admin/system/worker-status authorization and heartbeat mapping.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/system/worker-status/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T00:00:00Z | copilot | add tests for auth rejection and worker heartbeat status responses
 */

describe('GET /api/admin/system/worker-status', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns 403 when admin guard fails', async () => {
    const findFirst = jest.fn();

    jest.doMock('@/lib/admin/guards', () => ({
      requireActiveAdmin: jest.fn().mockResolvedValue({ ok: false }),
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        workerLifecycle: {
          findFirst,
        },
      },
    }));

    const route = await import('@/app/api/admin/system/worker-status/route');
    const res = await route.GET();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.alive).toBe(false);
    expect(body.error.message).toBe('Forbidden');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns alive=true with heartbeat details when worker is fresh', async () => {
    const heartbeat = new Date('2026-05-01T10:00:00.000Z');

    jest.doMock('@/lib/admin/guards', () => ({
      requireActiveAdmin: jest.fn().mockResolvedValue({ ok: true, adminUserId: 'a1' }),
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        workerLifecycle: {
          findFirst: jest.fn().mockResolvedValue({ type: 'content-hydration', lastHeartbeatAt: heartbeat }),
        },
      },
    }));

    const route = await import('@/app/api/admin/system/worker-status/route');
    const res = await route.GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alive).toBe(true);
    expect(body.type).toBe('content-hydration');
    expect(body.lastHeartbeatAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('returns alive=false when no fresh worker heartbeat exists', async () => {
    jest.doMock('@/lib/admin/guards', () => ({
      requireActiveAdmin: jest.fn().mockResolvedValue({ ok: true, adminUserId: 'a1' }),
    }));

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        workerLifecycle: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    }));

    const route = await import('@/app/api/admin/system/worker-status/route');
    const res = await route.GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alive).toBe(false);
    expect(body.type).toBeNull();
    expect(body.lastHeartbeatAt).toBeNull();
  });
});
