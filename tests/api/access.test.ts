const mockPrisma: any = {
  coursePackage: { findFirst: jest.fn() },
  product: { findFirst: jest.fn() },
  purchase: { findFirst: jest.fn() },
  enrollment: { findFirst: jest.fn() }
}
;(global as any).__TEST_PRISMA__ = mockPrisma

import * as course from '../../app/api/learn/courses/[courseId]/route'
import * as lesson from '../../app/api/learn/courses/[courseId]/lessons/[index]/route'

describe('access guards', () => {
  afterEach(() => jest.resetAllMocks())

  test('GET course returns 403 when monetized and no purchase/enrollment', async () => {
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ json: { title: 'C' } })
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'prod1', courseId: 'c1', active: true })
    ;(mockPrisma.purchase.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.enrollment.findFirst as jest.Mock).mockResolvedValue(null)
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const res = await course.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res.status).toBe(403)
  })

  test('GET lesson allowed when purchase exists', async () => {
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ json: { modules: [{ lessons: [{ lessonIndex: 1, id: 'l1', title: 'L1' }] }] } })
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'prod1', courseId: 'c1', active: true })
    ;(mockPrisma.purchase.findFirst as jest.Mock).mockResolvedValue({ id: 'pu1' })
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const res = await lesson.GET(new Request('http://localhost') as any, { params: { courseId: 'c1', index: '1' } } as any)
    expect(res.status).not.toBe(403)
  })
})
