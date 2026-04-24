/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/content-generation/deduplication.service.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created — B4.2 deduplication service tests
 */

import {
  normalizeTopic,
  checkDedup,
  setDedup,
} from '@/lib/content-generation/deduplication.service'

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    generationJob: {
      update: jest.fn(),
    },
  },
}))

import { getRedis } from '@/lib/redis'

const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>

describe('lib/content-generation/deduplication.service', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetRedis.mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>)
  })

  // ── normalizeTopic ─────────────────────────────────────────────────────────

  describe('normalizeTopic', () => {
    it('should lowercase the topic', () => {
      expect(normalizeTopic('Photosynthesis')).toBe('photosynthesis')
    })

    it('should replace spaces with hyphens', () => {
      expect(normalizeTopic('Newton Laws of Motion')).toBe('newton-laws-of-motion')
    })

    it('should strip special characters', () => {
      // ':' removed, '&' and spaces around it collapse to single '-'
      expect(normalizeTopic('Maths: Algebra & Equations!')).toBe('maths-algebra-equations')
    })

    it('should handle already-normalized topics', () => {
      expect(normalizeTopic('photosynthesis')).toBe('photosynthesis')
    })
  })

  // ── checkDedup ─────────────────────────────────────────────────────────────

  describe('checkDedup', () => {
    it('should return jobId when found in Redis', async () => {
      mockRedis.get.mockResolvedValue('job-abc-123')
      const result = await checkDedup('photosynthesis')
      expect(result).toBe('job-abc-123')
      expect(mockRedis.get).toHaveBeenCalledWith('content_gen:dedup:photosynthesis')
    })

    it('should return null when not found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null)
      const result = await checkDedup('not-cached-topic')
      expect(result).toBeNull()
    })

    it('should return null when Redis is unavailable', async () => {
      mockGetRedis.mockReturnValue(null)
      const result = await checkDedup('any-topic')
      expect(result).toBeNull()
    })

    it('should return null on Redis error (non-fatal)', async () => {
      mockRedis.get.mockRejectedValue(new Error('timeout'))
      const result = await checkDedup('any-topic')
      expect(result).toBeNull()
    })
  })

  // ── setDedup ───────────────────────────────────────────────────────────────

  describe('setDedup', () => {
    it('should write to Redis with 900s TTL', async () => {
      mockRedis.set.mockResolvedValue('OK')
      await setDedup('photosynthesis', 'job-xyz')
      expect(mockRedis.set).toHaveBeenCalledWith(
        'content_gen:dedup:photosynthesis',
        'job-xyz',
        'EX',
        900,
      )
    })

    it('should not throw when Redis is unavailable', async () => {
      mockGetRedis.mockReturnValue(null)
      await expect(setDedup('any-topic', 'job-1')).resolves.toBeUndefined()
    })

    it('should not throw on Redis error (non-fatal)', async () => {
      mockRedis.set.mockRejectedValue(new Error('write failed'))
      await expect(setDedup('topic', 'job-2')).resolves.toBeUndefined()
    })
  })
})
