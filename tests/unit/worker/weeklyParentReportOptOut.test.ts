/**
 * FILE OBJECTIVE:
 * - Verify that `ParentStudent.excludeFromParentReport` is respected by weekly
 *   aggregation and parent digest notification jobs.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/weeklyParentReportOptOut.test.ts
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | add tests for excludeFromParentReport behaviour
 */

import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

beforeEach(() => {
  resetPrismaMock()
  jest.clearAllMocks()
  prismaMock.adminConfig.findUnique.mockResolvedValue(null)
  prismaMock.learningSession.findMany.mockResolvedValue([])
  prismaMock.testResult.findMany.mockResolvedValue([])
  prismaMock.studentTopicMastery.findMany.mockResolvedValue([])
  prismaMock.weeklyStudentSummary.upsert.mockResolvedValue({})
  prismaMock.weeklyStudentSummary.findMany.mockResolvedValue([])

  // Ensure additional models used by sendParentDigests have safe defaults
  prismaMock.attentionFlag.findMany.mockResolvedValue([])
  prismaMock.readinessStatus.findMany.mockResolvedValue([])
  prismaMock.studentStreak.findMany.mockResolvedValue([])
  prismaMock.parentStudent.findMany.mockResolvedValue([])
})

describe('weekly parent report opt-out', () => {
  it('aggregateWeeklySummaries queries parentStudent with excludeFromParentReport filter', async () => {
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([])

    const mod = await import('@/worker/jobs/weeklyParentSummary')
    await mod.aggregateWeeklySummaries()

    expect(prismaMock.parentStudent.findMany).toHaveBeenCalled()
    const calledWith = prismaMock.parentStudent.findMany.mock.calls[0][0]
    expect(calledWith).toHaveProperty('where')
    expect(calledWith.where).toMatchObject({ status: 'active', excludeFromParentReport: false })
  })

  it('sendParentDigests queries parentStudent with excludeFromParentReport filter', async () => {
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([])

    const mod = await import('@/worker/jobs/parentEmailDigest')
    await mod.sendParentDigests()

    expect(prismaMock.parentStudent.findMany).toHaveBeenCalled()
    const calledWith = prismaMock.parentStudent.findMany.mock.calls[0][0]
    expect(calledWith).toHaveProperty('where')
    expect(calledWith.where).toMatchObject({ status: 'active', excludeFromParentReport: false })
  })
})
