/**
 * FILE OBJECTIVE:
 * - Minimal admin dashboard page showing current LTV/CAC metrics and recent snapshots.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/metrics_ltv_cac_page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 */

import React from 'react';
import { prisma } from '@/lib/prisma';

async function fetchCurrentMetrics() {
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
  marketing.marketing_spend_paise,
  nc.new_customers,
  CASE WHEN nc.new_customers = 0 THEN NULL ELSE (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0)) END AS cac_paise,
  CASE WHEN (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0)) IS NULL OR (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0)) = 0
    THEN NULL
    ELSE ((CASE WHEN mrr.active_subscriptions = 0 THEN 0 ELSE (mrr.mrr_paise::numeric / NULLIF(mrr.active_subscriptions,0)) END) * 12.0) / (marketing.marketing_spend_paise::numeric / NULLIF(nc.new_customers,0))
  END AS ltv_cac_ratio
FROM mrr CROSS JOIN marketing CROSS JOIN nc;
  `;

  const res: any = await (prisma as any).$queryRaw(sql);
  return Array.isArray(res) ? (res[0] ?? {}) : res;
}

async function fetchSnapshots(limit = 30) {
  return prisma.ltvSnapshot.findMany({ orderBy: { snapshotAt: 'desc' }, take: limit });
}

export default async function Page() {
  const metrics = await fetchCurrentMetrics();
  const snapshots = await fetchSnapshots(30);

  const formatINR = (paise: number | null | undefined) => {
    if (paise == null) return '--';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">LTV / CAC -- Metrics</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 border rounded bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500">MRR</div>
          <div className="text-xl font-bold">{formatINR(Number(metrics.mrr_paise ?? 0))}</div>
        </div>
        <div className="p-4 border rounded bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500">Marketing Spend (MTD)</div>
          <div className="text-xl font-bold">
            {formatINR(Number(metrics.marketing_spend_paise ?? 0))}
          </div>
        </div>
        <div className="p-4 border rounded bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500">LTV / CAC Ratio</div>
          <div className="text-xl font-bold">
            {metrics.ltv_cac_ratio == null ? '--' : Number(metrics.ltv_cac_ratio).toFixed(2)}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-medium mb-2">Recent snapshots</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm text-gray-500">
              <th className="pr-4">Snapshot</th>
              <th className="pr-4">MRR</th>
              <th className="pr-4">Marketing</th>
              <th className="pr-4">New Customers</th>
              <th className="pr-4">CAC</th>
              <th className="pr-4">LTV/CAC</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2">{new Date(s.snapshotAt).toLocaleString()}</td>
                <td>{formatINR(s.mrr_paise)}</td>
                <td>{formatINR(s.marketing_spend_paise)}</td>
                <td>{s.new_customers}</td>
                <td>{s.cac_paise == null ? '--' : formatINR(s.cac_paise)}</td>
                <td>{s.ltv_cac_ratio == null ? '--' : Number(s.ltv_cac_ratio).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
