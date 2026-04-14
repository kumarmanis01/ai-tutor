/**
 * Student Dashboard -- v2 (rebuilt)
 *
 * F-STU-032 AC-01: Dashboard is the only screen shown after login.
 * F-STU-032 AC-02: Shows Today's plan, Streak+XP, Revision cards, Subject readiness.
 * F-STU-032 AC-03: Primary CTA is always "Continue Learning" -- one tap.
 * F-STU-032 AC-05: Dashboard loads in <2 seconds -- all data in Promise.all.
 * F-STU-040 AC-02: Freemium session cap counter always visible for free-tier students.
 *
 * Layout:
 *   Mobile (default):  single column
 *   Desktop (md:):     left 60% = today/XP/weekly/revisions, right 40% = readiness/upgrade
 *
 * EDIT LOG:
 *   2026-03-15 | v2 migration | full rebuild; replaces v1 dashboard
 *   2026-04-14 | gap-fix P1   | restore full widget set, wire server data, freemium counter
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getNextAction } from '@/lib/homeEngine/getNextAction'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import TodaysLearningCard, {
  type TodaysLearningCardProps,
} from '@/components/student/dashboard/TodaysLearningCard'
import { XPWidget } from '@/components/student/dashboard/XPWidget'
import WeeklyStudyStrip from '@/components/student/dashboard/WeeklyStudyStrip'
import { RevisionWidget } from '@/components/student/dashboard/RevisionWidget'
import { SubjectReadinessCard } from '@/components/student/dashboard/SubjectReadinessCard'
import { FreemiumCounter } from '@/components/student/dashboard/FreemiumCounter'
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Home | Spinzy AI Tutor',
  description: 'Your personalised AI tutor dashboard',
}

/** Exam crunch mode: <= 14 days to exam date. */
function computeCrunchMode(examDate: Date | null | undefined): boolean {
  if (!examDate) return false
  const daysToExam = Math.ceil((examDate.getTime() - Date.now()) / 86400000)
  return daysToExam >= 0 && daysToExam <= 14
}

const FREE_TIER_SESSION_CAP = 3

export default async function StudentHomeDashboardPage() {
  const authSession = await requireActiveSession()
  if (!authSession) redirect('/')

  const userId = (authSession.user as { id: string }).id

  // ── All data fetched in a single Promise.all (F-STU-032 AC-05: <2s target) ──
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)

  const [
    user,
    nextAction,
    freeTierUsage,
    subjects,
    weeklyActivity,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        totalXp: true,
        level: true,
        subscriptionStatus: true,
        learningPlans: {
          select: { examDate: true, subjectId: true },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    }),
    getNextAction(userId).catch(() => null),
    prisma.freeTierUsage.findUnique({
      where: { studentId: userId },
      select: { sessionsUsed: true, periodStart: true },
    }),
    prisma.subjectDef.findMany({
      where: { lifecycle: 'active' },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.structuredSession.findMany({
      where: {
        studentId: userId,
        startedAt: { gte: sevenDaysAgo },
        completedAt: { not: null },
      },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
    }),
  ])

  if (!user) redirect('/')

  const isPremium = user.subscriptionStatus === 'premium'
  const sessionsUsed = freeTierUsage?.sessionsUsed ?? 0
  const sessionsRemaining = Math.max(0, FREE_TIER_SESSION_CAP - sessionsUsed)
  const periodStart = freeTierUsage?.periodStart?.toISOString() ?? new Date(Date.now() - 15 * 86400000).toISOString()

  const latestPlan = user.learningPlans[0]
  const isCrunchMode = computeCrunchMode(latestPlan?.examDate)

  // ── XP this week from StudentXP ledger ──────────────────────────────────────
  const xpThisWeekResult = await prisma.studentXP.aggregate({
    where: {
      studentId: userId,
      createdAt: { gte: sevenDaysAgo },
    },
    _sum: { amount: true },
  })
  const xpThisWeek = xpThisWeekResult._sum.amount ?? 0

  // ── Readiness scores per subject (parallel, best-effort) ───────────────────
  const readinessResults = await Promise.all(
    subjects.map(async (sub) => {
      const result = await computeReadinessScore(userId, sub.id).catch(() => ({ score: 0, label: 'critical' as const, chapters: [] }))
      const diagnostic = await prisma.diagnosticSession.findFirst({
        where: { studentId: userId, subjectId: sub.id, status: 'COMPLETED' },
        select: { id: true },
      }).catch(() => null)
      return {
        subjectId: sub.id,
        subjectName: sub.name,
        score: result.score,
        diagnosticDone: !!diagnostic,
      }
    }),
  )

  // ── Weekly study strip data ──────────────────────────────────────────────────
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const now = new Date()
  const todayDow = now.getUTCDay() // 0=Sun
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    // Monday-based week: offset from Monday
    const dayOffset = i - (todayDow === 0 ? 6 : todayDow - 1)
    d.setUTCDate(d.getUTCDate() + dayOffset)
    return d.toISOString().split('T')[0]
  })
  const activeDateSet = new Set(
    weeklyActivity.map((s) => s.startedAt.toISOString().split('T')[0])
  )
  const weeklyStripData = {
    days: weekDays.map((date, i) => ({
      date,
      dayLabel: DAY_LABELS[i],
      hasSession: activeDateSet.has(date),
    })),
    sessionCountThisWeek: weeklyActivity.length,
    currentStreak: 0,
    weeklyGoal: 5,
  }

  // ── Build TodaysLearningCard props from getNextAction result ─────────────────
  let cardProps: TodaysLearningCardProps = { type: 'empty', diagnosticHref: '/diagnostic' }

  if (nextAction) {
    if (nextAction.ruleId === 'resume_session' && nextAction.sessionId) {
      cardProps = {
        type: 'resume',
        session: {
          sessionId: nextAction.sessionId,
          topicId: nextAction.topicId ?? '',
          topicName: nextAction.topicName ?? 'Continue where you left off',
          subject: nextAction.subject ?? '',
          chapter: nextAction.chapter ?? '',
          currentPhase: nextAction.resumePhase ?? 'OVERVIEW',
        },
      }
    } else if (nextAction.ruleId === 'homework_pending' && nextAction.assignmentId) {
      cardProps = {
        type: 'homework',
        homework: {
          id: nextAction.assignmentId,
          topicName: nextAction.topicName ?? 'Homework',
          questionCount: 5,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'PENDING',
        },
      }
    } else if (nextAction.topicId) {
      cardProps = {
        type: 'start',
        recommendation: {
          conceptId: nextAction.topicId,
          topicTitle: nextAction.topicName ?? 'Start a session',
          subject: nextAction.subject ?? '',
          estimatedTimeMin: 20,
        },
        ctaLabel: isCrunchMode ? 'Study for exam' : undefined,
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Crunch mode banner (F-STU-032 AC-04) */}
      {isCrunchMode && latestPlan?.examDate && (
        <div className="mb-4 rounded-xl bg-[#FCEBEB] dark:bg-[#E24B4A]/10 border border-[#E24B4A]/20 px-4 py-3 flex items-center gap-3">
          <span className="text-lg leading-none" aria-hidden>⏰</span>
          <div>
            <p className="text-sm font-bold text-[#E24B4A]">Exam in {Math.ceil((latestPlan.examDate.getTime() - Date.now()) / 86400000)} days</p>
            <p className="text-xs text-[#E24B4A]/80">Focus mode on -- only your most important topics are shown.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {/* ── Left column (60%) ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 md:w-3/5">
          {/* F-STU-032 AC-03: Primary CTA */}
          <TodaysLearningCard {...cardProps} />

          {/* F-STU-031: XP + Level */}
          <XPWidget totalXp={user.totalXp} level={user.level} xpThisWeek={xpThisWeek} />

          {/* Weekly activity strip */}
          <WeeklyStudyStrip data={weeklyStripData} />

          {/* F-STU-032 AC-02: Active revision cards due today */}
          <RevisionWidget />
        </div>

        {/* ── Right column (40%) ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 md:w-2/5">
          {/* F-STU-040 AC-02: Session cap counter (free tier only) */}
          {!isPremium && sessionsRemaining > 0 && (
            <FreemiumCounter
              sessionsUsed={sessionsUsed}
              sessionsRemaining={sessionsRemaining}
              periodStart={periodStart}
            />
          )}

          {/* F-STU-041: Upgrade prompt when cap hit */}
          {!isPremium && sessionsRemaining === 0 && (
            <UpgradeFlow
              studentName={user.name}
              studentEmail={user.email}
              freeTierUsage={{ sessionsUsed, sessionsRemaining, periodStart }}
            />
          )}

          {/* F-STU-023 AC-02/03: Exam readiness per subject -- links to chapter breakdown */}
          {readinessResults.length > 0 && (
            <section aria-label="Exam readiness">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Exam Readiness
                </h2>
                <Link
                  href="/student/progress"
                  className="text-xs font-medium text-[#534AB7] dark:text-indigo-400 hover:underline"
                >
                  Full report →
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {readinessResults.map((r) => (
                  <Link
                    key={r.subjectId}
                    href={`/student/progress/${r.subjectId}`}
                    className="block hover:opacity-90 transition-opacity"
                    aria-label={`View ${r.subjectName} chapter breakdown`}
                  >
                    <SubjectReadinessCard
                      subjectId={r.subjectId}
                      subjectName={r.subjectName}
                      score={r.score}
                      diagnosticDone={r.diagnosticDone}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
