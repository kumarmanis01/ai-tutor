import { djb2Hash, isInAITutorRollout } from '@/lib/features/rollout'

// ── Prisma mock ────────────────────────────────────────────────────────────────
const mockFindUnique = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    studentFeatureFlag: { findUnique: (...args: any[]) => mockFindUnique(...args) },
  },
}))

beforeEach(() => {
  mockFindUnique.mockReset()
  delete process.env.ENABLE_AI_TUTOR
  delete process.env.ROLLOUT_PERCENTAGE
})

// ── djb2Hash ────────────────────────────────────────────────────────────────────

describe('djb2Hash', () => {
  test('is deterministic — same input always returns same value', () => {
    expect(djb2Hash('user-abc')).toBe(djb2Hash('user-abc'))
  })

  test('returns a non-negative integer', () => {
    expect(djb2Hash('test')).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(djb2Hash('test'))).toBe(true)
  })

  test('returns seed value for empty string (djb2 seed is 5381)', () => {
    expect(djb2Hash('')).toBe(5381)
  })

  test('different inputs produce different hashes', () => {
    expect(djb2Hash('user-1')).not.toBe(djb2Hash('user-2'))
  })

  test('at ROLLOUT_PERCENTAGE=5, ~5% of 1000 IDs pass', () => {
    // Generate 1000 synthetic IDs and count how many hash to < 5
    let hits = 0
    for (let i = 0; i < 1000; i++) {
      if (djb2Hash(`synthetic-user-${i}`) % 100 < 5) hits++
    }
    // Expect between 1% and 10% (loose bounds to avoid flakiness)
    expect(hits).toBeGreaterThan(10)
    expect(hits).toBeLessThan(100)
  })
})

// ── isInAITutorRollout ──────────────────────────────────────────────────────────

describe('isInAITutorRollout', () => {
  // Step 1: global kill switch
  test('returns false when ENABLE_AI_TUTOR is not "true"', async () => {
    process.env.ENABLE_AI_TUTOR = 'false'
    expect(await isInAITutorRollout('user-1')).toBe(false)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  test('returns false when ENABLE_AI_TUTOR is unset', async () => {
    delete process.env.ENABLE_AI_TUTOR
    expect(await isInAITutorRollout('user-1')).toBe(false)
  })

  test('ENABLE_AI_TUTOR=false blocks all regardless of flag or percentage', async () => {
    process.env.ENABLE_AI_TUTOR = 'false'
    process.env.ROLLOUT_PERCENTAGE = '100'
    mockFindUnique.mockResolvedValueOnce({ enabled: true })
    expect(await isInAITutorRollout('user-1')).toBe(false)
  })

  // Step 2: per-user flag override
  test('returns true when StudentFeatureFlag.enabled = true', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    mockFindUnique.mockResolvedValueOnce({ enabled: true })
    expect(await isInAITutorRollout('user-flagged')).toBe(true)
  })

  test('returns false when StudentFeatureFlag.enabled = false', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    mockFindUnique.mockResolvedValueOnce({ enabled: false })
    expect(await isInAITutorRollout('user-flagged')).toBe(false)
  })

  test('flag overrides percentage — flag=false beats 100% rollout', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    process.env.ROLLOUT_PERCENTAGE = '100'
    mockFindUnique.mockResolvedValueOnce({ enabled: false })
    expect(await isInAITutorRollout('user-blocked')).toBe(false)
  })

  // Step 3: hash-based percentage rollout (flag returns null = no row)
  test('falls through to hash when no flag row exists', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    process.env.ROLLOUT_PERCENTAGE = '100' // everyone passes
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await isInAITutorRollout('user-noflag')).toBe(true)
  })

  test('blocks user via hash when percentage = 0', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    process.env.ROLLOUT_PERCENTAGE = '0'
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await isInAITutorRollout('user-noflag')).toBe(false)
  })

  test('handles DB error gracefully (treated as no flag)', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    process.env.ROLLOUT_PERCENTAGE = '100'
    mockFindUnique.mockRejectedValueOnce(new Error('db down'))
    // .catch(() => null) means null → falls through to hash
    expect(await isInAITutorRollout('user-noflag')).toBe(true)
  })

  test('uses correct composite key name for flag lookup', async () => {
    process.env.ENABLE_AI_TUTOR = 'true'
    mockFindUnique.mockResolvedValueOnce(null)
    process.env.ROLLOUT_PERCENTAGE = '0'
    await isInAITutorRollout('user-check')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { studentId_key: { studentId: 'user-check', key: 'AI_TUTOR' } },
      select: { enabled: true },
    })
  })
})
