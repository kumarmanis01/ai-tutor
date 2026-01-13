import { clearExportRateLimits } from '@/lib/rateLimit/exportLimiter'

describe('Export rate limiting (course exports)', () => {
  beforeEach(() => {
    clearExportRateLimits()
  })

  it('allows 3 LMS exports then rate limits the 4th', async () => {
    const mockPrisma: any = {
      coursePackage: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1', json: { title: 'T' } }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
      enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      auditLog: { create: jest.fn() }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const route = await import('../../app/api/learn/courses/[courseId]/export/lms/route')
    // 3 allowed
    for (let i = 0; i < 3; i++) {
      const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
      expect(res.status).toBe(200)
    }
    // 4th blocked
    const res4 = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res4.status).toBe(429)
    expect(res4.headers.get('Retry-After')).toBeTruthy()
  })

  it('allows 3 PDF exports then rate limits the 4th', async () => {
    const mockPrisma: any = {
      coursePackage: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1', json: { title: 'T' } }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      purchase: { findFirst: jest.fn().mockResolvedValue(null) },
      enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      auditLog: { create: jest.fn() }
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const route = await import('../../app/api/learn/courses/[courseId]/export/pdf/route')
    for (let i = 0; i < 3; i++) {
      const res = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
      expect(res.status).toBe(200)
    }
    const res4 = await route.GET(new Request('http://localhost') as any, { params: { courseId: 'c1' } } as any)
    expect(res4.status).toBe(429)
    expect(res4.headers.get('Retry-After')).toBeTruthy()
  })
})
