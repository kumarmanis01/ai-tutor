import { exportCourseToLMS } from '@/lib/exporters/lms'

describe('LMS exporter', () => {
  it('creates a zip with index, lessons and manifest', () => {
    const pkg = {
      title: 'Test Course',
      modules: [
        { title: 'M1', lessons: [ { title: 'L1', objectives: ['o1'], explanation: { overview: 'ov1', concepts: [{ title: 'c1', explanation: 'ce1' }] } }, { title: 'L2' } ] }
      ]
    }
    const buf = exportCourseToLMS(pkg)
    expect(buf).toBeInstanceOf(Buffer)
    const s = buf.toString('utf8')
    expect(s).toContain('index.html')
    expect(s).toContain('lessons/lesson-01.html')
    expect(s).toContain('manifest.json')
    // manifest should contain course title
    expect(s).toContain('Test Course')
  })
  
  it('LMS export endpoint writes audit log', async () => {
    const mockPrisma: any = {
      coursePackage: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1', json: { title: 'T' } }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
      enrollment: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const route = await import('../../app/api/learn/courses/[courseId]/export/lms/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res.status).toBe(200)
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  it('cannot access LMS export for different tenant', async () => {
    const mockPrisma: any = {
      coursePackage: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1', json: { title: 'T' } }) },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'prod1', courseId: 'c1', tenantId: 'tenantX', active: true }) },
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
      enrollment: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', tenantId: 'tenantY' } }
    const route = await import('../../app/api/learn/courses/[courseId]/export/lms/route')
    const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res.status).toBe(403)
  })
})
