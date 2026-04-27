import { clearExportRateLimits } from '@/lib/rateLimit/exportLimiter'

describe('CoursePackage size guard for exports', () => {
  beforeEach(() => {
    // clear any rate limits in case tests run in same process
    try { clearExportRateLimits() } catch {}
  })

  it('allows small package for LMS export and PDF export', async () => {
    const smallPkg = { title: 'T', modules: [] }
    const mockPrisma: any = {
      coursePackage: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1', json: smallPkg }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
      enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      auditLog: { create: jest.fn() }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const lms = await import('../../app/api/learn/courses/[courseId]/export/lms/route')
    const res1 = await lms.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res1.status).toBe(200)

    const pdf = await import('../../app/api/learn/courses/[courseId]/export/pdf/route')
    const res2 = await pdf.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res2.status).toBe(200)
  })

  it('rejects oversized package with 413 for both exporters', async () => {
    // create oversized JSON by making a big string
    const bigString = 'x'.repeat(5_000_010)
    const bigPkg = { blob: bigString }
    const mockPrisma: any = {
      coursePackage: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1', json: bigPkg }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
      enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      auditLog: { create: jest.fn() }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const lms = await import('../../app/api/learn/courses/[courseId]/export/lms/route')
    const res1 = await lms.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res1.status).toBe(413)
    const body1 = JSON.parse(await res1.text())
    expect(body1.error).toContain('too large')

    const pdf = await import('../../app/api/learn/courses/[courseId]/export/pdf/route')
    const res2 = await pdf.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res2.status).toBe(413)
    const body2 = JSON.parse(await res2.text())
    expect(body2.error).toContain('too large')
  })
})
