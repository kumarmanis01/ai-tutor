/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/admin/metrics/ltv-cac
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/metrics_ltv_cac.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | senior-engineer | add unit tests for ltv/cac endpoint
 */

describe('GET /api/admin/metrics/ltv-cac', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns computed metrics when DB returns a row', async () => {
    const dbRow = {
      mrr_paise: 500000,
      active_subscriptions: 100,
      arpu_paise: 5000,
      active_start_count: 120,
      cancelled_this_month: 2,
      churn_rate: 0.0166666667,
      lifetime_months: 60,
      ltv_paise: 300000,
      marketing_spend_paise: 100000,
      new_customers: 50,
      cac_paise: 2000,
      ltv_cac_ratio: 150.0,
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: { $queryRaw: async () => [dbRow] } }))

    const route = await import('@/app/api/admin/metrics/ltv-cac/route')
    const req = new Request('http://localhost')
    const res: any = await route.GET(req as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.metrics).toBeDefined()
    expect(body.metrics.mrr_paise).toBe(500000)
    expect(body.metrics.mrr_inr).toBe(5000)
    expect(body.metrics.active_subscriptions).toBe(100)
    expect(body.metrics.new_customers).toBe(50)
    expect(body.metrics.cac_paise).toBe(2000)
    expect(body.metrics.cac_inr).toBe(20)
    expect(body.metrics.ltv_cac_ratio).toBe(150)
  })

  it('handles zero new customers (CAC null)', async () => {
    const dbRow = {
      mrr_paise: 100000,
      active_subscriptions: 10,
      arpu_paise: 10000,
      active_start_count: 10,
      cancelled_this_month: 0,
      churn_rate: 0,
      lifetime_months: 12,
      ltv_paise: 120000,
      marketing_spend_paise: 50000,
      new_customers: 0,
      cac_paise: null,
      ltv_cac_ratio: null,
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: { $queryRaw: async () => [dbRow] } }))

    const route = await import('@/app/api/admin/metrics/ltv-cac/route')
    const req = new Request('http://localhost')
    const res: any = await route.GET(req as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.metrics.cac_paise).toBeNull()
    expect(body.metrics.ltv_cac_ratio).toBeNull()
  })
})
