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

// Prisma mock
const prismaMock = {
  adminConfig: { findUnique: jest.fn() },
  parentStudent: { findMany: jest.fn(), findFirst: jest.fn() },
  learningSession: { findMany: jest.fn() },
  testResult: { findMany: jest.fn() },
  studentTopicMastery: { findMany: jest.fn() },
  weeklyStudentSummary: { upsert: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

beforeEach(() => {
  jest.clearAllMocks()
  prismaMock.adminConfig.findUnique.mockResolvedValue(null)
  prismaMock.learningSession.findMany.mockResolvedValue([])
  prismaMock.testResult.findMany.mockResolvedValue([])
  prismaMock.studentTopicMastery.findMany.mockResolvedValue([])
  prismaMock.weeklyStudentSummary.upsert.mockResolvedValue({})
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
