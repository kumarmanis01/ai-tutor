/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/student/dailyStudyLimit.ts: checkDailyStudyLimit,
 *   updateDailyStudyTime, and resetDailyStudyTime helpers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/dailyStudyLimit.spec.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | created
 */

import {
  checkDailyStudyLimit,
  updateDailyStudyTime,
  resetDailyStudyTime,
} from '@/lib/student/dailyStudyLimit'
import { DAILY_STUDY_LIMIT_MINUTES } from '@/lib/constants/studyLimits'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/subscription', () => ({
  isPremiumUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { isPremiumUser } from '@/lib/subscription'

const mockFindUnique = prisma.user.findUnique as jest.Mock
const mockUpdate = prisma.user.update as jest.Mock
const mockIsPremium = isPremiumUser as jest.Mock

// ── Helpers ───────────────────────────────────────────────────────────────────

/** ISO date string for today in UTC. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** A Date object for "today at noon UTC". */
function todayNoon(): Date {
  return new Date(`${todayUtc()}T12:00:00.000Z`)
}

/** A Date object for "yesterday at noon UTC". */
function yesterdayNoon(): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return new Date(`${d.toISOString().slice(0, 10)}T12:00:00.000Z`)
}

// ── checkDailyStudyLimit ─────────────────────────────────────────────────────

describe('checkDailyStudyLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return allowed=true with premium limit when user is premium and has capacity', async () => {
    mockIsPremium.mockResolvedValue(true)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 20, lastStudySessionDate: todayNoon() })

    const result = await checkDailyStudyLimit('user-1')

    expect(result.allowed).toBe(true)
    expect(result.tier).toBe('premium')
    expect(result.limitMinutes).toBe(DAILY_STUDY_LIMIT_MINUTES.premium)
    expect(result.usedMinutes).toBe(20)
    expect(result.remainingMinutes).toBe(DAILY_STUDY_LIMIT_MINUTES.premium - 20)
  })

  it('should return allowed=false when free user has used all 30 minutes today', async () => {
    mockIsPremium.mockResolvedValue(false)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 30, lastStudySessionDate: todayNoon() })

    const result = await checkDailyStudyLimit('user-1')

    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('free')
    expect(result.limitMinutes).toBe(DAILY_STUDY_LIMIT_MINUTES.free)
    expect(result.remainingMinutes).toBe(0)
  })

  it('should treat lastStudySessionDate from yesterday as 0 minutes used today', async () => {
    mockIsPremium.mockResolvedValue(false)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 30, lastStudySessionDate: yesterdayNoon() })

    const result = await checkDailyStudyLimit('user-1')

    // Counter is from yesterday — effectively 0 today
    expect(result.allowed).toBe(true)
    expect(result.usedMinutes).toBe(0)
    expect(result.remainingMinutes).toBe(DAILY_STUDY_LIMIT_MINUTES.free)
  })

  it('should treat null lastStudySessionDate as 0 minutes used today', async () => {
    mockIsPremium.mockResolvedValue(false)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 0, lastStudySessionDate: null })

    const result = await checkDailyStudyLimit('user-1')

    expect(result.allowed).toBe(true)
    expect(result.usedMinutes).toBe(0)
  })

  it('should return allowed=true and fail-open when DB throws', async () => {
    mockIsPremium.mockResolvedValue(false)
    mockFindUnique.mockRejectedValue(new Error('DB error'))

    const result = await checkDailyStudyLimit('user-1')

    expect(result.allowed).toBe(true)
  })

  it('should return allowed=false when user record is not found', async () => {
    mockIsPremium.mockResolvedValue(false)
    mockFindUnique.mockResolvedValue(null)

    const result = await checkDailyStudyLimit('user-1')

    // Returns fallback with allowed: false (cannot confirm capacity for unknown user)
    expect(result.allowed).toBe(false)
  })

  it('should return allowed=true when premium user has 59 of 60 minutes used', async () => {
    mockIsPremium.mockResolvedValue(true)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 59, lastStudySessionDate: todayNoon() })

    const result = await checkDailyStudyLimit('user-1')

    expect(result.allowed).toBe(true)
    expect(result.remainingMinutes).toBe(1)
  })

  it('should return allowed=false when premium user has used exactly 60 minutes today', async () => {
    mockIsPremium.mockResolvedValue(true)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 60, lastStudySessionDate: todayNoon() })

    const result = await checkDailyStudyLimit('user-1')

    expect(result.allowed).toBe(false)
    expect(result.remainingMinutes).toBe(0)
  })

  it('should include a future resetAt timestamp', async () => {
    mockIsPremium.mockResolvedValue(false)
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 0, lastStudySessionDate: null })

    const result = await checkDailyStudyLimit('user-1')

    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now())
  })
})

// ── updateDailyStudyTime ─────────────────────────────────────────────────────

describe('updateDailyStudyTime', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should increment todayStudyMinutes when last session was today', async () => {
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 10, lastStudySessionDate: todayNoon() })
    mockUpdate.mockResolvedValue({})

    await updateDailyStudyTime('user-1', 15)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ todayStudyMinutes: 25 }),
      }),
    )
  })

  it('should reset todayStudyMinutes to minutesSpent when last session was yesterday', async () => {
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 30, lastStudySessionDate: yesterdayNoon() })
    mockUpdate.mockResolvedValue({})

    await updateDailyStudyTime('user-1', 12)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ todayStudyMinutes: 12 }),
      }),
    )
  })

  it('should set lastStudySessionDate to now', async () => {
    mockFindUnique.mockResolvedValue({ todayStudyMinutes: 0, lastStudySessionDate: null })
    mockUpdate.mockResolvedValue({})

    const before = Date.now()
    await updateDailyStudyTime('user-1', 5)
    const after = Date.now()

    const callArgs = mockUpdate.mock.calls[0][0]
    const savedDate: Date = callArgs.data.lastStudySessionDate
    expect(savedDate.getTime()).toBeGreaterThanOrEqual(before)
    expect(savedDate.getTime()).toBeLessThanOrEqual(after)
  })

  it('should do nothing when minutesSpent is 0', async () => {
    await updateDailyStudyTime('user-1', 0)

    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should swallow DB errors without throwing', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB down'))

    await expect(updateDailyStudyTime('user-1', 10)).resolves.toBeUndefined()
  })
})

// ── resetDailyStudyTime ──────────────────────────────────────────────────────

describe('resetDailyStudyTime', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update todayStudyMinutes to 0 for the given user', async () => {
    mockUpdate.mockResolvedValue({})

    await resetDailyStudyTime('user-1')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { todayStudyMinutes: 0 },
    })
  })

  it('should swallow DB errors without throwing', async () => {
    mockUpdate.mockRejectedValue(new Error('DB error'))

    await expect(resetDailyStudyTime('user-1')).resolves.toBeUndefined()
  })
})
