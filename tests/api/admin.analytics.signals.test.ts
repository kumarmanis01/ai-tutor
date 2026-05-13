/**
 * FILE OBJECTIVE:
 * - Unit tests for the admin analytics signals route.
 * - Validates signal event retrieval and sanitized response shape.
 *
 * LINKED UNIT TEST:
 * - tests/api/admin.analytics.signals.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate mock from analyticsSignal to analyticsEvent; add FILE OBJECTIVE header
 */

describe('Admin analytics signals API', () => {
  it('returns signals for admin', async () => {
    const mockPrisma: any = {
      analyticsEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            courseId: 'c1',
            eventType: 'signal.low_completion_rate',
            metadata: { type: 'LOW_COMPLETION_RATE', severity: 'CRITICAL', completionRate: 0.1 },
            createdAt: new Date('2025-12-21'),
          }
        ])
      }
    }

    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'admin1', role: 'admin' } }

    const route = await import('../../app/api/admin/analytics/signals/route')
    const res = await route.GET(new Request('http://localhost/?courseId=c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.signals)).toBe(true)
    expect(body.signals[0].type).toBe('LOW_COMPLETION_RATE')
  })

  it('forbids non-admins', async () => {
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', role: 'student' } }
    const route = await import('../../app/api/admin/analytics/signals/route')
    const res = await route.GET(new Request('http://localhost/'))
    expect(res.status).toBe(403)
  })
})
