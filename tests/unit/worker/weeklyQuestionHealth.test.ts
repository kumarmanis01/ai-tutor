/**
 * Unit tests for weeklyQuestionHealth
 */

// Prisma mock
const prismaMock = {
  question: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  topicDef: {
    findMany: jest.fn(),
  },
  analyticsEvent: {
    create: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
jest.mock('@/lib/prisma.js', () => ({ prisma: prismaMock }))
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

import { runWeeklyQuestionHealth } from '@/worker/jobs/weeklyQuestionHealth'

beforeEach(() => {
  jest.resetAllMocks()
})

it('creates analytics event and returns low topic count when topic below threshold', async () => {
  (prismaMock.question.count as jest.Mock).mockResolvedValue(10)
  ;(prismaMock.question.groupBy as jest.Mock).mockResolvedValue([
    { topicId: 't-1', _count: { id: 3 } },
    { topicId: 't-2', _count: { id: 8 } },
  ])
  ;(prismaMock.topicDef.findMany as jest.Mock).mockResolvedValue([{ id: 't-1', name: 'Algebra' }])
  ;(prismaMock.analyticsEvent.create as jest.Mock).mockResolvedValue({ id: 'evt-1' })

  const lowCount = await runWeeklyQuestionHealth()

  expect(lowCount).toBe(1)
  expect(prismaMock.analyticsEvent.create).toHaveBeenCalledTimes(1)
  const created = (prismaMock.analyticsEvent.create as jest.Mock).mock.calls[0][0]
  expect(created.data.eventType).toBe('weekly_question_health')
  expect(created.data.metadata.lowTopics.length).toBe(1)
})
