/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/parent/dashboard focusing on timezone dual-display behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/parent/dashboard/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | add timezone tests for parent dashboard API
 */

describe('GET /api/parent/dashboard — timezone display', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('includes studentTimezone and parentTimezone when they differ', async () => {
    jest.doMock('next-auth/next', () => ({
      getServerSession: async () => ({ user: { id: 'parent1', role: 'parent' } }),
    }))

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: async () => null, set: async () => {} }) }))

    jest.doMock('@/lib/prisma', () => ({ prisma: {
      parentStudent: { findMany: async () => [ { studentId: 's1', student: { id: 's1', name: 'Child One', image: null, grade: '8', board: 'CBSE', subjects: [], timezone: 'Europe/London' } } ] },
      weeklyStudentSummary: { findMany: async () => [] },
      subjectProgressSummary: { findMany: async () => [] },
      readinessStatus: { findMany: async () => [] },
      attentionFlag: { groupBy: async () => [] },
      studentTopicMastery: { groupBy: async () => [] },
      learningSession: { groupBy: async () => [] },
      user: { findUnique: async () => ({ timezone: 'Asia/Kolkata' }) },
    } }))

    const route = await import('@/app/api/parent/dashboard/route')

    const req = new Request('http://localhost', { method: 'GET' })

    const res: any = await route.GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.students.length).toBeGreaterThan(0)
    expect(body.students[0].studentTimezone).toBe('Europe/London')
    expect(body.students[0].parentTimezone).toBe('Asia/Kolkata')
  })

  it('does not include timezone fields when timezones equal', async () => {
    jest.doMock('next-auth/next', () => ({
      getServerSession: async () => ({ user: { id: 'parent2', role: 'parent' } }),
    }))

    jest.doMock('@/lib/redis', () => ({ getRedis: () => ({ get: async () => null, set: async () => {} }) }))

    jest.doMock('@/lib/prisma', () => ({ prisma: {
      parentStudent: { findMany: async () => [ { studentId: 's2', student: { id: 's2', name: 'Child Two', image: null, grade: '9', board: 'CBSE', subjects: [], timezone: 'Asia/Kolkata' } } ] },
      weeklyStudentSummary: { findMany: async () => [] },
      subjectProgressSummary: { findMany: async () => [] },
      readinessStatus: { findMany: async () => [] },
      attentionFlag: { groupBy: async () => [] },
      studentTopicMastery: { groupBy: async () => [] },
      learningSession: { groupBy: async () => [] },
      user: { findUnique: async () => ({ timezone: 'Asia/Kolkata' }) },
    } }))

    const route = await import('@/app/api/parent/dashboard/route')

    const req = new Request('http://localhost', { method: 'GET' })

    const res: any = await route.GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.students.length).toBeGreaterThan(0)
    expect(body.students[0].studentTimezone).toBeUndefined()
    expect(body.students[0].parentTimezone).toBeUndefined()
  })

})
