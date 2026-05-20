/**
 * FILE OBJECTIVE:
 * - Weekly parent digest worker processor for WEEKLY_DIGEST_QUEUE_NAME.
 * - Schedules/send digest notifications for active parent-child links with per-week dedup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/weeklyDigestWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | respect excludeFromParentReport when selecting parent links
 * - 2026-05-04T00:00:00Z | copilot | normalize local outbox row type comment and maintain dedup outbox lookup
 * - 2026-05-05T00:00:00Z | copilot | align header to engineering template for PR review compliance
 */

import { prisma } from '@/lib/prisma'

// Local row types for strict mode
type ParentStudentLinkRow = {
  parentId: string;
  studentId: string;
  parent: { name: string | null; email: string | null; timezone?: string | null };
  student: { name: string | null };
};
type ParentProfileRow = ParentProfileLocal;
type OutboxRow = { meta: { path: string[]; equals: string } };
// Local minimal ParentProfile shape used for runtime checks and type-narrowing.
// Keep this in sync with the Prisma model `ParentProfile` in prisma/schema.prisma.
type ParentProfileLocal = {
  userId: string
  digestOptOut?: boolean
  digestDay?: string
  digestTime?: string
  digestTimezone?: string
}
import { logger } from '@/lib/logger'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'
import { callLLM } from '@/lib/callLLM'
import { getLocalDateString, startOfLocalDayUtc } from '@/lib/engagement/timezone'
import { sendSms } from '@/lib/sms'
import { weeklyDigestParentHtml } from '@/lib/email/templates'

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

// Uses centralized weeklyDigestParentHtml in lib/email/templates

// ── Main processor ────────────────────────────────────────────────────────────

export async function processWeeklyDigest(): Promise<void> {
  const monday = weekStart()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const appUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  const weekLabel = monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  // All parents with at least one active link. Exclude students who opted out of parent reports.

  // Local row type for parentStudent link
  type ParentStudentLinkRowStrict = {
    parentId: string;
    studentId: string;
    parent: { name: string | null; email: string | null; timezone?: string | null };
    student: { name: string | null };
  };
  const allLinks = await prisma.parentStudent.findMany({
    where: { status: 'active', excludeFromParentReport: false },
    select: {
      parentId: true,
      studentId: true,
      parent: { select: { name: true, email: true, timezone: true } },
      student: { select: { name: true } },
    },
  }) as ParentStudentLinkRowStrict[]

  // Group children by parent
  const parentMap = new Map<string, { name: string; email: string; timezone?: string; children: { studentId: string; name: string }[] }>()
  for (const link of allLinks as ParentStudentLinkRow[]) {
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

  // Local row type for parentProfile
  type ParentProfileRowStrict = ParentProfileLocal;
  const profiles = parentIds.length
    ? await prisma.parentProfile.findMany({ where: { userId: { in: parentIds } } }) as ParentProfileRowStrict[]
    : []
  const profileMap = new Map(profiles.map((p: ParentProfileRowStrict) => [p.userId, p]))

  let scheduled = 0

  for (const [parentId, parent] of parentMap.entries()) {
    try {
      const profile = (profileMap.get(parentId as string) ?? null) as ParentProfileLocal | null

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

      // Local row type for outbox -- treat `meta` as unknown/any and narrow at runtime
      type OutboxRowStrict = { meta: any } | null;
      const existing = (await prisma.outbox.findFirst({ where: { meta: { path: ['dedupKey'], equals: dedupKey } } })) as OutboxRowStrict
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
        error: err instanceof Error ? (err as Error).message : String(err),
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
  const deltaDays = (targetIndex - currentIndex + 7) % 7

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
    // Local row type for parentStudent link (single)
    type ParentStudentLinkSingleRow = { studentId: string; student: { name: string | null }; parent: { name: string | null; email: string | null; phone?: string | null } } | null;
    const link = await prisma.parentStudent.findFirst({ where: { parentId, status: 'active', excludeFromParentReport: false }, select: { studentId: true, student: { select: { name: true } }, parent: { select: { name: true, email: true, phone: true } } } }) as ParentStudentLinkSingleRow
    if (!link || !link.parent?.email) {
      logger.info('[parentDigest] no active child or email, skipping', { parentId })
      return
    }

    const parent = { id: parentId, name: link.parent.name ?? 'Parent', email: link.parent.email, phone: (link.parent as any).phone ?? null }
    const child = { studentId: link.studentId, name: link.student?.name ?? 'Student' }

    // Sessions this week
    // Local row type for structuredSession
    type StructuredSessionRow = { id: string };
    const sessions = await prisma.structuredSession.findMany({ where: { studentId: child.studentId, startedAt: { gte: monday } }, select: { id: true } }) as StructuredSessionRow[]

    // Streak
    // Local row type for studentStreak
    type StudentStreakRow = { current: number | null } | null;
    const streak = await prisma.studentStreak.findFirst({ where: { studentId: child.studentId, kind: 'daily' }, select: { current: true } }) as StudentStreakRow

    // Top subject (most recent activity)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    // Local row type for studentConceptState
    type StudentConceptStateRow = { concept?: { subject?: { name?: string | null } | null } | null } | null;
    const recentState = await prisma.studentConceptState.findFirst({ where: { studentId: child.studentId, updatedAt: { gte: sevenDaysAgo } }, orderBy: { masteryScore: 'desc' }, select: { concept: { select: { subject: { select: { name: true } } } } } }) as StudentConceptStateRow
    const topSubject = recentState?.concept?.subject?.name ?? null

    // Mastery delta (proxy)
    // Local row type for studentConceptState mastery
    type StudentConceptStateMasteryRow = { masteryScore: number };
    const [recentStates, allStates] = await Promise.all([
      prisma.studentConceptState.findMany({ where: { studentId: child.studentId, updatedAt: { gte: sevenDaysAgo } }, select: { masteryScore: true } }) as Promise<StudentConceptStateMasteryRow[]>,
      prisma.studentConceptState.findMany({ where: { studentId: child.studentId }, select: { masteryScore: true } }) as Promise<StudentConceptStateMasteryRow[]>,
    ])

    let readinessDelta: number | null = null
    if (recentStates.length > 0 && allStates.length > 0) {
      const allAvg = allStates.reduce((s: number, r: StudentConceptStateMasteryRow) => s + r.masteryScore, 0) / allStates.length
      const recentAvg = recentStates.reduce((s: number, r: StudentConceptStateMasteryRow) => s + r.masteryScore, 0) / recentStates.length
      readinessDelta = recentAvg - allAvg
    }

    const narrative = await generateNarrative(child.name, sessions.length, topSubject)

    const subject = `Teacher Vidya's weekly report for ${child.name}`
    const appUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
    const html = weeklyDigestParentHtml({ parentName: parent.name, childName: child.name, sessionsThisWeek: sessions.length, streak: streak?.current ?? 0, readinessDelta, narrative, dashboardUrl: `${appUrl}/parent/dashboard` })

    await sendParentMilestoneNotification(parentId, { email: parent.email, subject, html, text: subject, meta: { type: 'digest', channel: 'email' } })
    if (parent.phone) {
      const smsUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
      await sendSms(parent.phone, "Weekly digest: ${child.name}'s summary is ready. View: ${smsUrl}/parent/dashboard")
    }
    logger.info('[parentDigest] sent via delivery helper', { parentId, email: parent.email, childName: child.name })
  } catch (err) {
    logger.error('[parentDigest] failed', { parentId, error: err instanceof Error ? err.message : String(err) })
  }
}
