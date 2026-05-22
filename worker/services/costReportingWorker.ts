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
import { sendEmailUnifiedSafe } from '@/lib/mail.js'
import { sendPushSafe } from '@/lib/push/send.js'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications.js'
import { costAnomalyHtml } from '@/lib/email/templates'

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
    const rawRows = await prisma.$queryRaw`
      SELECT "conceptId", COUNT(DISTINCT "studentId")::bigint AS "studentCount"
      FROM "DoubtEscalation"
      WHERE "createdAt" >= ${since}
        AND "conceptId" IS NOT NULL
      GROUP BY "conceptId"
      HAVING COUNT(DISTINCT "studentId") > 5
      ORDER BY "studentCount" DESC
    `
    const rows = rawRows as Row[]
    if (!rows || !rows.length) return []

    // defensive: ignore any rows that have a null/empty conceptId (mocked query results
    // or transitional data could surface such rows). Only treat non-null conceptIds
    // as valid trending doubts.
    const nonNullRows = rows.filter((r) => r.conceptId != null)
    if (!nonNullRows.length) return []

    const conceptIds = nonNullRows.map((r) => r.conceptId)
    const conceptsRaw = await prisma.concept.findMany({
      where: { id: { in: conceptIds } },
      select: { id: true, name: true },
    })
    const concepts = conceptsRaw as Array<{ id: string; name: string }>
    const nameMap = new Map(concepts.map((c) => [c.id, c.name]))

    return nonNullRows.map((r) => ({
      conceptId: r.conceptId,
      conceptName: nameMap.get(r.conceptId) ?? r.conceptId,
      studentCount: Number(r.studentCount),
    }))
  } catch {
    return []
  }
}

// Use centralized costAnomalyHtml from templates

export async function runDailyCostReport(): Promise<CostReportResult> {
  const { start, end, dateLabel } = getYesterdayIstBounds()

  const sevenDaysAgo = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000)

  // Count distinct sessions, sum costs, trending escalations, rolling avg history, cache stats,
  // hydration job stats, and AI content log success rate in parallel
  const _res = await Promise.all([
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
    prisma.$queryRaw`
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
    // Hydration job stats for yesterday
    prisma.hydrationJob.groupBy({
      by: ['status'],
      where: { createdAt: { gte: start, lt: end } },
      _count: { status: true },
    }),
    // Current pending hydration backlog
    prisma.hydrationJob.count({ where: { status: 'pending' } }),
    // AI content generation success rate yesterday
    prisma.aIContentLog.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _count: { id: true },
      _sum: { tokensUsed: true },
    }),
    prisma.aIContentLog.count({
      where: { createdAt: { gte: start, lt: end }, success: false },
    }),
  ])

  const distinctSessionRows = _res[0] as Array<{ sessionId: string }>
  const agg = _res[1] as { _sum: { costUsd: number | null } }
  const trendingDoubts = _res[2] as TrendingDoubt[]
  const last7Metrics = _res[3] as Array<{ costPerSession: number }>
  const cacheStats = _res[4] as Array<{ total: bigint; cached: bigint }>
  const yesterdayMetric = _res[5] as { sessions: number } | null
  const hydrationByStatus = _res[6] as Array<{ status: string; _count: { status: number } }>
  const hydrationPendingBacklog = _res[7] as number
  const contentLogAgg = _res[8] as { _count: { id: number }; _sum: { tokensUsed: number | null } }
  const contentLogFailures = _res[9] as number

  const hydrationCompleted = hydrationByStatus.find((r) => r.status === 'completed')?._count.status ?? 0
  const hydrationFailed = hydrationByStatus.find((r) => r.status === 'failed')?._count.status ?? 0
  const contentLogTotal = contentLogAgg._count.id ?? 0
  const contentLogTokens = contentLogAgg._sum.tokensUsed ?? 0

  const sessions = distinctSessionRows.length
  const totalCostUsd = Number(agg._sum.costUsd ?? 0)
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
        const hydrationText = `\n\nContent hydration (yesterday): completed=${hydrationCompleted} failed=${hydrationFailed} pending_backlog=${hydrationPendingBacklog}`
          + (hydrationFailed > 0 ? ' ⚠️' : '')
        const contentGenText = contentLogTotal > 0
          ? `\nAI content generation: total=${contentLogTotal} failures=${contentLogFailures} tokens=${contentLogTokens.toLocaleString()}`
          : ''
        await sendEmailUnifiedSafe({
          mode: 'raw',
          delivery: 'best_effort',
          to: oncallEmail,
          subject: alertSubject,
          // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
          html: costAnomalyHtml({ dateLabel, sessions, totalCostUsd, costPerSession, trendingDoubts }),
          text: [
            `Spinzy AI cost alert -- ${dateLabel}`,
            `Sessions: ${sessions}`,
            `Total cost: $${totalCostUsd.toFixed(4)} (Rs.${(totalCostUsd * USD_TO_INR).toFixed(2)})`,
            `Cost per session: $${costPerSession.toFixed(5)} (Rs.${costInr})`,
            `Threshold: $${ALERT_THRESHOLD_USD.toFixed(3)} per session`,
          ].join('\n') + rollingText + cacheText + hydrationText + contentGenText + trendingText,
          reason: 'cost_anomaly_alert',
          featureFlagDomain: 'ops',
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
      const flagGroups = await prisma.aITutorTurnLog.groupBy({
        by: ['qualityFlag'],
        where: {
          createdAt: { gte: sevenDaysAgoForQuality, lt: end },
          qualityFlag: { not: null },
        },
        _count: { qualityFlag: true },
      })
      type FlagRow = { qualityFlag: string; _count: { qualityFlag: number } }
      const flagGroupsTyped = flagGroups as FlagRow[]
      const qFlags = flagGroupsTyped.map((g) => ({
        flag: g.qualityFlag as string,
        count: g._count.qualityFlag,
      }))
      qualityFlags = qFlags
      if (qFlags.length > 0) {
        const directAnswerCount = qFlags.find((f) => f.flag === 'DIRECT_ANSWER_GIVEN')?.count ?? 0
        const summaryLines = qFlags.map((f) => `${f.flag}: ${f.count}`).join(', ')
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
      where: { subjectScope: '__ALL__', sessionsUsed: { gte: 2 } },
      select: { studentId: true, sessionsUsed: true },
    })

    for (const usage of usages) {
      // Check they are still free tier (not premium)
      const { isPremiumUser } = await import('@/lib/billing/subscription')
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
