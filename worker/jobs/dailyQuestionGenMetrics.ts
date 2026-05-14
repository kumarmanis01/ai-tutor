/**
 * Daily question generation failure rate -- F-ADM-032 AC-03
 *
 * Runs daily. Queries AnalyticsEvent for rows where:
 *   eventType = 'ai_call' AND metadata->>'call_type' = 'questions'
 *
 * Computes: failureRate = failed_calls / total_calls
 * Fires an alert when failureRate > FAILURE_RATE_THRESHOLD (5%).
 *
 * Never throws -- logs errors and returns a safe result.
 */

import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { sendMailSafe } from '@/lib/mailer.js'
import { adminBroadcastEmailHtml } from '@/lib/email/templates'
import { getYesterdayIstBounds } from '../services/costReportingWorker.js'

const FAILURE_RATE_THRESHOLD = 0.05 // 5%

export interface QuestionGenMetricsResult {
  date: string
  totalCalls: number
  failedCalls: number
  failureRate: number | null
  alertSent: boolean
}

interface QuestionGenRow {
  totalCalls: bigint
  failedCalls: bigint
}

export async function runDailyQuestionGenMetrics(): Promise<QuestionGenMetricsResult> {
  const { start, end, dateLabel } = getYesterdayIstBounds()

  let totalCalls = 0
  let failedCalls = 0
  let failureRate: number | null = null

  try {
    // metadata is a Json column; use ->> for text extraction in Postgres
    const [row] = await prisma.$queryRaw<QuestionGenRow[]>`
      SELECT
        COUNT(*)::bigint                                                              AS "totalCalls",
        COUNT(*) FILTER (WHERE (metadata->>'success')::boolean = false)::bigint      AS "failedCalls"
      FROM "AnalyticsEvent"
      WHERE "eventType" = 'ai_call'
        AND metadata->>'call_type' = 'questions'
        AND "createdAt" >= ${start}
        AND "createdAt" < ${end}
    `
    totalCalls = Number(row?.totalCalls ?? 0)
    failedCalls = Number(row?.failedCalls ?? 0)
    failureRate = totalCalls > 0 ? failedCalls / totalCalls : null
  } catch (err) {
    logger.error('dailyQuestionGenMetrics.queryFailed', {
      event: 'question_gen_metrics_error',
      context: { date: dateLabel },
      error: err instanceof Error ? err.message : String(err),
    })
    return { date: dateLabel, totalCalls: 0, failedCalls: 0, failureRate: null, alertSent: false }
  }

  logger.info('dailyQuestionGenMetrics.result', {
    event: 'question_gen_metrics',
    context: { date: dateLabel, totalCalls, failedCalls, failureRate },
  })

  const needsAlert = failureRate !== null && failureRate > FAILURE_RATE_THRESHOLD
  let alertSent = false

  if (needsAlert) {
    const oncallEmail = process.env.ONCALL_EMAIL
    if (oncallEmail) {
      const pct = (failureRate! * 100).toFixed(1)
      const threshold = (FAILURE_RATE_THRESHOLD * 100).toFixed(0)
      try {
        const title = `Daily question generation metrics -- ${dateLabel}`
        const body = `Failure rate: ${pct}% (threshold: ${threshold}%)\nTotal calls: ${totalCalls} | Failed calls: ${failedCalls}\n\nCheck the OpenAI API key limits, model availability, and question generation prompts.`
        await sendMailSafe({
          to: oncallEmail,
          subject: `⚠️ Spinzy question-gen failure rate: ${pct}% on ${dateLabel}`,
          text: [title, '', `Failure rate: ${pct}% (threshold: ${threshold}%)`, `Total calls: ${totalCalls}`, `Failed calls: ${failedCalls}`, '', `Check the OpenAI API key limits, model availability, and question generation prompts.`].join('\n'),
          html: adminBroadcastEmailHtml({ title, body }),
        })
        alertSent = true
        logger.warn('dailyQuestionGenMetrics.alertSent', {
          event: 'question_gen_alert_sent',
          context: { date: dateLabel, failureRate, threshold: FAILURE_RATE_THRESHOLD },
        })
      } catch (err) {
        logger.error('dailyQuestionGenMetrics.alertFailed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      logger.warn('dailyQuestionGenMetrics.alertSkipped', {
        reason: 'ONCALL_EMAIL not set',
        failureRate,
      })
    }
  }

  return { date: dateLabel, totalCalls, failedCalls, failureRate, alertSent }
}
