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

export interface TrendingDoubt {
  conceptId: string
  conceptName: string
  studentCount: number
}

export interface CostReportResult {
  date: string         // ISO date string (YYYY-MM-DD) for the reported day (IST)
  sessions: number
  totalCostUsd: number
  costPerSession: number
  alertSent: boolean
  trendingDoubts: TrendingDoubt[]
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

/**
 * Returns conceptIds escalated by more than 5 distinct students in the last 7 days.
 * Joins with Concept table to resolve names. Never throws.
 */
async function getTrendingEscalations(since: Date): Promise<TrendingDoubt[]> {
  try {
    type Row = { conceptId: string; studentCount: bigint }
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT "conceptId", COUNT(DISTINCT "studentId")::bigint AS "studentCount"
      FROM "DoubtEscalation"
      WHERE "createdAt" >= ${since}
        AND "conceptId" IS NOT NULL
      GROUP BY "conceptId"
      HAVING COUNT(DISTINCT "studentId") > 5
      ORDER BY "studentCount" DESC
    `
    if (!rows.length) return []

    const conceptIds = rows.map((r) => r.conceptId)
    const concepts = await prisma.concept.findMany({
      where: { id: { in: conceptIds } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(concepts.map((c) => [c.id, c.name]))

    return rows.map((r) => ({
      conceptId: r.conceptId,
      conceptName: nameMap.get(r.conceptId) ?? r.conceptId,
      studentCount: Number(r.studentCount),
    }))
  } catch {
    return []
  }
}

function buildAlertHtml(params: {
  dateLabel: string
  sessions: number
  totalCostUsd: number
  costPerSession: number
  trendingDoubts: TrendingDoubt[]
}): string {
  const { dateLabel, sessions, totalCostUsd, costPerSession, trendingDoubts } = params
  const costInr = (costPerSession * USD_TO_INR).toFixed(2)
  const totalInr = (totalCostUsd * USD_TO_INR).toFixed(2)

  const trendingSection = trendingDoubts.length > 0
    ? `<div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:16px;margin-top:20px;">
  <h3 style="margin:0 0 8px;color:#92400E;font-size:15px;">Trending Doubts (last 7 days)</h3>
  <ul style="margin:0;padding:0 0 0 18px;color:#78350F;">
    ${trendingDoubts.map((d) => `<li>${d.conceptName} — ${d.studentCount} escalations this week</li>`).join('\n    ')}
  </ul>
</div>`
    : ''

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

  ${trendingSection}

  <p style="color:#6B7280;font-size:12px;margin-top:20px;">
    Threshold: $${ALERT_THRESHOLD_USD.toFixed(3)} per session. Check model usage and caching.
  </p>
</body>
</html>`
}

export async function runDailyCostReport(): Promise<CostReportResult> {
  const { start, end, dateLabel } = getYesterdayIstBounds()

  const sevenDaysAgo = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000)

  // Count distinct sessions, sum costs, and check trending escalations in parallel
  const [distinctSessionRows, agg, trendingDoubts] = await Promise.all([
    prisma.aITutorTurnLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    }),
    prisma.aITutorTurnLog.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { costUsd: true },
    }),
    getTrendingEscalations(sevenDaysAgo),
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

  logger.info('costReportingWorker.report', { date: dateLabel, sessions, totalCostUsd, costPerSession, trendingDoubtCount: trendingDoubts.length })

  // Alert if cost per session exceeds threshold
  let alertSent = false
  if (costPerSession > ALERT_THRESHOLD_USD) {
    const oncallEmail = process.env.ONCALL_EMAIL
    if (oncallEmail) {
      try {
        const costInr = (costPerSession * USD_TO_INR).toFixed(2)
        const trendingText = trendingDoubts.length > 0
          ? '\n\nTrending doubts (last 7 days):\n' + trendingDoubts.map((d) => `  - ${d.conceptName}: ${d.studentCount} escalations`).join('\n')
          : ''
        await sendEmail({
          to: oncallEmail,
          subject: `⚠️ Spinzy AI cost alert: ₹${costInr} per session on ${dateLabel}`,
          html: buildAlertHtml({ dateLabel, sessions, totalCostUsd, costPerSession, trendingDoubts }),
          text: [
            `Spinzy AI cost alert — ${dateLabel}`,
            `Sessions: ${sessions}`,
            `Total cost: $${totalCostUsd.toFixed(4)} (₹${(totalCostUsd * USD_TO_INR).toFixed(2)})`,
            `Cost per session: $${costPerSession.toFixed(5)} (₹${costInr})`,
            `Threshold: $${ALERT_THRESHOLD_USD.toFixed(3)} per session`,
          ].join('\n') + trendingText,
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

  return { date: dateLabel, sessions, totalCostUsd, costPerSession, alertSent, trendingDoubts }
}
