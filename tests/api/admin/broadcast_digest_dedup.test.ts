/**
 * FILE OBJECTIVE:
 * - Verify the broadcast-digest endpoint refuses a second trigger inside
 *   the cooldown window so two admin clicks cannot double-send the
 *   weekly digest. Uses an in-memory Redis stub that honours SET NX EX.
 */

interface RedisStub {
  set: jest.Mock<Promise<string | null>, unknown[]>
  store: Map<string, string>
}

function makeRedisStub(): RedisStub {
  const store = new Map<string, string>()
  const set = jest.fn(async (...args: unknown[]) => {
    const [key, value, ...rest] = args as [string, string, ...string[]]
    const hasNx = rest.includes('NX')
    if (hasNx && store.has(key)) return null
    store.set(key, value)
    return 'OK'
  })
  return { set, store }
}

describe('admin broadcast-digest dedup', () => {
  const SESSION_ADMIN = {
    user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
  }

  let originalGlobalRedis: unknown

  beforeEach(() => {
    jest.resetModules()
    originalGlobalRedis = (globalThis as Record<string, unknown>).__TEST_REDIS__
  })

  afterEach(() => {
    const g = globalThis as Record<string, unknown>
    delete g.__TEST_SESSION__
    if (originalGlobalRedis === undefined) {
      delete g.__TEST_REDIS__
    } else {
      g.__TEST_REDIS__ = originalGlobalRedis
    }
    jest.resetModules()
  })

  test('returns 401 when there is no session', async () => {
    ;(globalThis as Record<string, unknown>).__TEST_SESSION__ = null
    const route = await import('../../../app/api/admin/notifications/broadcast-digest/route')
    const res = await route.POST()
    expect(res.status).toBe(401)
  })

  test('returns 403 when the session role is not admin', async () => {
    ;(globalThis as Record<string, unknown>).__TEST_SESSION__ = {
      user: { id: 'u-student', email: 's@example.com', role: 'student' },
    }
    const route = await import('../../../app/api/admin/notifications/broadcast-digest/route')
    const res = await route.POST()
    expect(res.status).toBe(403)
  })

  test('second trigger inside cooldown returns 409', async () => {
    const redisStub = makeRedisStub()
    jest.doMock('@/lib/redis', () => ({
      __esModule: true,
      getRedis: () => redisStub,
    }))
    jest.doMock('@/lib/prisma', () => ({
      __esModule: true,
      prisma: {
        parentStudent: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      },
    }))

    ;(globalThis as Record<string, unknown>).__TEST_SESSION__ = SESSION_ADMIN
    const route = await import('../../../app/api/admin/notifications/broadcast-digest/route')

    const first = await route.POST()
    expect(first.status).toBe(200)

    const second = await route.POST()
    expect(second.status).toBe(409)
    const body = await second.json()
    expect(body.error).toBe('already_running')

    // The Redis stub was called with NX both times; the second call returned null.
    expect(redisStub.set).toHaveBeenCalledTimes(2)
  })
})
