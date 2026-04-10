/**
 * Integration test: verify Redis SET NX EX semantics used for notification suppression
 * and that the worker sets suppression keys and updateStreak clears them.
 *
 * This test connects to a real Redis instance defined by `REDIS_URL` and is
 * intended for local runs only (kept under tests/integration/ to avoid CI).
 */

import Redis from 'ioredis'

describe('notification suppression Redis semantics (integration)', () => {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  let redis: Redis.Redis

  beforeAll(async () => {
    redis = new Redis(redisUrl)
    try { await redis.ping() } catch (e) {
      // allow tests to skip when Redis not available
    }
  })

  afterAll(async () => {
    if (redis) {
      try { await redis.quit() } catch { try { redis.disconnect() } catch {} }
    }
  })

  it('sets suppression with EX NX and is cleared on activity', async () => {
    try {
      await redis.ping()
    } catch (err) {
      // Skip if no Redis available
      // eslint-disable-next-line no-console
      console.warn('Skipping integration test: Redis not reachable at', redisUrl)
      return
    }

    jest.resetModules()

    const parentId = 'p-int-redis'
    const studentId = 's-int-redis'
    const suppressionKey = `parent:notifications:suppression:inactivity:${parentId}:${studentId}`

    // Ensure clean state
    await redis.del(suppressionKey)

    // Mock prisma to return one inactive student and one parent link
    const prismaMock = {
      user: {
        findMany: jest.fn(async () => [{ id: studentId, name: 'Test', timezone: 'UTC', lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) }]),
        findUnique: jest.fn(async () => ({ lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), currentStreak: 0, longestStreak: 0, timezone: 'UTC' })),
        update: jest.fn(async (args: any) => args),
      },
      parentStudent: {
        findMany: jest.fn(async (args: any) => {
          if (args && args.select) return [{ parentId }]
          return [{ parent: { id: parentId, email: 'p@ex.test', phone: null, name: 'P' } }]
        }),
      },
      learningPlanItem: { findFirst: jest.fn(async () => ({ id: 'lp-1' })) },
      parentNotification: { create: jest.fn(async () => ({})) },
    }

    jest.doMock('@/lib/redis', () => ({ getRedis: () => redis }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    const sendMock = jest.fn(async () => ({ sent: true }))
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }))

    const { runInactivityAlerts } = await import('@/worker/jobs/inactivityAlert')

    // Run worker once — should send and set suppression key
    await redis.del(suppressionKey)
    const sent = await runInactivityAlerts()
    expect(sendMock).toHaveBeenCalled()

    const v = await redis.get(suppressionKey)
    expect(v).toBeTruthy()

    const ttl = await redis.ttl(suppressionKey)
    expect(typeof ttl).toBe('number')
    expect(ttl).toBeGreaterThan(0)

    // Attempt to set the key again with NX — should return null
    const ttlSeconds = Math.max(ttl, 24 * 60 * 60)
    const setRes = await redis.set(suppressionKey, '2', 'EX', ttlSeconds, 'NX')
    expect(setRes).toBeNull()

    // Now call updateStreak which should clear suppression keys
    const { updateStreak } = await import('@/lib/student/streak')
    await updateStreak(studentId)

    const after = await redis.get(suppressionKey)
    expect(after).toBeNull()
  })
})
