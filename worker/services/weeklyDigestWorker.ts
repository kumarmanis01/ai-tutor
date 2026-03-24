/**
 * Weekly parent digest worker -- T39
 *
 * BullMQ processor for WEEKLY_DIGEST_QUEUE_NAME jobs.
 *
 * For each parent with at least one active linked child:
 *   1. Load sessions this week, mastery delta, streak per child
 *   2. Call GPT-4o-mini for a 2-sentence AI narrative
 *   3. Send email via lib/mailer.ts
 *
 * Never throws -- logs and continues on per-parent failures.
 */

import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { sendEmail } from '../../lib/mailer.js'
import { callLLM } from '../../lib/callLLM.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function weekStart(): Date {
  const now = new Date()
  const dow = now.getUTCDay()
  const d = new Date(now)
  d.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  d.setUTCHours(0, 0, 0, 0)
  return d
}

async function generateNarrative(
  childName: string,
  sessionsCount: number,
  topSubject: string | null,
): Promise<string> {
  const prompt = `Write a 2-sentence encouraging progress summary for a parent.
Student: ${childName}, Sessions this week: ${sessionsCount}, Top improvement: ${topSubject ?? 'not recorded'}.
Tone: warm, specific, no jargon.
Return only the 2 sentences, no JSON, no preamble.`

  try {
    const result = await callLLM({
      prompt,
      model: process.env.MODEL_SMALL || 'gpt-4o-mini',
      meta: { promptType: 'parent_digest_narrative', childName },
    })
    return result.content?.trim() ?? ''
  } catch {
    return ''
  }
}

function buildEmailHtml(params: {
  parentName: string
  childName: string
  sessionsThisWeek: number
  streak: number
  readinessDelta: number | null
  narrative: string
  dashboardUrl: string
}): string {
  const { parentName, childName, sessionsThisWeek, streak, readinessDelta, narrative, dashboardUrl } = params

  const deltaLine =
    readinessDelta !== null && readinessDelta > 0.05
      ? `<p style="color:#16A34A;margin:4px 0;">📈 Mastery improving this week</p>`
      : readinessDelta !== null && readinessDelta < -0.05
      ? `<p style="color:#DC2626;margin:4px 0;">📉 A few concepts need more practice</p>`
      : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1F2937;">
  <div style="text-align:center;margin-bottom:20px;">
    <img src="https://spinzy.in/logos/logo-email.png" width="176" height="50" alt="Spinzy Academy" style="display:block;margin:0 auto">
    <p style="color:#6B7280;margin:8px 0 0;font-size:13px;">Weekly learning update</p>
  </div>

  <p>Hi ${parentName},</p>

  <div style="border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:16px 0;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#1F2937;">${childName}</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="padding:8px;text-align:center;background:#EEF2FF;border-radius:8px;width:50%;">
          <div style="font-size:22px;font-weight:bold;color:#4F46E5;">${sessionsThisWeek}</div>
          <div style="font-size:12px;color:#6B7280;">Sessions this week</div>
        </td>
        <td style="padding:8px;text-align:center;background:#FEF3C7;border-radius:8px;width:50%;">
          <div style="font-size:22px;font-weight:bold;color:#D97706;">🔥 ${streak}</div>
          <div style="font-size:12px;color:#6B7280;">Day streak</div>
        </td>
      </tr>
    </table>

    ${deltaLine}

    ${narrative
      ? `<div style="margin-top:12px;padding:12px;background:#F0FDF4;border-radius:8px;border-left:3px solid #16A34A;">
           <p style="margin:0;font-size:14px;color:#166534;">${narrative}</p>
         </div>`
      : ''}
  </div>

  <div style="text-align:center;margin-top:20px;">
    <a href="${dashboardUrl}" style="display:inline-block;padding:12px 28px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
      View full progress →
    </a>
  </div>

  <p style="color:#9CA3AF;font-size:11px;text-align:center;margin-top:24px;">
    You're receiving this because you have linked student accounts on Spinzy.
  </p>
</body>
</html>`
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processWeeklyDigest(): Promise<void> {
  const monday = weekStart()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const appUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  const weekLabel = monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  // All parents with at least one active link
  const parentLinks = await prisma.parentStudent.findMany({
    where: { status: 'active' },
    select: {
      parentId: true,
      studentId: true,
      parent: { select: { name: true, email: true } },
      student: { select: { name: true } },
    },
    distinct: ['parentId'],
  })

  // Group children by parent
  const parentMap = new Map<
    string,
    { name: string; email: string; children: { studentId: string; name: string }[] }
  >()

  // Re-fetch all links (not just distinct parentId)
  const allLinks = await prisma.parentStudent.findMany({
    where: { status: 'active' },
    select: {
      parentId: true,
      studentId: true,
      parent: { select: { name: true, email: true } },
      student: { select: { name: true } },
    },
  })

  for (const link of allLinks) {
    if (!link.parent.email) continue
    if (!parentMap.has(link.parentId)) {
      parentMap.set(link.parentId, {
        name: link.parent.name ?? 'Parent',
        email: link.parent.email,
        children: [],
      })
    }
    parentMap.get(link.parentId)!.children.push({
      studentId: link.studentId,
      name: link.student.name ?? 'Student',
    })
  }

  let sent = 0

  for (const [, parent] of parentMap) {
    try {
      // Process first child for digest (multi-child digests would loop here)
      const child = parent.children[0]
      if (!child) continue

      // Sessions this week
      const sessions = await prisma.structuredSession.findMany({
        where: { studentId: child.studentId, startedAt: { gte: monday } },
        select: { id: true },
      })

      // Streak
      const streak = await prisma.studentStreak.findFirst({
        where: { studentId: child.studentId, kind: 'daily' },
        select: { current: true },
      })

      // Top subject (most recent activity)
      const recentState = await prisma.studentConceptState.findFirst({
        where: {
          studentId: child.studentId,
          updatedAt: { gte: sevenDaysAgo },
        },
        orderBy: { masteryScore: 'desc' },
        select: { concept: { select: { subject: { select: { name: true } } } } },
      })
      const topSubject = recentState?.concept?.subject?.name ?? null

      // Mastery delta (proxy)
      const [recentStates, allStates] = await Promise.all([
        prisma.studentConceptState.findMany({
          where: { studentId: child.studentId, updatedAt: { gte: sevenDaysAgo } },
          select: { masteryScore: true },
        }),
        prisma.studentConceptState.findMany({
          where: { studentId: child.studentId },
          select: { masteryScore: true },
        }),
      ])

      let readinessDelta: number | null = null
      if (recentStates.length > 0 && allStates.length > 0) {
        const allAvg = allStates.reduce((s, r) => s + r.masteryScore, 0) / allStates.length
        const recentAvg = recentStates.reduce((s, r) => s + r.masteryScore, 0) / recentStates.length
        readinessDelta = recentAvg - allAvg
      }

      // AI narrative
      const narrative = await generateNarrative(child.name, sessions.length, topSubject)

      // Build and send email
      const subject = `Teacher Vidya's weekly report for ${child.name}`
      const html = buildEmailHtml({
        parentName: parent.name,
        childName: child.name,
        sessionsThisWeek: sessions.length,
        streak: streak?.current ?? 0,
        readinessDelta,
        narrative,
        dashboardUrl: `${appUrl}/parent/dashboard`,
      })

      await sendEmail({ to: parent.email, subject, html, text: subject })
      sent++
      logger.info('[weeklyDigest] sent', { parentEmail: parent.email, childName: child.name })
    } catch (err) {
      logger.error('[weeklyDigest] failed for parent', {
        email: parent.email,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('[weeklyDigest] completed', { sent, total: parentMap.size })
}
