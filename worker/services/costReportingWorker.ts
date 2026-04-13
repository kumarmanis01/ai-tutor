/**
 * Daily AI cost reporting worker -- T42
 *
 * Runs at 6:00 AM IST (00:30 UTC) daily.
 *
 * For yesterday (IST boundaries):
 *   - Counts distinct sessionIds from AITutorTurnLog
 *   - Sums costUsd from AITutorTurnLog
 *   - Upserts a DailyCostMetric row
 *   - Fires an alert email to ONCALL_EMAIL if costPerSession > $0.003
 *
 * Never throws -- logs errors and returns a safe result.
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { sendMailSafe } from '@/lib/mailer.js'
import { sendPushSafe } from '@/lib/push/send.js'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications.js'

// 1 USD to INR exchange rate (fixed reference -- update quarterly)
const USD_TO_INR = 84

// Alert threshold: $0.003 per session (~₹0.25)
const ALERT_THRESHOLD_USD = 0.003
// Hard daily ceiling: $15 USD
const DAILY_CEILING_USD = 15
// Cache hit rate target
const CACHE_HIT_RATE_TARGET = 0.55

export interface TrendingDoubt {
  conceptId: string
  conceptName: string
  studentCount: number
}

export interface QualityFlagSummary {
  flag: string
  count: number
}

export interface CostReportResult {
  date: string         // ISO date string (YYYY-MM-DD) for the reported day (IST)
  sessions: number
  totalCostUsd: number
  costPerSession: number
  alertSent: boolean
  trendingDoubts: TrendingDoubt[]
  qualityFlags?: QualityFlagSummary[]
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
    ${trendingDoubts.map((d) => `<li>${d.conceptName} -- ${d.studentCount} escalations this week</li>`).join('\n    ')}
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

  // Count distinct sessions, sum costs, trending escalations, rolling avg history, cache stats in parallel
  const [distinctSessionRows, agg, trendingDoubts, last7Metrics, cacheStats, yesterdayMetric] = await Promise.all([
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
    prisma.dailyCostMetric.findMany({
      where: { date: { gte: sevenDaysAgo, lt: start } },
      orderBy: { date: 'desc' },
      take: 7,
    }),
    // Cache hit rate: count cached=true vs total for yesterday
    prisma.$queryRaw<[{ total: bigint; cached: bigint }]>`
      SELECT COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE cached = true)::bigint AS cached
      FROM "AITutorTurnLog"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
    `,
    // Previous day metric for dropout detection
    prisma.dailyCostMetric.findFirst({
      where: { date: { gte: sevenDaysAgo, lt: start } },
      orderBy: { date: 'desc' },
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

  // Rolling average (need ≥3 data points)
  const rollingAvg =
    last7Metrics.length >= 3
      ? last7Metrics.reduce((s, d) => s + d.costPerSession, 0) / last7Metrics.length
      : null

  // Cache hit rate
  const totalTurns = Number(cacheStats[0]?.total ?? 0)
  const cachedTurns = Number(cacheStats[0]?.cached ?? 0)
  const cacheHitRate = totalTurns > 0 ? cachedTurns / totalTurns : null

  // Anomaly detection
  const isCostThreshold = costPerSession > ALERT_THRESHOLD_USD
  const isRollingAnomaly = rollingAvg !== null && costPerSession > rollingAvg * 1.5
  const isCeiling = totalCostUsd > DAILY_CEILING_USD
  const isDropout = sessions === 0 && (yesterdayMetric?.sessions ?? 0) > 10
  const isCacheWarn = cacheHitRate !== null && cacheHitRate < CACHE_HIT_RATE_TARGET
  // F-ADM-011 AC-05: also alert when trending doubts surface, regardless of cost thresholds
  const hasTrendingDoubts = trendingDoubts.length > 0
  const needsAlert = isCostThreshold || isRollingAnomaly || isCeiling || isDropout || hasTrendingDoubts

  // Build alert subject
  let alertSubject = `⚠️ Spinzy AI cost alert: ₹${(costPerSession * USD_TO_INR).toFixed(2)} per session on ${dateLabel}`
  if (isDropout) {
    alertSubject = `⚠️ Zero sessions -- possible outage on ${dateLabel}`
  } else if (isCeiling) {
    alertSubject = `⚠️ Daily cost ceiling reached: $${totalCostUsd.toFixed(2)} on ${dateLabel}`
  } else if (isRollingAnomaly && rollingAvg) {
    const multiple = (costPerSession / rollingAvg).toFixed(1)
    alertSubject = `⚠️ Cost spike: ${multiple}x above 7-day average on ${dateLabel}`
  } else if (hasTrendingDoubts && !isCostThreshold) {
    alertSubject = `⚠️ Trending doubts alert: ${trendingDoubts.length} concept(s) with high escalations on ${dateLabel}`
  }

  logger.info('costReportingWorker.report', {
    date: dateLabel, sessions, totalCostUsd, costPerSession,
    rollingAvg, cacheHitRate, trendingDoubtCount: trendingDoubts.length,
    anomalies: { isCostThreshold, isRollingAnomaly, isCeiling, isDropout },
  })

  if (isCacheWarn) {
    logger.warn('costReportingWorker.cacheLow', { cacheHitRate, target: CACHE_HIT_RATE_TARGET })
  }

  // Alert if any condition triggered
  let alertSent = false
  if (needsAlert) {
    const oncallEmail = process.env.ONCALL_EMAIL
    if (oncallEmail) {
      try {
        const costInr = (costPerSession * USD_TO_INR).toFixed(2)
        const trendingText = trendingDoubts.length > 0
          ? '\n\nTrending doubts (last 7 days):\n' + trendingDoubts.map((d) => `  - ${d.conceptName}: ${d.studentCount} escalations`).join('\n')
          : ''
        const cacheText = cacheHitRate !== null
          ? `\nCache hit rate: ${(cacheHitRate * 100).toFixed(1)}% (target >${(CACHE_HIT_RATE_TARGET * 100).toFixed(0)}%)${isCacheWarn ? ' ⚠️ below target' : ''}`
          : ''
        const rollingText = rollingAvg !== null ? `\n7-day avg cost/session: $${rollingAvg.toFixed(5)}` : ''
        await sendMailSafe({
          to: oncallEmail,
          subject: alertSubject,
          html: buildAlertHtml({ dateLabel, sessions, totalCostUsd, costPerSession, trendingDoubts }),
          text: [
            `Spinzy AI cost alert -- ${dateLabel}`,
            `Sessions: ${sessions}`,
            `Total cost: $${totalCostUsd.toFixed(4)} (₹${(totalCostUsd * USD_TO_INR).toFixed(2)})`,
            `Cost per session: $${costPerSession.toFixed(5)} (₹${costInr})`,
            `Threshold: $${ALERT_THRESHOLD_USD.toFixed(3)} per session`,
          ].join('\n') + rollingText + cacheText + trendingText,
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

  // Weekly quality flag summary (only on Sunday runs, day 0)
  const dayOfWeekIst = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000).getUTCDay()
  let qualityFlags: QualityFlagSummary[] | undefined
  if (dayOfWeekIst === 0) {
    const sevenDaysAgoForQuality = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000)
    try {
      type FlagRow = { qualityFlag: string; _count: number }
      const flagGroups = await prisma.aITutorTurnLog.groupBy({
        by: ['qualityFlag'],
        where: {
          createdAt: { gte: sevenDaysAgoForQuality, lt: end },
          qualityFlag: { not: null },
        },
        _count: { qualityFlag: true },
      })
      qualityFlags = flagGroups.map((g) => ({
        flag: g.qualityFlag as string,
        count: g._count.qualityFlag,
      }))
      if (qualityFlags.length > 0) {
        const directAnswerCount = qualityFlags.find((f) => f.flag === 'DIRECT_ANSWER_GIVEN')?.count ?? 0
        const summaryLines = qualityFlags.map((f) => `${f.flag}: ${f.count}`).join(', ')
        logger.warn('costReportingWorker.qualityFlags', { summaryLines, directAnswerCount })
        if (directAnswerCount > 0) {
          logger.error('costReportingWorker.CRITICAL_DIRECT_ANSWER_GIVEN', { count: directAnswerCount })
        }
      }
    } catch (err) {
      logger.error('costReportingWorker.qualityFlagsFailed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ── Push: free tier reset reminder ─────────────────────────────────────
  await runFreeTierResetPush()

  return { date: dateLabel, sessions, totalCostUsd, costPerSession, alertSent, trendingDoubts, qualityFlags }
}

/**
 * Notify free-tier students (≥ 2 sessions used) whose reset is 3 days away.
 * "Reset is in 3 days" = today is the 28th or later (month resets on the 1st).
 */
async function runFreeTierResetPush(): Promise<void> {
  try {
    const today = new Date()
    const dayOfMonth = today.getDate()
    // Only run on the 28th, 29th, or 30th
    if (dayOfMonth < 28) return

    const daysLeft = 32 - dayOfMonth // rough days until month end (1st)

    // Find free-tier students who have used ≥ 2 of 10 sessions this month
    const usages = await prisma.freeTierUsage.findMany({
      where: { sessionsUsed: { gte: 2 } },
      select: { studentId: true, sessionsUsed: true },
    })

    for (const usage of usages) {
      // Check they are still free tier (not premium)
      const { isPremiumUser } = await import('@/lib/subscription.js')
      const isPremium = await isPremiumUser(usage.studentId).catch(() => false)
      if (isPremium) continue

      await sendPushSafe(
        usage.studentId,
        PUSH_NOTIFICATIONS.free_tier_reset_soon(daysLeft, 'your'),
      )
    }
    logger.info('costReportingWorker.freeTierResetPush', { notified: usages.length })
  } catch (err) {
    logger.error('costReportingWorker.freeTierResetPushFailed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
