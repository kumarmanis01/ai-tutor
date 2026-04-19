import { getSharedConnection, redisConnection, _resetRedisForTests } from '@/lib/redis'

describe('lib/redis getSharedConnection', () => {
  afterEach(() => {
    // Ensure test isolation
    _resetRedisForTests()
    delete process.env.REDIS_URL
  })

  it('returns redisConnection when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL
    const conn = getSharedConnection()
    expect(conn).toBe(redisConnection)
  })
})
