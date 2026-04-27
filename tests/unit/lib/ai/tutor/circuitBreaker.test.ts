import {
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  _circuitBreakerInternals,
} from '@/lib/ai/tutor/circuitBreaker'

const { KEYS, FAILURE_THRESHOLD, OPEN_TTL, FAILURE_WINDOW_TTL } = _circuitBreakerInternals

const mockRedis = {
  get: jest.fn<Promise<string | null>, [string]>(),
  set: jest.fn<Promise<'OK'>, any>(),
  incr: jest.fn<Promise<number>, [string]>(),
  expire: jest.fn<Promise<number>, [string, number]>(),
  del: jest.fn<Promise<number>, [string, ...string[]]>(),
}

jest.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
}))

beforeEach(() => {
  mockRedis.get.mockReset()
  mockRedis.set.mockReset()
  mockRedis.incr.mockReset()
  mockRedis.expire.mockReset()
  mockRedis.del.mockReset()
})

describe('circuitBreaker', () => {
  // ── isCircuitOpen ──────────────────────────────────────────────────────────

  test('isCircuitOpen returns false when key missing', async () => {
    mockRedis.get.mockResolvedValueOnce(null)
    expect(await isCircuitOpen()).toBe(false)
    expect(mockRedis.get).toHaveBeenCalledWith(KEYS.open)
  })

  test('isCircuitOpen returns true when key is "1"', async () => {
    mockRedis.get.mockResolvedValueOnce('1')
    expect(await isCircuitOpen()).toBe(true)
  })

  test('isCircuitOpen returns false on Redis error (never throws)', async () => {
    mockRedis.get.mockRejectedValueOnce(new Error('redis down'))
    await expect(isCircuitOpen()).resolves.toBe(false)
  })

  // ── recordFailure ──────────────────────────────────────────────────────────

  test('recordFailure INCRs failures key', async () => {
    mockRedis.incr.mockResolvedValueOnce(1)
    mockRedis.expire.mockResolvedValueOnce(1)
    await recordFailure()
    expect(mockRedis.incr).toHaveBeenCalledWith(KEYS.failures)
  })

  test('recordFailure sets TTL on first increment', async () => {
    mockRedis.incr.mockResolvedValueOnce(1)
    mockRedis.expire.mockResolvedValueOnce(1)
    await recordFailure()
    expect(mockRedis.expire).toHaveBeenCalledWith(KEYS.failures, FAILURE_WINDOW_TTL)
  })

  test('recordFailure does NOT set TTL on subsequent increments', async () => {
    mockRedis.incr.mockResolvedValueOnce(2)
    await recordFailure()
    expect(mockRedis.expire).not.toHaveBeenCalled()
  })

  test(`recordFailure opens circuit at failure count >= ${FAILURE_THRESHOLD}`, async () => {
    mockRedis.incr.mockResolvedValueOnce(FAILURE_THRESHOLD)
    mockRedis.set.mockResolvedValueOnce('OK')
    await recordFailure()
    expect(mockRedis.set).toHaveBeenCalledWith(KEYS.open, '1', 'EX', OPEN_TTL)
  })

  test(`recordFailure does NOT open circuit below threshold`, async () => {
    mockRedis.incr.mockResolvedValueOnce(FAILURE_THRESHOLD - 1)
    await recordFailure()
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  test('recordFailure never throws on Redis error', async () => {
    mockRedis.incr.mockRejectedValueOnce(new Error('redis down'))
    await expect(recordFailure()).resolves.toBeUndefined()
  })

  // ── recordSuccess ──────────────────────────────────────────────────────────

  test('recordSuccess deletes both keys', async () => {
    mockRedis.del.mockResolvedValueOnce(2)
    await recordSuccess()
    expect(mockRedis.del).toHaveBeenCalledWith(KEYS.failures, KEYS.open)
  })

  test('recordSuccess never throws on Redis error', async () => {
    mockRedis.del.mockRejectedValueOnce(new Error('redis down'))
    await expect(recordSuccess()).resolves.toBeUndefined()
  })

  // ── 3-failure → open flow ──────────────────────────────────────────────────

  test('3 simulated failures open circuit; isCircuitOpen then returns true', async () => {
    // failures 1 and 2 — below threshold
    mockRedis.incr.mockResolvedValueOnce(1)
    mockRedis.expire.mockResolvedValueOnce(1)
    await recordFailure()

    mockRedis.incr.mockResolvedValueOnce(2)
    await recordFailure()

    // failure 3 — hits threshold, opens circuit
    mockRedis.incr.mockResolvedValueOnce(3)
    mockRedis.set.mockResolvedValueOnce('OK')
    await recordFailure()

    // Verify circuit is now open
    mockRedis.get.mockResolvedValueOnce('1')
    expect(await isCircuitOpen()).toBe(true)
  })

  test('after recordSuccess, isCircuitOpen returns false', async () => {
    mockRedis.del.mockResolvedValueOnce(2)
    await recordSuccess()

    mockRedis.get.mockResolvedValueOnce(null)
    expect(await isCircuitOpen()).toBe(false)
  })

  // ── key names ──────────────────────────────────────────────────────────────

  test('KEYS constants match spec', () => {
    expect(KEYS.failures).toBe('cb:llm:failures')
    expect(KEYS.open).toBe('cb:llm:open')
  })
})
