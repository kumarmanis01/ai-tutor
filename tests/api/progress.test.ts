jest.useFakeTimers()

const mockPrisma: any = {
  coursePackage: { findFirst: jest.fn() },
  enrollment: { create: jest.fn(), findFirst: jest.fn() },
  lessonProgress: { upsert: jest.fn(), findMany: jest.fn() },
  product: { findFirst: jest.fn() },
  purchase: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() }
}
;(global as any).__TEST_PRISMA__ = mockPrisma

import * as enroll from '../../app/api/learn/enroll/route'
import * as progress from '../../app/api/learn/progress/route'
import * as progressGet from '../../app/api/learn/progress/[courseId]/route'

describe('progress APIs', () => {
  afterEach(() => jest.resetAllMocks())

  test('POST /api/learn/enroll creates enrollment when published', async () => {
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' })
    ;(mockPrisma.enrollment.create as jest.Mock).mockResolvedValue({ id: 'e1' })

    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ courseId: 'c1' }), headers: { 'Content-Type': 'application/json' } })
    const res = await enroll.POST(req as any)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.enrollment.create).toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  test('POST /api/learn/progress upserts progress when enrolled', async () => {
    ;(mockPrisma.enrollment.findFirst as jest.Mock).mockResolvedValue({ id: 'e1' })
    ;(mockPrisma.lessonProgress.upsert as jest.Mock).mockResolvedValue({ id: 'lp1' })

    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ courseId: 'c1', lessonIdx: 1, completed: true }), headers: { 'Content-Type': 'application/json' } })
    const res = await progress.POST(req as any)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.lessonProgress.upsert).toHaveBeenCalled()
  })

  test('GET /api/learn/progress/:courseId returns progress for user', async () => {
    ;(mockPrisma.lessonProgress.findMany as jest.Mock).mockResolvedValue([{ id: 'lp1' }])
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const fakeReq = new Request('http://localhost')
    const res = await progressGet.GET(fakeReq as any, { params: { courseId: 'c1' } } as any)
    const data = await res.json()
    expect(Array.isArray(data.progress)).toBe(true)
  })
})
