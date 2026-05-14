/**
 * Daily p95 latency report -- F-ADM-032 AC-02
 *
 * Runs daily. Computes the p95 latencyMs from AITutorTurnLog for the previous
 * IST day. Fires an alert when p95 exceeds LATENCY_ALERT_THRESHOLD_MS (10 000 ms).
 *
 * Never throws -- logs errors and returns a safe result.
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { sendMailSafe } from '@/lib/mailer.js'
import { adminBroadcastEmailHtml } from '@/lib/email/templates'
import { getYesterdayIstBounds } from '../services/costReportingWorker.js'

const LATENCY_ALERT_THRESHOLD_MS = 10_000

export interface LatencyReportResult {
  date: string
  p95LatencyMs: number | null
  totalTurns: number
  alertSent: boolean
}

interface PercentileRow {
  p95: number | null
  totalTurns: bigint
}

export async function runDailyLatencyReport(): Promise<LatencyReportResult> {
  const { start, end, dateLabel } = getYesterdayIstBounds()

  let p95LatencyMs: number | null = null
  let totalTurns = 0

  try {
    const [row] = await prisma.$queryRaw<PercentileRow[]>`
      SELECT
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs") AS "p95",
        COUNT(*)::bigint                                            AS "totalTurns"
      FROM "AITutorTurnLog"
      WHERE "createdAt" >= ${start}
        AND "createdAt" < ${end}
    `
    p95LatencyMs = row?.p95 !== null && row?.p95 !== undefined ? Math.round(Number(row.p95)) : null
    totalTurns = Number(row?.totalTurns ?? 0)
  } catch (err) {
    logger.error('dailyLatencyReport.queryFailed', {
      event: 'latency_report_error',
      context: { date: dateLabel },
      error: err instanceof Error ? err.message : String(err),
    })
    return { date: dateLabel, p95LatencyMs: null, totalTurns: 0, alertSent: false }
  }

  logger.info('dailyLatencyReport.result', {
    event: 'latency_report',
    context: { date: dateLabel, p95LatencyMs, totalTurns },
  })

  const needsAlert = p95LatencyMs !== null && p95LatencyMs > LATENCY_ALERT_THRESHOLD_MS
  let alertSent = false

  if (needsAlert) {
    const oncallEmail = process.env.ONCALL_EMAIL
    if (oncallEmail) {
      try {
        const title = `Daily AI tutor latency report -- ${dateLabel}`
        const body = `p95 latency: ${p95LatencyMs}ms (threshold: ${LATENCY_ALERT_THRESHOLD_MS}ms)\nTotal turns: ${totalTurns}\n\nCheck OpenAI API latency, RAG retrieval times, and DB query performance.`
        await sendMailSafe({
          to: oncallEmail,
          subject: `⚠️ Spinzy latency alert: p95 ${p95LatencyMs}ms on ${dateLabel}`,
          text: [title, '', `p95 latency: ${p95LatencyMs}ms (threshold: ${LATENCY_ALERT_THRESHOLD_MS}ms)`, `Total turns: ${totalTurns}`, '', `Check OpenAI API latency, RAG retrieval times, and DB query performance.`].join('\n'),
          html: adminBroadcastEmailHtml({ title, body }),
        })
        alertSent = true
        logger.warn('dailyLatencyReport.alertSent', {
          event: 'latency_alert_sent',
          context: { date: dateLabel, p95LatencyMs, threshold: LATENCY_ALERT_THRESHOLD_MS },
        })
      } catch (err) {
        logger.error('dailyLatencyReport.alertFailed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      logger.warn('dailyLatencyReport.alertSkipped', {
        reason: 'ONCALL_EMAIL not set',
        p95LatencyMs,
      })
    }
  }

  return { date: dateLabel, p95LatencyMs, totalTurns, alertSent }
}
