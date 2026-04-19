/**
 * FILE OBJECTIVE:
 * - API endpoint to compute LTV/CAC using on-chain MRR data and recorded marketing spend.
 * - Returns MRR, ARPU, churn, LTV, CAC and LTV/CAC ratio for the current month by default.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/metrics_ltv_cac.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | senior-engineer | add LTV/CAC metrics endpoint
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  const start = Date.now()
  try {
    // For MVP use month-to-date window. Future: accept start/end query params.
    const sql = `
WITH last_paid AS (
  SELECT i."subscriptionId", i.amount, s."billingCycle"
  FROM "Installment" i
  JOIN "Subscription" s ON s.id = i."subscriptionId"
  WHERE i."paidAt" IS NOT NULL
    AND i."paidAt" = (
      SELECT MAX(ii."paidAt") FROM "Installment" ii WHERE ii."subscriptionId" = i."subscriptionId" AND ii."paidAt" IS NOT NULL
    )
), mrr AS (
  SELECT COALESCE(SUM(
    CASE WHEN lp."billingCycle" = 'annual' THEN (lp.amount::numeric / 12.0) ELSE lp.amount::numeric END
  ),0) AS mrr_paise,
  COUNT(DISTINCT lp."subscriptionId") AS active_subscriptions
  FROM last_paid lp
  JOIN "Subscription" s ON s.id = lp."subscriptionId"
  WHERE s.active = true
), active_counts AS (
  SELECT COUNT(*) AS active_start FROM "Subscription" s
  WHERE s."startDate" <= date_trunc('month', now()) AND (s."endDate" IS NULL OR s."endDate" >= date_trunc('month', now()))
), churns AS (
  SELECT COUNT(*) AS cancelled_this_month FROM "Subscription" s
  WHERE s."endDate" >= date_trunc('month', now()) AND s."endDate" < date_trunc('month', now()) + interval '1 month'
), marketing AS (
  SELECT COALESCE(SUM("amount"),0) AS marketing_spend_paise FROM "MarketingSpend" ms
  WHERE ms."periodStart" >= date_trunc('month', now()) AND ms."periodEnd" < date_trunc('month', now()) + interval '1 month'
), nc AS (
  SELECT COUNT(*) as new_customers FROM "Subscription" s
  WHERE s."startDate" >= date_trunc('month', now()) AND s."startDate" < date_trunc('month', now()) + interval '1 month'
)
SELECT
  mrr.mrr_paise,
  mrr.active_subscriptions,
  CASE WHEN mrr.active_subscriptions = 0 THEN 0 ELSE (mrr.mrr_paise::numeric / NULLIF(mrr.active_subscriptions,0)) END AS arpu_paise,
  ac.active_start AS active_start_count,
  ch.cancelled_this_month AS cancelled_this_month,
  CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END AS churn_rate,
  CASE WHEN (CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END) > 0
       THEN (1.0 / (CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END))
       ELSE 12.0 END AS lifetime_months,
  (CASE WHEN mrr.active_subscriptions = 0 THEN 0 ELSE (mrr.mrr_paise::numeric / NULLIF(mrr.active_subscriptions,0)) END) *
    (CASE WHEN (CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END) > 0
      THEN (1.0 / (CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END))
      ELSE 12.0 END) AS ltv_paise,
  marketing.marketing_spend_paise,
  nc.new_customers,
  CASE WHEN nc.new_customers = 0 THEN NULL ELSE (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0)) END AS cac_paise,
  CASE WHEN (CASE WHEN nc.new_customers = 0 THEN NULL ELSE (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0)) END) IS NULL OR (CASE WHEN nc.new_customers = 0 THEN NULL ELSE (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0)) END) = 0
       THEN NULL
       ELSE ((CASE WHEN mrr.active_subscriptions = 0 THEN 0 ELSE (mrr.mrr_paise::numeric / NULLIF(mrr.active_subscriptions,0)) END) *
              (CASE WHEN (CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END) > 0
         THEN (1.0 / (CASE WHEN ac.active_start = 0 THEN 0 ELSE (ch.cancelled_this_month::numeric / NULLIF(ac.active_start,0)) END))
         ELSE 12.0 END)) /
         (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0))
  END AS ltv_cac_ratio
FROM mrr CROSS JOIN active_counts ac CROSS JOIN churns ch CROSS JOIN marketing CROSS JOIN nc;
    `

    // Execute raw SQL. Tests mock prisma so this call is unit-test friendly.
    const res: any = await (prisma as any).$queryRaw(sql)
    const row = Array.isArray(res) ? res[0] ?? {} : res

    const metrics = {
      mrr_paise: Number(row.mrr_paise ?? 0),
      mrr_inr: Number((Number(row.mrr_paise ?? 0) / 100).toFixed(2)),
      active_subscriptions: Number(row.active_subscriptions ?? 0),
      arpu_paise: Number(row.arpu_paise ?? 0),
      arpu_inr: Number(((Number(row.arpu_paise ?? 0) / 100) || 0).toFixed(2)),
      active_start_count: Number(row.active_start_count ?? 0),
      cancelled_this_month: Number(row.cancelled_this_month ?? 0),
      churn_rate: Number(row.churn_rate ?? 0),
      lifetime_months: Number(row.lifetime_months ?? 0),
      ltv_paise: Number(row.ltv_paise ?? 0),
      ltv_inr: Number((Number(row.ltv_paise ?? 0) / 100).toFixed(2)),
      marketing_spend_paise: Number(row.marketing_spend_paise ?? 0),
      marketing_spend_inr: Number((Number(row.marketing_spend_paise ?? 0) / 100).toFixed(2)),
      new_customers: Number(row.new_customers ?? 0),
      cac_paise: row.cac_paise == null ? null : Number(row.cac_paise),
      cac_inr: row.cac_paise == null ? null : Number((Number(row.cac_paise) / 100).toFixed(2)),
      ltv_cac_ratio: row.ltv_cac_ratio == null ? null : Number(Number(row.ltv_cac_ratio)),
    }

    const out = NextResponse.json({ ok: true, metrics }, { status: 200 })
    logger.logAPI(req, out, { className: 'AdminMetrics', methodName: 'GET_ltv_cac' }, start)
    return out
  } catch (err: any) {
    const msg = err && (err.message || String(err)) || 'metric query failed'
    const res = NextResponse.json({ error: msg }, { status: 500 })
    logger.logAPI(req, res, { className: 'AdminMetrics', methodName: 'GET_ltv_cac', error: msg }, start)
    return res
  }
}
