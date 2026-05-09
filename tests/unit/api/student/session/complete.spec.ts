/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/session/[sessionId]/complete route.
 * - Covers: Gap 3 fix — meta.score written to StructuredSession, non-fatal error
 *   path when write fails, and baseline happy-path response shape.
 *
 * LINKED UNIT TEST:
 * - (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created for Gap 3 fix
 */

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    learningSession: { findFirst: jest.fn() },
    answerEvent: { count: jest.fn(), findFirst: jest.fn() },
    aITutorTurnLog: { count: jest.fn() },
    studentConceptState: { findUnique: jest.fn() },
    concept: { findUnique: jest.fn() },
    structuredSession: { findUnique: jest.fn(), update: jest.fn() },
  },
}))
jest.mock('@/lib/student/xp', () => ({ awardXP: jest.fn() }))
jest.mock('@/lib/student/streak', () => ({ updateStreak: jest.fn() }))
jest.mock('@/lib/student/sessionInsight', () => ({ buildSessionInsight: jest.fn() }))
jest.mock('@/lib/student/badges', () => ({ checkSessionBadges: jest.fn() }))
jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import { POST } from '@/app/api/student/session/[sessionId]/complete/route'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { awardXP } from '@/lib/student/xp'
import { updateStreak } from '@/lib/student/streak'
import { buildSessionInsight } from '@/lib/student/sessionInsight'
import { checkSessionBadges } from '@/lib/student/badges'
import { logger } from '@/lib/logger'

// ─── helpers ────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-001'
const SESSION_ID = 'ls-001'
const STRUCTURED_ID = 'ss-001'
const NOW = new Date('2026-05-09T10:00:00Z')
const STARTED = new Date('2026-05-09T09:45:00Z') // 15 min earlier

function makeLearningSession(structuredSessionId?: string) {
  return {
    startedAt: STARTED,
    endedAt: NOW,
    meta: structuredSessionId ? { structuredSessionId, preSessionMastery: 0.3 } : {},
  }
}

function buildRequest() {
  return new Request('http://localhost/api/student/session/' + SESSION_ID + '/complete', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

function buildParams() {
  return { params: Promise.resolve({ sessionId: SESSION_ID }) }
}

function setupMocksForHappyPath(structuredSessionId?: string) {
  ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: STUDENT_ID } })
  ;(prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(
    makeLearningSession(structuredSessionId),
  )
  ;(prisma.answerEvent.count as jest.Mock)
    .mockResolvedValueOnce(8)  // correctAnswers
    .mockResolvedValueOnce(10) // totalQuestions
  ;(prisma.aITutorTurnLog.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.answerEvent.findFirst as jest.Mock).mockResolvedValue({ conceptId: 'c-001' })
  ;(prisma.studentConceptState.findUnique as jest.Mock).mockResolvedValue({ masteryScore: 0.5 })
  ;(prisma.concept.findUnique as jest.Mock).mockResolvedValue({ name: 'Algebra' })
  ;(awardXP as jest.Mock).mockResolvedValue({ totalXp: 500, leveledUp: false, newLevel: null })
  ;(updateStreak as jest.Mock).mockResolvedValue({ currentStreak: 3, streakIncremented: false })
  ;(buildSessionInsight as jest.Mock).mockResolvedValue('Great job today!')
  ;(checkSessionBadges as jest.Mock).mockResolvedValue([])
  ;(prisma.structuredSession.findUnique as jest.Mock).mockResolvedValue({
    meta: { existingKey: 'existingValue' },
  })
  ;(prisma.structuredSession.update as jest.Mock).mockResolvedValue({})
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('POST /api/student/session/[sessionId]/complete', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('Gap 3 fix — meta.score written to StructuredSession', () => {
    it('writes computed score (0-100) to StructuredSession.meta when structuredSessionId is present', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)

      const res = await POST(buildRequest(), buildParams())

      expect(res.status).toBe(200)
      // 8/10 correct → 80%
      expect(prisma.structuredSession.findUnique).toHaveBeenCalledWith({
        where: { id: STRUCTURED_ID },
        select: { meta: true },
      })
      expect(prisma.structuredSession.update).toHaveBeenCalledWith({
        where: { id: STRUCTURED_ID },
        data: {
          meta: {
            existingKey: 'existingValue',
            score: 80,
          },
        },
      })
    })

    it('preserves existing meta fields when writing score', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)
      ;(prisma.structuredSession.findUnique as jest.Mock).mockResolvedValue({
        meta: { archivedReason: 'completed', previousPhase: 'ACTIVE' },
      })

      await POST(buildRequest(), buildParams())

      expect(prisma.structuredSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            meta: expect.objectContaining({
              archivedReason: 'completed',
              previousPhase: 'ACTIVE',
              score: 80,
            }),
          },
        }),
      )
    })

    it('skips score write when learningSession has no structuredSessionId in meta', async () => {
      setupMocksForHappyPath(undefined) // no structuredSessionId

      const res = await POST(buildRequest(), buildParams())

      expect(res.status).toBe(200)
      expect(prisma.structuredSession.findUnique).not.toHaveBeenCalled()
      expect(prisma.structuredSession.update).not.toHaveBeenCalled()
    })

    it('does not write score when structuredSession record does not exist', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)
      ;(prisma.structuredSession.findUnique as jest.Mock).mockResolvedValue(null)

      const res = await POST(buildRequest(), buildParams())

      expect(res.status).toBe(200)
      expect(prisma.structuredSession.update).not.toHaveBeenCalled()
    })

    it('returns 200 and does not throw when score write fails (non-fatal)', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)
      ;(prisma.structuredSession.findUnique as jest.Mock).mockRejectedValue(
        new Error('DB connection lost'),
      )

      const res = await POST(buildRequest(), buildParams())

      expect(res.status).toBe(200)
      expect(logger.warn).toHaveBeenCalledWith(
        'StudentSessionCompleteAPI: failed to write score to StructuredSession.meta',
        expect.objectContaining({ event: 'session_score_write_error' }),
      )
    })

    it('computes score 0 when there are no questions', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)
        // Reset count mock so this test's values take priority
        ;(prisma.answerEvent.count as jest.Mock).mockReset()
          .mockResolvedValueOnce(0) // correctAnswers
          .mockResolvedValueOnce(0) // totalQuestions

      await POST(buildRequest(), buildParams())

      expect(prisma.structuredSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { meta: expect.objectContaining({ score: 0 }) },
        }),
      )
    })

    it('computes score 100 when all answers are correct', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)
        // Reset count mock so this test's values take priority
        ;(prisma.answerEvent.count as jest.Mock).mockReset()
          .mockResolvedValueOnce(5) // correctAnswers
          .mockResolvedValueOnce(5) // totalQuestions

      await POST(buildRequest(), buildParams())

      expect(prisma.structuredSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { meta: expect.objectContaining({ score: 100 }) },
        }),
      )
    })
  })

  describe('baseline response shape', () => {
    it('returns 401 when unauthenticated', async () => {
      ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue(null)

      const res = await POST(buildRequest(), buildParams())

      expect(res.status).toBe(401)
    })

    it('returns 404 when session not found for user', async () => {
      ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: STUDENT_ID } })
      ;(prisma.learningSession.findFirst as jest.Mock).mockResolvedValue(null)

      const res = await POST(buildRequest(), buildParams())

      expect(res.status).toBe(404)
    })

    it('returns 200 with expected fields in body', async () => {
      setupMocksForHappyPath(STRUCTURED_ID)

      const res = await POST(buildRequest(), buildParams())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toMatchObject({
        xpEarned: expect.any(Number),
        totalXp: expect.any(Number),
        leveledUp: false,
        newLevel: null,
        masteryDelta: expect.any(Number),
        masteryAfter: expect.any(Number),
        badgesEarned: [],
        aiInsight: 'Great job today!',
        sessionDurationMinutes: expect.any(Number),
        correctAnswers: 8,
        totalQuestions: 10,
      })
    })
  })
})
