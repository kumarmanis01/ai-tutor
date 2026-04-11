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
 *
 * EDIT LOG:
 * - 2026-04-09 | copilot | respect excludeFromParentReport when selecting parent links
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMailSafe } from '@/lib/mailer'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'
import { callLLM } from '@/lib/callLLM'
import { getLocalDateString, startOfLocalDayUtc } from '@/lib/engagement/timezone'

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

  // All parents with at least one active link. Exclude students who opted out of parent reports.
  const allLinks = await prisma.parentStudent.findMany({
    where: { status: 'active', excludeFromParentReport: false },
    select: {
      parentId: true,
      studentId: true,
      parent: { select: { name: true, email: true, timezone: true } },
      student: { select: { name: true } },
    },
  })

  // Group children by parent
  const parentMap = new Map<string, { name: string; email: string; timezone?: string; children: { studentId: string; name: string }[] }>()
  for (const link of allLinks) {
    if (!link.parent.email) continue
    if (!parentMap.has(link.parentId)) {
      parentMap.set(link.parentId, {
        name: link.parent.name ?? 'Parent',
        email: link.parent.email,
        timezone: link.parent.timezone ?? undefined,
        children: [],
      })
    }
    parentMap.get(link.parentId)!.children.push({
      studentId: link.studentId,
      name: link.student.name ?? 'Student',
    })
  }

  // Bulk-load parent profiles (digest prefs)
  const parentIds = Array.from(parentMap.keys())
  const profiles = parentIds.length
    ? await prisma.parentProfile.findMany({ where: { userId: { in: parentIds } } })
    : []
  // Explicit typing ensures Map.get() returns the correct Prisma type, not unknown.
  const profileMap = new Map<string, typeof profiles[0]>(profiles.map((p) => [p.userId, p]))

  let scheduled = 0

  for (const [parentId, parent] of parentMap.entries()) {
    try {
      const profile = profileMap.get(parentId as string) ?? null

      // Respect opt-out
      if (profile?.digestOptOut) {
        logger.info('[weeklyDigest] parent opted out, skipping', { parentId, email: parent.email })
        continue
      }

      // Compute delivery time in parent's timezone (default fallbacks)
      const preferredDay = profile?.digestDay ?? 'Sunday'
      const preferredTime = profile?.digestTime ?? '09:00'
      const tz = profile?.digestTimezone ?? parent.timezone ?? process.env.DEFAULT_TIMEZONE ?? 'Asia/Kolkata'

      // Compute next UTC instant for the parent's preferred day/time
      const deliverAt = computeNextDeliveryUtc(preferredDay, preferredTime, tz)

      // Dedup key for this parent-week to avoid duplicate outbox rows
      const dedupKey = `weeklyDigest:${parentId}:${monday.toISOString().slice(0, 10)}`

      const existing = await prisma.outbox.findFirst({ where: { meta: { path: ['dedupKey'], equals: dedupKey } } })
      if (existing) {
        logger.info('[weeklyDigest] outbox exists, skipping create', { parentId, dedupKey })
        continue
      }

      // Create scheduled outbox row. Outbox dispatcher will respect meta.deliverAt.
      await prisma.outbox.create({
        data: {
          queue: 'PARENT_DIGEST',
          payload: {
            type: 'PARENT_DIGEST',
            payload: { parentId, weekStart: monday.toISOString() },
          },
          meta: { dedupKey, parentId, weekStart: monday.toISOString(), deliverAt: deliverAt.toISOString() },
        },
      })

      scheduled++
      logger.info('[weeklyDigest] scheduled outbox', { parentId, email: parent.email, deliverAt: deliverAt.toISOString() })
    } catch (err) {
      logger.error('[weeklyDigest] scheduling failed for parent', {
        parentId,
        email: parent.email,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('[weeklyDigest] scheduling completed', { scheduled, total: parentMap.size })
}

/**
 * Compute the next UTC Date for the given weekday name and HH:mm time in the provided IANA timezone.
 */
export function computeNextDeliveryUtc(weekdayName: string, timeHHmm: string, timezone: string): Date {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const now = new Date()
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata'

  // Current local weekday index in tz
  const currentWeekdayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(now)
  const currentIndex = weekdays.indexOf(currentWeekdayName)
  const targetIndex = Math.max(0, weekdays.indexOf(weekdayName))
  let deltaDays = (targetIndex - currentIndex + 7) % 7

  // Local date string for today in TZ
  const todayLocal = getLocalDateString(now, tz) // YYYY-MM-DD
  // Midnight UTC for today local
  const todayMidnightUtc = startOfLocalDayUtc(todayLocal, tz)

  // Candidate day midnight UTC
  const candidateMidnightUtc = new Date(todayMidnightUtc.getTime() + deltaDays * 24 * 60 * 60 * 1000)

  // Parse HH:mm
  const [hh, mm] = (timeHHmm || '09:00').split(':').map((s) => parseInt(s, 10))
  const deliverAt = new Date(candidateMidnightUtc.getTime() + (isNaN(hh) ? 9 : hh) * 60 * 60 * 1000 + (isNaN(mm) ? 0 : mm) * 60 * 1000)

  // If the deliverAt has already passed (in UTC), schedule for next week
  if (deliverAt.getTime() <= Date.now()) {
    return new Date(deliverAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  return deliverAt
}

/**
 * Handler for a single-parent digest job. This is invoked by the content worker when an outbox row is due.
 */
export async function processParentDigest(parentId: string, weekStartIso: string | null | undefined): Promise<void> {
  const monday = weekStartIso ? new Date(weekStartIso) : weekStart()
  try {
    // Load first active child for the parent
    const link = await prisma.parentStudent.findFirst({ where: { parentId, status: 'active', excludeFromParentReport: false }, select: { studentId: true, student: { select: { name: true } }, parent: { select: { name: true, email: true } } } })
    if (!link || !link.parent?.email) {
      logger.info('[parentDigest] no active child or email, skipping', { parentId })
      return
    }

    const parent = { id: parentId, name: link.parent.name ?? 'Parent', email: link.parent.email }
    const child = { studentId: link.studentId, name: link.student?.name ?? 'Student' }

    // Sessions this week
    const sessions = await prisma.structuredSession.findMany({ where: { studentId: child.studentId, startedAt: { gte: monday } }, select: { id: true } })

    // Streak
    const streak = await prisma.studentStreak.findFirst({ where: { studentId: child.studentId, kind: 'daily' }, select: { current: true } })

    // Top subject (most recent activity)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentState = await prisma.studentConceptState.findFirst({ where: { studentId: child.studentId, updatedAt: { gte: sevenDaysAgo } }, orderBy: { masteryScore: 'desc' }, select: { concept: { select: { subject: { select: { name: true } } } } } })
    const topSubject = recentState?.concept?.subject?.name ?? null

    // Mastery delta (proxy)
    const [recentStates, allStates] = await Promise.all([
      prisma.studentConceptState.findMany({ where: { studentId: child.studentId, updatedAt: { gte: sevenDaysAgo } }, select: { masteryScore: true } }),
      prisma.studentConceptState.findMany({ where: { studentId: child.studentId }, select: { masteryScore: true } }),
    ])

    let readinessDelta: number | null = null
    if (recentStates.length > 0 && allStates.length > 0) {
      const allAvg = allStates.reduce((s, r) => s + r.masteryScore, 0) / allStates.length
      const recentAvg = recentStates.reduce((s, r) => s + r.masteryScore, 0) / recentStates.length
      readinessDelta = recentAvg - allAvg
    }

    const narrative = await generateNarrative(child.name, sessions.length, topSubject)

    const subject = `Teacher Vidya's weekly report for ${child.name}`
    const appUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
    const html = buildEmailHtml({ parentName: parent.name, childName: child.name, sessionsThisWeek: sessions.length, streak: streak?.current ?? 0, readinessDelta, narrative, dashboardUrl: `${appUrl}/parent/dashboard` })

    await sendParentMilestoneNotification(parentId, { email: parent.email, subject, html, text: subject, meta: { type: 'digest', channel: 'email' } })
    logger.info('[parentDigest] sent via delivery helper', { parentId, email: parent.email, childName: child.name })
  } catch (err) {
    logger.error('[parentDigest] failed', { parentId, error: err instanceof Error ? err.message : String(err) })
  }
}
