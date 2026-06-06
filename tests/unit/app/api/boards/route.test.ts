/**
 * FILE OBJECTIVE:
 * - Unit tests for GET/POST /api/boards Redis caching behavior.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | created tests for Redis cache hit/miss/TTL/invalidation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('GET /api/boards (Redis cached)', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('serves the cached JSON without hitting Prisma on cache hit', async () => {
    const cachedPayload = JSON.stringify([{ id: 'b-cached', name: 'Cached Board', classes: [] }])
    const redisGet = jest.fn().mockResolvedValue(cachedPayload)
    const redisSet = jest.fn()
    const findManyMock = jest.fn()

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: redisGet, set: redisSet, del: jest.fn() }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: findManyMock, create: jest.fn() } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }))

    const { GET } = await import('@/app/api/boards/route')
    const res: any = await GET(new Request('http://localhost/api/boards'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(cachedPayload))
    expect(redisGet).toHaveBeenCalledWith('boards:all-with-classes')
    expect(findManyMock).not.toHaveBeenCalled()
    expect(redisSet).not.toHaveBeenCalled()
  })

  it('writes to Redis with the expected TTL on cache miss', async () => {
    const fresh = [{ id: 'b1', name: 'Fresh Board', classes: [] }]
    const redisGet = jest.fn().mockResolvedValue(null)
    const redisSet = jest.fn().mockResolvedValue('OK')
    const findManyMock = jest.fn().mockResolvedValue(fresh)

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: redisGet, set: redisSet, del: jest.fn() }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: findManyMock, create: jest.fn() } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }))

    const { GET } = await import('@/app/api/boards/route')
    const res: any = await GET(new Request('http://localhost/api/boards'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fresh)
    expect(findManyMock).toHaveBeenCalled()
    expect(redisSet).toHaveBeenCalledWith(
      'boards:all-with-classes',
      JSON.stringify(fresh),
      'EX',
      3600,
    )
  })
})

describe('POST /api/boards', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('invalidates the boards cache after a successful create', async () => {
    const redisDel = jest.fn().mockResolvedValue(1)
    const createMock = jest.fn().mockResolvedValue({ id: 'b-new', name: 'New' })

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: redisDel }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: jest.fn(), create: createMock } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }))

    const { POST } = await import('@/app/api/boards/route')
    const res: any = await POST(new Request('http://localhost/api/boards', {
      method: 'POST',
      body: JSON.stringify({ name: 'New' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(200)
    expect(createMock).toHaveBeenCalled()
    expect(redisDel).toHaveBeenCalledWith('boards:all-with-classes')
  })

  it('logs a warning when cache invalidation fails (does not crash)', async () => {
    const redisDel = jest.fn().mockRejectedValue(new Error('redis down'))
    const createMock = jest.fn().mockResolvedValue({ id: 'b-new', name: 'New' })
    const warn = jest.fn()

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: redisDel }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: jest.fn(), create: createMock } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn, error: jest.fn() } }))

    const { POST } = await import('@/app/api/boards/route')
    const res: any = await POST(new Request('http://localhost/api/boards', {
      method: 'POST',
      body: JSON.stringify({ name: 'New' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(200)
    expect(warn).toHaveBeenCalledWith(
      'POST /api/boards cache invalidation failed',
      expect.objectContaining({ err: expect.stringContaining('redis down') }),
    )
  })
})
