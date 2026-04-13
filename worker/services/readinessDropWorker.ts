/**
 * FILE OBJECTIVE:
 * - Worker to detect >10-point exam-readiness drops over 7 days for subjects
 *   where an exam is within 90 days. Sends parent alerts with an AI remediation
 *   summary. Rate-limited per parent+student+subject (7 days).
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/readinessDropWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created readiness-drop worker
 * - 2026-04-13T00:00:00Z | senior-engineer | send student push notifications on readiness drop; add student rate-limit
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import { getRedis } from '@/lib/redis'
import { callLLM } from '@/lib/callLLM'
import { sendMailSafe } from '@/lib/mailer'
import { sendSms } from '@/lib/sms'
import { sendPushSafe } from '@/lib/push/send'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications'

const READINESS_DROP_THRESHOLD = 10 // points (0-100)
const LOOKBACK_DAYS = 7
const RATE_LIMIT_DAYS = 7
const EXAM_WINDOW_DAYS = 90

function escapeHtml(str: string) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function sanitizeTextForHtml(raw: string) {
  const escaped = escapeHtml(raw)
  return escaped.replace(/\n/g, '<br/>')
}

function dateLabelUTC(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function processReadinessDropAlerts(now = new Date()): Promise<void> {
  const redis = getRedis()
  const appUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.spinzyacademy.com').replace(/\/$/, '')

  try {
    // All active parent links
    const links = await prisma.parentStudent.findMany({
      where: { status: 'active' },
      select: { parentId: true, studentId: true, parent: { select: { name: true, email: true, phone: true } } },
    })

    // Build student -> parents map
    const parentsByStudent = new Map<string, { parentId: string; name?: string; email?: string; phone?: string }[]>()
    const parentById = new Map<string, { name?: string; email?: string; phone?: string }>()
    for (const l of links) {
      parentById.set(l.parentId, { name: l.parent?.name, email: l.parent?.email, phone: l.parent?.phone })
      const arr = parentsByStudent.get(l.studentId) ?? []
      arr.push({ parentId: l.parentId, name: l.parent?.name, email: l.parent?.email, phone: l.parent?.phone })
      parentsByStudent.set(l.studentId, arr)
    }

    // For all students with parent links, fetch their learning plans (subjectId + examDate)
    const studentIds = Array.from(new Set(links.map((l) => l.studentId)))
    if (studentIds.length === 0) return

    const plans = await prisma.learningPlan.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, subjectId: true, examDate: true } })

    // Map subjectId -> subject name for nicer messages
    const subjectIds = Array.from(new Set(plans.map((p) => p.subjectId).filter(Boolean)))
    const subjectDefs = subjectIds.length > 0 ? await prisma.subjectDef.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }) : []
    const subjectNameById = new Map(subjectDefs.map((s) => [s.id, s.name]))

    // For each plan entry, compute readiness now and compare to snapshot LOOKBACK_DAYS ago
    const date7 = new Date(now)
    date7.setDate(now.getDate() - LOOKBACK_DAYS)
    const date7Label = dateLabelUTC(date7)

    const alertsByParent = new Map<string, { studentId: string; studentName?: string; subjectId: string; subjectName?: string; prev: number; curr: number; delta: number; examDate?: Date | null }[]>()

    for (const plan of plans) {
      try {
        if (!plan.subjectId) continue
        const subjectId = plan.subjectId
        // Gate: exam within EXAM_WINDOW_DAYS
        if (!plan.examDate) continue
        const daysToExam = Math.ceil((plan.examDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        if (daysToExam > EXAM_WINDOW_DAYS) continue

        const curr = await computeReadinessScore(plan.studentId, subjectId).catch(() => null)
        if (!curr) continue
        const currScore = Math.round(curr.score)

        // Fetch historical snapshot from Redis (written by precomputeReadiness job)
        let prevScore: number | null = null
        try {
          if (redis) {
            const key = `readiness:history:${plan.studentId}:${plan.subjectId}:${date7Label}`
            const v = await redis.get(key)
            if (v) prevScore = Number(v)
          }
        } catch (e) {
          // ignore redis errors
          logger.error('readinessDrop.redisReadFailed', { err: String(e), studentId: plan.studentId, subjectId: plan.subjectId })
        }

        if (prevScore === null) continue // no historical data

        const delta = prevScore - currScore
        if (delta >= READINESS_DROP_THRESHOLD) {
          // Send student notification (push) — rate-limited per student+subject
          try {
            const studentKey = `student:alert:readiness:last_sent:${plan.studentId}:${subjectId}`
            let studentAlready = false
            try { if (redis) { const v = await redis.get(studentKey); if (v) studentAlready = true } } catch (e) { logger.warn('readinessDrop.redisCheckFailed', { err: String(e), studentId: plan.studentId }) }
            if (!studentAlready) {
              const subjName = subjectNameById.get(subjectId) ?? 'the subject'
              await sendPushSafe(plan.studentId, PUSH_NOTIFICATIONS.readiness_drop(subjName, delta))
              try { if (redis) await redis.set(studentKey, '1', 'EX', RATE_LIMIT_DAYS * 24 * 60 * 60) } catch (e) { logger.warn('readinessDrop.studentRateLimitSetFailed', { err: String(e), studentId: plan.studentId }) }
            }
          } catch (e) {
            logger.error('readinessDrop.sendStudentPushFailed', { err: String(e), studentId: plan.studentId, subjectId })
          }

          // Notify all parents of this student (aggregate later per-parent)
          const parents = parentsByStudent.get(plan.studentId) ?? []
          for (const p of parents) {
            const key = `parent:alert:readiness:last_sent:${p.parentId}:${plan.studentId}:${plan.subjectId}`
            let already = false
            try { if (redis) { const v = await redis.get(key); if (v) already = true } } catch {}
            if (already) continue

            const a = alertsByParent.get(p.parentId) ?? []
            a.push({ studentId: plan.studentId, subjectId, subjectName: subjectNameById.get(subjectId), prev: prevScore, curr: currScore, delta, examDate: plan.examDate })
            alertsByParent.set(p.parentId, a)
          }
        }
      } catch (err) {
        logger.error('readinessDrop.errorProcessingPlan', { err: err instanceof Error ? err.message : String(err), plan })
      }
    }

    // Send alerts per parent
    for (const [parentId, issues] of alertsByParent) {
      try {
        const parent = parentById.get(parentId)
        if (!parent) continue

        // Build remediation using LLM per issue (best-effort)
        const remediationParts: string[] = []
        for (const it of issues) {
          try {
            // Avoid sending internal IDs to the LLM; provide non-identifying context instead.
            const prompt = `You are an experienced, gentle education coach writing for a parent with low technical familiarity. Subject: ${it.subjectName ?? 'the subject'}. Seven days ago readiness was ${it.prev}%. Now it is ${it.curr}%. In 2-3 short bullets (each 8-16 words) suggest a simple remediation plan that includes 3 targeted 20-minute sessions and one brief practice activity the parent can encourage. Use a warm, constructive tone; avoid alarmist language; give a one-line call-to-action at the end.`
            let raw: string
            if (process.env.ALLOW_LLM_CALLS === '1') {
              const res = await callLLM({ prompt, model: process.env.MODEL_SMALL || 'gpt-4o-mini', meta: { promptType: 'parent_readiness_remediation', subject: it.subjectName ?? it.subjectId, daysAgo: LOOKBACK_DAYS } }).catch(() => null)
              raw = (res?.content && String(res.content).trim()) || `Try 3 targeted 20-minute sessions on the core topics and one short practice test.`
            } else {
              // Fallback when LLM calls are not allowed in this runtime
              raw = `Try 3 targeted 20-minute sessions on the core topics and one short practice test.`
            }
            const content = sanitizeTextForHtml(raw)
            remediationParts.push(`<h4>${escapeHtml(String(it.subjectName ?? it.subjectId))} (${it.delta} point drop)</h4><p>${content}</p>`)
          } catch (e) {
            remediationParts.push(`<h4>${it.subjectName ?? it.subjectId} (${it.delta} point drop)</h4><p>Try 3 targeted 20-minute sessions on key topics and a short practice test.</p>`)
          }
        }

        const dashboardLink = `${appUrl}/parent/dashboard?child=${issues[0].studentId}`
        const subject = `Attention: readiness drop detected` 
        const html = `<!doctype html><html><body><p>Hi ${escapeHtml(parent.name ?? '')},</p><p>We detected a drop in exam readiness for the following subject(s):</p>${remediationParts.join('')}<p>Open the dashboard to see details: <a href="${dashboardLink}">View dashboard</a></p><p>— Team Spinzy</p></body></html>`

        // Send email and SMS, but only mark rate-limit if at least one channel succeeded
        let emailSent = false
        let smsSent = false
        if (!parent.email && !parent.phone) {
          logger.info('readinessDrop.noContactDetails', { parentId, count: issues.length })
        }
        if (parent.email) {
          try {
            await sendMailSafe({ to: parent.email, subject, html, text: subject })
            emailSent = true
          } catch (e) {
            logger.error('readinessDrop.sendMailFailed', { err: String(e), parentId })
          }
        }
        if (parent.phone) {
          const smsText = `Alert: ${issues.length} readiness drop(s) detected for your child. Open: ${dashboardLink}`
          try {
            await sendSms(parent.phone, smsText)
            smsSent = true
          } catch (e) {
            logger.error('readinessDrop.sendSmsFailed', { err: String(e), parentId })
          }
        }

        const notificationSent = emailSent || smsSent
        if (notificationSent && redis) {
          for (const it of issues) {
            try { await redis.set(`parent:alert:readiness:last_sent:${parentId}:${it.studentId}:${it.subjectId}`, '1', 'EX', RATE_LIMIT_DAYS * 24 * 60 * 60) } catch (e) { logger.warn('readinessDrop.rateLimitSetFailed', { err: String(e), parentId }) }
          }
        }

        if (notificationSent) {
          logger.info('readinessDrop.alertSent', { parentId, count: issues.length, emailSent, smsSent })
        } else {
          logger.info('readinessDrop.alertNotSent', { parentId, count: issues.length, hasEmail: Boolean(parent.email), hasPhone: Boolean(parent.phone) })
        }
      } catch (err) {
        logger.error('readinessDrop.failedForParent', { parentId, err: err instanceof Error ? err.message : String(err) })
      }
    }
  } catch (err) {
    logger.error('readinessDrop.failed', { err: err instanceof Error ? err.message : String(err) })
  }
}

export default processReadinessDropAlerts
