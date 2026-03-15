/**
 * Daily AI cost reporting worker — T42
 *
 * Runs at 6:00 AM IST (00:30 UTC) daily.
 *
 * For yesterday (IST boundaries):
 *   - Counts distinct sessionIds from AITutorTurnLog
 *   - Sums costUsd from AITutorTurnLog
 *   - Upserts a DailyCostMetric row
 *   - Fires an alert email to ONCALL_EMAIL if costPerSession > $0.003
 *
 * Never throws — logs errors and returns a safe result.
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { sendEmail } from '@/lib/mailer.js'

// 1 USD to INR exchange rate (fixed reference — update quarterly)
const USD_TO_INR = 84

// Alert threshold: $0.003 per session (~₹0.25)
const ALERT_THRESHOLD_USD = 0.003

export interface CostReportResult {
  date: string         // ISO date string (YYYY-MM-DD) for the reported day (IST)
  sessions: number
  totalCostUsd: number
  costPerSession: number
  alertSent: boolean
}

/**
 * Returns the UTC start and end timestamps for "yesterday" in IST.
 * IST = UTC+5:30, so yesterday IST midnight = 18:30 UTC the previous day.
 */
export function getYesterdayIstBounds(): { start: Date; end: Date; dateLabel: string } {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000 // 5h30m in ms

  // Shift now into IST to find "today" IST midnight
  const nowUtc = Date.now()
  const nowIst = new Date(nowUtc + IST_OFFSET_MS)
  const todayIstMidnight = new Date(nowIst)
  todayIstMidnight.setUTCHours(0, 0, 0, 0)

  const yesterdayIstMidnight = new Date(todayIstMidnight.getTime() - 24 * 60 * 60 * 1000)

  // Convert IST midnights back to UTC
  const start = new Date(yesterdayIstMidnight.getTime() - IST_OFFSET_MS)
  const end = new Date(todayIstMidnight.getTime() - IST_OFFSET_MS)

  // Build a YYYY-MM-DD label in IST
  const y = yesterdayIstMidnight.getUTCFullYear()
  const m = String(yesterdayIstMidnight.getUTCMonth() + 1).padStart(2, '0')
  const d = String(yesterdayIstMidnight.getUTCDate()).padStart(2, '0')
  const dateLabel = `${y}-${m}-${d}`

  return { start, end, dateLabel }
}

function buildAlertHtml(params: {
  dateLabel: string
  sessions: number
  totalCostUsd: number
  costPerSession: number
}): string {
  const { dateLabel, sessions, totalCostUsd, costPerSession } = params
  const costInr = (costPerSession * USD_TO_INR).toFixed(2)
  const totalInr = (totalCostUsd * USD_TO_INR).toFixed(2)

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1F2937;">
  <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;padding:20px;margin-bottom:20px;">
    <h2 style="margin:0 0 4px;color:#DC2626;font-size:18px;">⚠️ Spinzy AI Cost Alert</h2>
    <p style="margin:0;color:#7F1D1D;font-size:13px;">Cost per session exceeded threshold on ${dateLabel}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr style="background:#F9FAFB;">
      <td style="padding:10px 14px;border:1px solid #E5E7EB;font-weight:600;">Date (IST)</td>
      <td style="padding:10px 14px;border:1px solid #E5E7EB;">${dateLabel}</td>
    </tr>
    <tr>
      <td style="padding:10px 14px;border:1px solid #E5E7EB;font-weight:600;">Sessions</td>
      <td style="padding:10px 14px;border:1px solid #E5E7EB;">${sessions}</td>
    </tr>
    <tr style="background:#F9FAFB;">
      <td style="padding:10px 14px;border:1px solid #E5E7EB;font-weight:600;">Total cost</td>
      <td style="padding:10px 14px;border:1px solid #E5E7EB;">$${totalCostUsd.toFixed(4)} (₹${totalInr})</td>
    </tr>
    <tr style="background:#FEF2F2;">
      <td style="padding:10px 14px;border:1px solid #FCA5A5;font-weight:600;color:#DC2626;">Cost per session</td>
      <td style="padding:10px 14px;border:1px solid #FCA5A5;color:#DC2626;font-weight:700;">
        $${costPerSession.toFixed(5)} (₹${costInr})
      </td>
    </tr>
  </table>

  <p style="color:#6B7280;font-size:12px;">
    Threshold: $${ALERT_THRESHOLD_USD.toFixed(3)} per session. Check model usage and caching.
  </p>
</body>
</html>`
}

export async function runDailyCostReport(): Promise<CostReportResult> {
  const { start, end, dateLabel } = getYesterdayIstBounds()

  // Count distinct sessions and sum costs for yesterday
  const [distinctSessionRows, agg] = await Promise.all([
    prisma.aITutorTurnLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    }),
    prisma.aITutorTurnLog.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { costUsd: true },
    }),
  ])

  const sessions = distinctSessionRows.length
  const totalCostUsd = agg._sum.costUsd ?? 0
  const costPerSession = sessions > 0 ? totalCostUsd / sessions : 0

  // Upsert DailyCostMetric for the reporting date (use start = yesterday IST midnight UTC)
  await prisma.dailyCostMetric.upsert({
    where: { date: start },
    create: { date: start, sessions, totalCostUsd, costPerSession },
    update: { sessions, totalCostUsd, costPerSession },
  })

  logger.info('costReportingWorker.report', { date: dateLabel, sessions, totalCostUsd, costPerSession })

  // Alert if cost per session exceeds threshold
  let alertSent = false
  if (costPerSession > ALERT_THRESHOLD_USD) {
    const oncallEmail = process.env.ONCALL_EMAIL
    if (oncallEmail) {
      try {
        const costInr = (costPerSession * USD_TO_INR).toFixed(2)
        await sendEmail({
          to: oncallEmail,
          subject: `⚠️ Spinzy AI cost alert: ₹${costInr} per session on ${dateLabel}`,
          html: buildAlertHtml({ dateLabel, sessions, totalCostUsd, costPerSession }),
          text: [
            `Spinzy AI cost alert — ${dateLabel}`,
            `Sessions: ${sessions}`,
            `Total cost: $${totalCostUsd.toFixed(4)} (₹${(totalCostUsd * USD_TO_INR).toFixed(2)})`,
            `Cost per session: $${costPerSession.toFixed(5)} (₹${costInr})`,
            `Threshold: $${ALERT_THRESHOLD_USD.toFixed(3)} per session`,
          ].join('\n'),
        })
        alertSent = true
        logger.info('costReportingWorker.alertSent', { to: oncallEmail, dateLabel, costPerSession })
      } catch (err) {
        logger.error('costReportingWorker.alertFailed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      logger.warn('costReportingWorker.alertSkipped', {
        reason: 'ONCALL_EMAIL not set',
        costPerSession,
        dateLabel,
      })
    }
  }

  return { date: dateLabel, sessions, totalCostUsd, costPerSession, alertSent }
}
