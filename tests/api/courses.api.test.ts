jest.useFakeTimers()

// inject a mock Prisma client into API modules by setting global.__TEST_PRISMA__
const mockPrisma: any = { coursePackage: { findMany: jest.fn(), findUnique: jest.fn() } }
;(global as any).__TEST_PRISMA__ = mockPrisma

import * as listing from '../../app/api/courses/route'
import * as versions from '../../app/api/courses/[syllabusId]/route'
import * as single from '../../app/api/courses/[syllabusId]/[version]/route'

describe('courses API', () => {
  afterEach(() => jest.resetAllMocks())

  test('GET /api/courses returns latest per syllabus', async () => {
    const rows = [
      { syllabusId: 's1', version: 2, json: { title: 'T2' }, status: 'PUBLISHED' },
      { syllabusId: 's1', version: 1, json: { title: 'T1' }, status: 'PUBLISHED' },
      { syllabusId: 's2', version: 1, json: { title: 'S2' }, status: 'PUBLISHED' }
    ]
    ;(mockPrisma.coursePackage.findMany as jest.Mock).mockResolvedValue(rows)

    const res = await listing.GET()
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.find((d: any) => d.syllabusId === 's1').latestVersion).toBe(2)
  })

  test('GET /api/courses/:syllabusId returns versions or 404', async () => {
    ;(mockPrisma.coursePackage.findMany as jest.Mock).mockResolvedValue([{ version: 3 }, { version: 2 }])
    const res = await versions.GET(undefined as any, { params: { syllabusId: 's1' } } as any)
    const data = await res.json()
    expect(data.syllabusId).toBe('s1')
    expect(data.versions).toEqual([3,2])

    ;(mockPrisma.coursePackage.findMany as jest.Mock).mockResolvedValue([])
    const res2 = await versions.GET(undefined as any, { params: { syllabusId: 'missing' } } as any)
    expect(res2.status).toBe(404)
  })

  test('GET /api/courses/:syllabusId/:version returns package or 404', async () => {
    ;(mockPrisma.coursePackage.findUnique as jest.Mock).mockResolvedValue({ syllabusId: 's1', version: 1, status: 'PUBLISHED', json: { foo: 'bar' } })
    const res = await single.GET(undefined as any, { params: { syllabusId: 's1', version: '1' } } as any)
    const data = await res.json()
    expect(data).toEqual({ foo: 'bar' })

    ;(mockPrisma.coursePackage.findUnique as jest.Mock).mockResolvedValue(null)
    const res2 = await single.GET(undefined as any, { params: { syllabusId: 's1', version: '9' } } as any)
    expect(res2.status).toBe(404)
  })
})
