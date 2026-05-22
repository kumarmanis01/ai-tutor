/**
 * FILE OBJECTIVE:
 * - Check and award session badges and notify parents for milestone badges.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/badges.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | wired parent milestone notifications; added tests
 * - 2026-05-13T00:00:00Z | copilot | emit badge-awarded analytics (`STUDENT.BADGE_NEW_BADGE`) for newly awarded badges (best-effort)
 */

import { prisma } from '@/lib/prisma'
import { unlockCosmeticsForStreak } from '@/lib/student/cosmetics-service'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'
import { buildMilestoneTemplate } from '@/lib/whatsapp/templates'
import { milestoneEmailHtml } from '@/lib/email/templates'
import { logger } from '@/lib/logger'
import { emitServerAnalyticsEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

export interface BadgeDefinition {
  key: string
  name: string
  description: string
  icon: string
}

// AC-04 (F-STU-031): badge types for session events.
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  { key: 'streak_7',       name: '7-Day Streak',   description: '7 consecutive days of learning',   icon: 'fire' },
  { key: 'streak_14',      name: '14-Day Streak',  description: '14 consecutive days of learning',  icon: 'fire' },
  { key: 'streak_30',      name: '30-Day Streak',  description: '30 consecutive days of learning',  icon: 'trophy' },
  { key: 'streak_60',      name: '60-Day Streak',  description: '60 consecutive days of learning',  icon: 'diamond' },
  { key: 'streak_100',     name: '100-Day Streak', description: '100 consecutive days of learning', icon: 'crown' },
  { key: 'consistency',    name: 'Consistent',     description: '5 sessions completed in 7 days',   icon: 'lightning' },
  { key: 'comeback',       name: 'Comeback',       description: 'Returned to learning after a break', icon: 'muscle' },
  { key: 'chapter_master', name: 'Chapter Master', description: 'Mastered a chapter concept',       icon: 'star' },
  { key: 'mock_complete',  name: 'Mock Champ',     description: 'Completed your first full mock exam', icon: 'medal' },
  { key: 'speedster',      name: 'Speedster',      description: 'High accuracy with fast completion', icon: 'zap' },
]

const BADGE_BY_KEY = new Map(BADGE_DEFINITIONS.map((b) => [b.key, b]))

// Streak thresholds that unlock milestone badges.
const STREAK_MILESTONES: readonly [number, string][] = [
  [7,   'streak_7'],
  [14,  'streak_14'],
  [30,  'streak_30'],
  [60,  'streak_60'],
  [100, 'streak_100'],
]

/**
 * Check and award any badges earned in the current session.
 *
 * Checks (in order):
 * 1. Streak milestones (7 / 14 / 30 / 60 / 100 days) using currentStreak.
 * 2. Consistency  -- 5 completed sessions in the past 7 days.
 * 3. Comeback     -- previous session ended > 7 days before this one.
 * 4. Chapter master -- masteryAfter >= 0.80 for the session concept.
 *
 * Newly-earned badge rows are inserted with skipDuplicates so the function
 * is safe to call more than once for the same session (idempotent).
 * Badge definition rows are upserted automatically (no separate seed step).
 *
 * Returns only badges that are newly awarded this call (not previously held).
 * Never throws -- returns [] on any error.
 */
export async function checkSessionBadges(params: {
  studentId: string
  sessionId: string
  currentStreak: number
  masteryAfter: number
  // Optional performance signals for speed badge detection
  accuracy?: number // 0..1
  avgTimeSeconds?: number
}): Promise<BadgeDefinition[]> {
  const { studentId, sessionId, currentStreak, masteryAfter, accuracy, avgTimeSeconds } = params

  try {
    const existing = (await prisma.userBadge.findMany({
      where: { studentId },
      select: { badgeKey: true },
    })) as Array<{ badgeKey: string }>
    const heldKeys = new Set(existing.map((b: { badgeKey: string }) => b.badgeKey))

    const toAward: BadgeDefinition[] = []

    // 1. Streak milestones
    for (const [threshold, key] of STREAK_MILESTONES) {
      if (currentStreak >= threshold && !heldKeys.has(key)) {
        const defn = BADGE_BY_KEY.get(key)
        if (defn) toAward.push(defn)
      }
    }

    // 2. Consistency: >= 5 completed sessions in the past 7 days
    if (!heldKeys.has('consistency')) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const recentCount = await prisma.learningSession.count({
        where: {
          studentId,
          isCompleted: true,
          endedAt: { gte: sevenDaysAgo },
        },
      })
      if (recentCount >= 5) {
        const defn = BADGE_BY_KEY.get('consistency')
        if (defn) toAward.push(defn)
      }
    }

    // 3. Comeback: previous completed session ended > 7 days ago
    if (!heldKeys.has('comeback')) {
      const prevSession = await prisma.learningSession.findFirst({
        where: { studentId, id: { not: sessionId }, isCompleted: true, endedAt: { not: null } },
        orderBy: { endedAt: 'desc' },
        select: { endedAt: true },
      })
      if (prevSession?.endedAt) {
        const gapDays = (Date.now() - prevSession.endedAt.getTime()) / (24 * 60 * 60 * 1000)
        if (gapDays > 7) {
          const defn = BADGE_BY_KEY.get('comeback')
          if (defn) toAward.push(defn)
        }
      }
    }

    // 4. Chapter master: concept mastery >= 0.80
    if (!heldKeys.has('chapter_master') && masteryAfter >= 0.8) {
      const defn = BADGE_BY_KEY.get('chapter_master')
      if (defn) toAward.push(defn)
    }

    // 5. Speedster: high accuracy with fast completion (heuristic)
    // Only check when caller provided accuracy and avgTimeSeconds.
    if (!heldKeys.has('speedster') && typeof accuracy === 'number' && typeof avgTimeSeconds === 'number') {
      // Award if >=90% accuracy and average time per question < 60s
      if (accuracy >= 0.9 && avgTimeSeconds <= 60) {
        const defn = BADGE_BY_KEY.get('speedster')
        if (defn) toAward.push(defn)
      }
    }

    if (toAward.length === 0) return []

    // AC-06 (F-STU-030): whenever a streak milestone badge is awarded, also unlock the
    // corresponding cosmetic reward. Fire-and-forget -- cosmetic failure must not
    // block badge awarding.
    const awardingStreakBadge = toAward.some((b) => b.key.startsWith('streak_'))
    if (awardingStreakBadge) {
      void unlockCosmeticsForStreak(studentId, currentStreak)
    }

    // Upsert badge definitions (auto-seed) then record awards atomically.
    await prisma.$transaction([
      ...toAward.map((b) =>
        prisma.badge.upsert({
          where: { key: b.key },
          create: { key: b.key, name: b.name, description: b.description, icon: b.icon },
          update: {},
        }),
      ),
      prisma.userBadge.createMany({
        data: toAward.map((b) => ({ studentId, badgeKey: b.key })),
        skipDuplicates: true,
      }),
    ])

    // Fire parent-facing milestone notifications (best-effort).
    try {
      const student = await prisma.user.findUnique({ where: { id: studentId }, select: { name: true } })
      const parentLinks = (await prisma.parentStudent.findMany({
        where: { studentId, status: 'active' },
        include: { parent: { select: { id: true, email: true, phone: true, whatsappPhone: true, name: true, language: true } } },
      })) as Array<{ parent: { id: string; email?: string | null; phone?: string | null; whatsappPhone?: string | null; name?: string | null; language?: string | null } }>

      if (parentLinks.length > 0) {
        const studentName = student?.name ?? 'Your child'
        const badgeNames = toAward.map((b) => b.name).join(', ')
        const subject = `${studentName} just earned a new badge!`
        const baseUrl = process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com'
        const dashboardUrl = `${baseUrl}/parent/dashboard`

        const sends = parentLinks.map((pl) => {
          // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
          const brandedHtml = milestoneEmailHtml({
            parentName: pl.parent.name ?? 'Parent',
            studentName,
            milestoneLabel: badgeNames,
            dashboardUrl,
          })
          const waTemplate = pl.parent.whatsappPhone
            ? buildMilestoneTemplate(pl.parent.name ?? 'Parent', studentName, badgeNames, dashboardUrl)
            : undefined
          return sendParentMilestoneNotification(pl.parent.id, {
            email: pl.parent.email ?? undefined,
            whatsappPhone: pl.parent.whatsappPhone ?? undefined,
            whatsappTemplate: waTemplate,
            subject,
            html: brandedHtml,
            meta: { studentId, type: 'milestone', locale: pl.parent.language ?? undefined },
          })
        })

        await Promise.allSettled(sends)
      }
    } catch (err) {
      logger.warn('badges: parent notification failed', { studentId, error: String(err) })
    }

    // Analytics: emit events for newly awarded badges (best-effort)
    try {
      for (const b of toAward) {
        void emitServerAnalyticsEvent({
          eventType: ANALYTICS_EVENTS.STUDENT.BADGE_NEW_BADGE,
          userId: studentId,
          metadata: { badgeKey: b.key, badgeName: b.name, sessionId },
        }, 'badges.award')
      }
    } catch (err) {
      logger.warn('badges: analytics emit failed', { studentId, error: String(err) })
    }

    return toAward
  } catch {
    return []
  }
}
