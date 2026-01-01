jest.useFakeTimers()

// inject mock Prisma
const mockPrisma: any = { coursePackage: { findMany: jest.fn(), findFirst: jest.fn() }, product: { findFirst: jest.fn() }, purchase: { findFirst: jest.fn() } }
;(global as any).__TEST_PRISMA__ = mockPrisma

import * as listing from '../../app/api/learn/courses/route'
import * as course from '../../app/api/learn/courses/[courseId]/route'
import * as lesson from '../../app/api/learn/courses/[courseId]/lessons/[index]/route'

describe('learn APIs', () => {
  afterEach(() => jest.resetAllMocks())

  test('GET /api/learn/courses lists latest published', async () => {
    const rows = [
      { syllabusId: 'c1', version: 2, json: { title: 'C2' }, status: 'PUBLISHED' },
      { syllabusId: 'c1', version: 1, json: { title: 'C1' }, status: 'PUBLISHED' },
      { syllabusId: 'c2', version: 1, json: { title: 'Other' }, status: 'PUBLISHED' }
    ]
    ;(mockPrisma.coursePackage.findMany as jest.Mock).mockResolvedValue(rows)

    const res = await listing.GET()
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.find((d: any) => d.courseId === 'c1').version).toBe(2)
  })

  test('GET /api/learn/courses/:courseId returns json or 404', async () => {
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ json: { foo: 'bar' } })
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const res = await course.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    const data = await res.json()
    expect(data).toEqual({ foo: 'bar' })

    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue(null)
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const res2 = await course.GET(new Request('http://localhost') as any, { params: { courseId: 'missing' } } as any)
    expect(res2.status).toBe(404)
  })

  test('GET lesson returns a lesson by index', async () => {
    const pkg = {
      modules: [
        { moduleId: 'm1', lessons: [{ lessonIndex: 1, id: 'l1', title: 'L1' }] },
        { moduleId: 'm2', lessons: [{ lessonIndex: 2, id: 'l2', title: 'L2' }] }
      ]
    }
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ json: pkg })
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    // Simulate a PublishedOutput pointing to a RegenerationOutput so learners
    // receive promoted content only.
    ;(mockPrisma.publishedOutput = { findUnique: jest.fn().mockResolvedValue({ outputRef: 'o1' }) })
    ;(mockPrisma.regenerationOutput = { findUnique: jest.fn().mockResolvedValue({ id: 'o1', contentJson: { id: 'l2', title: 'L2 promoted' } }) })

    const res = await lesson.GET(new Request('http://localhost') as any, { params: { courseId: 'c1', index: '2' } } as any)
    const data = await res.json()
    expect(data.id).toBe('l2')

    const res2 = await lesson.GET(new Request('http://localhost') as any, { params: { courseId: 'c1', index: '99' } } as any)
    expect(res2.status).toBe(404)
  })
})
