/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/hierarchy Redis caching (cache key includes boardId + include).
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | created tests for cache key dimensions + hit/miss/TTL
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function loadRoute() {
  return import('@/app/api/hierarchy/route')
}

describe('GET /api/hierarchy (Redis cached)', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('produces distinct cache keys for different boardId + include combinations', async () => {
    const redisGet = jest.fn().mockResolvedValue(null)
    const redisSet = jest.fn().mockResolvedValue('OK')
    const findManyMock = jest.fn().mockResolvedValue([])

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: redisGet, set: redisSet }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: findManyMock } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }))

    const { GET } = await loadRoute()
    await GET(new Request('http://localhost/api/hierarchy'))
    await GET(new Request('http://localhost/api/hierarchy?include=subjects,chapters'))
    await GET(new Request('http://localhost/api/hierarchy?boardId=cbse&include=subjects,chapters,topics'))

    const keys = redisGet.mock.calls.map((c) => c[0])
    expect(keys).toEqual([
      'hierarchy:all:subjects',
      'hierarchy:all:subjects,chapters',
      'hierarchy:cbse:subjects,chapters,topics',
    ])
  })

  it('serves cached JSON on hit without hitting Prisma', async () => {
    const cached = JSON.stringify({ boards: [{ id: 'b-cached' }] })
    const redisGet = jest.fn().mockResolvedValue(cached)
    const redisSet = jest.fn()
    const findManyMock = jest.fn()

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: redisGet, set: redisSet }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: findManyMock } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }))

    const { GET } = await loadRoute()
    const res: any = await GET(new Request('http://localhost/api/hierarchy'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(cached))
    expect(findManyMock).not.toHaveBeenCalled()
    expect(redisSet).not.toHaveBeenCalled()
  })

  it('writes Redis with the expected TTL on cache miss', async () => {
    const fresh = [{ id: 'b1', name: 'CBSE', classes: [] }]
    const redisGet = jest.fn().mockResolvedValue(null)
    const redisSet = jest.fn().mockResolvedValue('OK')
    const findManyMock = jest.fn().mockResolvedValue(fresh)

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: redisGet, set: redisSet }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { board: { findMany: findManyMock } } }))
    jest.doMock('@/lib/guards/noStringFilters', () => ({ assertNoStringFilters: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }))

    const { GET } = await loadRoute()
    const res: any = await GET(new Request('http://localhost/api/hierarchy'))

    expect(res.status).toBe(200)
    expect(findManyMock).toHaveBeenCalled()
    expect(redisSet).toHaveBeenCalledWith(
      'hierarchy:all:subjects',
      JSON.stringify({ boards: fresh }),
      'EX',
      3600,
    )
  })
})
