/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/surprise-me
 *
 * LINKED UNIT TEST:
 * - tests/unit/student/surpriseMe.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-06T00:00:00Z | copilot | update mocks/assertions for concept-based surprise action and graceful 204 fallback
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    studentTopicProgress: { findFirst: jest.fn() },
    concept: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/homeEngine/getOrderedTopicsForStudent', () => ({
  getOrderedTopicsForStudent: jest.fn(),
}))

jest.mock('@/lib/recommendations/topicRanker', () => ({
  rankTopics: jest.fn(),
}))

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

import { GET } from '@/app/api/student/surprise-me/route'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent'
import { rankTopics } from '@/lib/recommendations/topicRanker'

const mockPrisma = prisma as unknown as {
  studentTopicProgress: { findFirst: jest.Mock }
  concept: { findFirst: jest.Mock }
}
const mockGetSession = getServerSessionForHandlers as jest.Mock
const mockGetOrderedTopicsForStudent = getOrderedTopicsForStudent as jest.Mock
const mockRankTopics = rankTopics as jest.Mock

describe('GET /api/student/surprise-me', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new Request('http://localhost/api/student/surprise-me')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBeDefined()
  })

  it('returns a weak topic when present', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } })

    mockPrisma.studentTopicProgress.findFirst.mockResolvedValueOnce({
      id: 'p1',
      topic: {
        id: 'topic-1',
        name: 'Fractions',
        chapter: { name: 'Numbers', subject: { name: 'Math' } },
      },
    })
    mockPrisma.concept.findFirst.mockResolvedValueOnce({ id: 'concept-1' })

    const req = new Request('http://localhost/api/student/surprise-me')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.action).toBeDefined()
    expect(body.action.topicId).toBe('concept-1')
    expect(body.source).toBe('surprise_me')
  })

  it('returns 204 with empty action when ranker throws', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.studentTopicProgress.findFirst.mockResolvedValueOnce(null)
    mockGetOrderedTopicsForStudent.mockRejectedValueOnce(new Error('rank source failed'))
    mockRankTopics.mockResolvedValueOnce([])

    const req = new Request('http://localhost/api/student/surprise-me')
    const res = await GET(req as any)

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })
})
