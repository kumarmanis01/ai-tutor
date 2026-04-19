/**
 * FILE OBJECTIVE:
 * - Job to compute and persist a snapshot of LTV/CAC and related metrics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/metricsSnapshot.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | senior-engineer | add metrics snapshot job
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function runSnapshot(createdBy?: string) {
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

  try {
    const res: any = await (prisma as any).$queryRaw(sql)
    const row = Array.isArray(res) ? res[0] ?? {} : res

    const snapshot = await prisma.ltvSnapshot.create({ data: {
      snapshotAt: new Date(),
      windowStart: null,
      windowEnd: null,
      mrr_paise: Number(row.mrr_paise ?? 0),
      active_subscriptions: Number(row.active_subscriptions ?? 0),
      arpu_paise: Number(row.arpu_paise ?? 0),
      ltv_paise: Number(row.ltv_paise ?? 0),
      marketing_spend_paise: Number(row.marketing_spend_paise ?? 0),
      new_customers: Number(row.new_customers ?? 0),
      cac_paise: row.cac_paise == null ? null : Number(row.cac_paise),
      ltv_cac_ratio: row.ltv_cac_ratio == null ? null : Number(row.ltv_cac_ratio),
      createdBy: createdBy ?? null,
    } })

    return snapshot
  } catch (err: any) {
    logger.error('metricsSnapshot: failed', { err: (err && err.message) || err })
    throw err
  }
}

export default { runSnapshot }
