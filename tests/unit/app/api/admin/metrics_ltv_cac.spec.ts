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
 * - 2026-06-09T00:00:00Z | claude | convert jest.doMock+await import to standard jest.mock (CJS)
 * - 2026-04-17T00:00:00Z | senior-engineer | add unit tests for ltv/cac endpoint
 */

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))

jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET } from '@/app/api/admin/metrics/ltv-cac/route'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const mockGetSession = getServerSessionForHandlers as jest.Mock
const mockQueryRaw = (prisma as any).$queryRaw as jest.Mock

describe('GET /api/admin/metrics/ltv-cac', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { role: 'admin' } })
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

    mockQueryRaw.mockResolvedValue([dbRow])

    const req = new Request('http://localhost')
    const res: any = await GET(req as any)

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

    mockQueryRaw.mockResolvedValue([dbRow])

    const req = new Request('http://localhost')
    const res: any = await GET(req as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.metrics.cac_paise).toBeNull()
    expect(body.metrics.ltv_cac_ratio).toBeNull()
  })
})
