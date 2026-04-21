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
 *   2026-04-15 | copilot | filter dashboard subjects by student's learning plans when present
  *   2026-04-21T12:00:00Z | staff-engineer | fix: parse `user.grade` to integer before using in Prisma
  *                               `class.grade` filter; prefer learning-plan subject when
  *                               deduplicating by name; use `/diagnostic/[subjectId]`
  *                               for diagnostic CTA; add unit tests covering behaviors
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
import SecondaryStartOptions from '@/components/student/dashboard/SecondaryStartOptions'
import { XPWidget } from '@/components/student/dashboard/XPWidget'
import WeeklyStudyStrip from '@/components/student/dashboard/WeeklyStudyStrip'
import { RevisionWidget } from '@/components/student/dashboard/RevisionWidget'
import { SubjectReadinessCard } from '@/components/student/dashboard/SubjectReadinessCard'
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore'
import { FreemiumCounter } from '@/components/student/dashboard/FreemiumCounter'
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow'
import CrunchModeToggle from '@/components/student/dashboard/CrunchModeToggle'

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

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)

  // ── Round 1: all independent queries in a single parallel fetch ──────────────
  // XP aggregates merged here so there is no second sequential Promise.all below.
  const [
    user,
    nextAction,
    freeTierUsage,
    learningPlans,
    weeklyActivity,
    xpThisWeekResult,
    xpBySourceRaw,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        totalXp: true,
        level: true,
        subscriptionStatus: true,
        subjects: true,
        board: true,
        grade: true,
        learningPlans: {
          select: { examDate: true, subjectId: true },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
        preferences: true,
      },
    }),
    getNextAction(userId).catch(() => null),
    prisma.freeTierUsage.findUnique({
      where: { studentId: userId },
      select: { sessionsUsed: true, periodStart: true },
    }),
    // Fetch learning plans for this student (used to scope dashboard subjects)
    prisma.learningPlan.findMany({
      where: { studentId: userId },
      select: { subjectId: true },
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
    // XP this week (was previously a second sequential Promise.all -- merged here)
    prisma.studentXP.aggregate({
      where: { studentId: userId, awardedAt: { gte: sevenDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.studentXP.groupBy({
      by: ['source'],
      where: { studentId: userId, awardedAt: { gte: sevenDaysAgo } },
      _sum: { amount: true },
    }),
  ])

  if (!user) redirect('/')

  const isPremium = user.subscriptionStatus === 'premium'
  const sessionsUsed = freeTierUsage?.sessionsUsed ?? 0
  const sessionsRemaining = Math.max(0, FREE_TIER_SESSION_CAP - sessionsUsed)
  const periodStart = freeTierUsage?.periodStart?.toISOString() ?? new Date(Date.now() - 15 * 86400000).toISOString()

  const latestPlan = user.learningPlans[0]
  // Respect per-user preference: 'on' | 'off' | 'auto'
  const prefCrunch = (user as any)?.preferences?.crunchMode ?? 'auto'
  const autoCrunch = computeCrunchMode(latestPlan?.examDate)
  const isCrunchMode = prefCrunch === 'on' ? true : prefCrunch === 'off' ? false : autoCrunch

  // ── XP breakdown ─────────────────────────────────────────────────────────────
  const xpThisWeek = xpThisWeekResult._sum.amount ?? 0
  const xpBySource: Record<string, number> = {}
  for (const row of xpBySourceRaw) {
    xpBySource[row.source] = row._sum.amount ?? 0
  }

  // ── Subject resolution (depends on Round 1 data -- unavoidable sequential step) ──
  // Prefer subjects from the student's profile `subjects` (enrolled subjects),
  // then fall back to subjects referenced by their learning plans, then active subjects.
  let subjects = [] as { id: string; name: string }[]

  // Resolve enrolled subjects from user.subjects (may be string[] or Postgres wire-format string)
  let enrolledSubjects: string[] | null = null
  if (user?.subjects) {
    if (Array.isArray(user.subjects)) {
      const arr = (user.subjects as string[]).filter(Boolean)
      if (arr.length > 0) enrolledSubjects = arr
    } else if (typeof user.subjects === 'string' && user.subjects.length > 0) {
      const cleaned = (user.subjects as string).replace(/^\{/, '').replace(/\}$/, '').trim()
      const parts = cleaned.length > 0 ? cleaned.split(',').map((s) => s.trim()).filter(Boolean) : []
      if (parts.length > 0) enrolledSubjects = parts
    }
  }

  if (enrolledSubjects && enrolledSubjects.length > 0) {
    // Parse user.grade to an integer because SubjectDef.class.grade is an Int in
    // the Prisma schema while `user.grade` is stored as a string on the User row.
    // Only apply class scoping when the parsed grade is a valid integer to avoid
    // silently passing an incorrect filter to Prisma.
    const parsedUserGrade =
      typeof user?.grade === 'string'
        ? (() => {
            const normalizedGrade = user.grade.trim()
            if (normalizedGrade.length === 0) return null
            const numericGrade = Number(normalizedGrade)
            return Number.isInteger(numericGrade) ? numericGrade : null
          })()
        : null

    // Scope to the student's own board + grade to avoid cross-grade/board duplicates
    // when multiple active SubjectDef rows share the same display name.
    // Only apply class scoping when we have both a board and a parsed numeric grade.
    subjects = await prisma.subjectDef.findMany({
      where: {
        lifecycle: 'active',
        ...(user.board && parsedUserGrade !== null
          ? {
              class: {
                grade: parsedUserGrade,
                board: { slug: { equals: user.board, mode: 'insensitive' as const } },
              },
            }
          : {}),
        OR: [{ name: { in: enrolledSubjects } }, { slug: { in: enrolledSubjects } }],
      },
      select: { id: true, name: true },
    })
  } else {
    const planSubjectIds = Array.from(new Set(learningPlans.map((p: { subjectId: string }) => p.subjectId)))
    if (planSubjectIds.length > 0) {
      subjects = await prisma.subjectDef.findMany({
        where: { id: { in: planSubjectIds }, lifecycle: 'active' },
        select: { id: true, name: true },
      })
    } else {
      subjects = await prisma.subjectDef.findMany({
        where: { lifecycle: 'active' },
        select: { id: true, name: true },
        take: 5,
      })
    }
  }

  // Deduplicate by lowercase name -- prefer the subject that is in a learning plan so
  // that "Start Diagnostic" always links to the subject the student actually enrolled in.
  {
    const planSubjectIdSet = new Set(learningPlans.map((p: { subjectId: string }) => p.subjectId))
    const seen = new Map<string, { id: string; name: string }>()
    for (const s of subjects) {
      const key = s.name.toLowerCase()
      if (!seen.has(key) || planSubjectIdSet.has(s.id)) seen.set(key, s)
    }
    subjects = Array.from(seen.values())
  }

  // ── Round 2: readiness + diagnostic status -- subjects batched for pool safety ──
  // User.subjects is an unbounded String[], so we cap at SUBJECT_CAP and process
  // SUBJECT_CONCURRENCY subjects at a time to avoid a burst of concurrent Neon
  // connections that would saturate the connection pool and cause tail-latency spikes.
  // Within each batch, the three per-subject queries run in an inner Promise.all.
  const SUBJECT_CAP = 5
  const SUBJECT_CONCURRENCY = 3

  type ReadinessRow = {
    subjectId: string
    subjectName: string
    score: number
    predictedRange?: any
    diagnosticDone: boolean
    retakeEligibleAt: string | null
  }

  const cappedSubjects = subjects.slice(0, SUBJECT_CAP)
  const readinessResults: ReadinessRow[] = []

  for (let i = 0; i < cappedSubjects.length; i += SUBJECT_CONCURRENCY) {
    const batch = cappedSubjects.slice(i, i + SUBJECT_CONCURRENCY)
    const batchRows = await Promise.all(
      batch.map(async (sub): Promise<ReadinessRow> => {
        const [result, diagnostic, diagStatus] = await Promise.all([
          computeReadinessScore(userId, sub.id).catch(() => ({
            score: 0,
            label: 'critical' as const,
            chapters: [],
          })),
          prisma.diagnosticSession.findFirst({
            where: { studentId: userId, subjectId: sub.id, status: 'COMPLETED' },
            select: { id: true },
          }).catch(() => null),
          getSubjectDiagnosticStatus(userId, sub.id).catch(() => null),
        ])
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          score: result.score,
          predictedRange: (result as any).predictedRange ?? undefined,
          diagnosticDone: !!diagnostic,
          retakeEligibleAt: diagStatus?.retakeEligibleAt ?? null,
        }
      }),
    )
    readinessResults.push(...batchRows)
  }

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
  // diagnosticHref should point to the FIRST subject that still needs a diagnostic
  // so the "Take diagnostic test" CTA never sends the student to a completed subject.
  const firstPendingDiagSubject = readinessResults.find((r) => !r.diagnosticDone)
  const firstDiagSubjectId =
    firstPendingDiagSubject?.subjectId ?? latestPlan?.subjectId ?? subjects[0]?.id
  let cardProps: TodaysLearningCardProps = {
    type: 'empty',
    diagnosticHref: firstDiagSubjectId ? `/diagnostic/${firstDiagSubjectId}` : '/dashboard',
  }

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
        <div className="mb-4 rounded-xl bg-[#FCEBEB] dark:bg-[#E24B4A]/10 border border-[#E24B4A]/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-extrabold text-[#E24B4A] leading-none" aria-hidden>
                {Math.ceil((latestPlan.examDate.getTime() - Date.now()) / 86400000)}d
              </div>
              <div>
                <p className="text-sm font-bold text-[#E24B4A]">Exam approaching</p>
                <p className="text-xs text-[#E24B4A]/80">Focus mode on -- only exam-relevant actions shown.</p>
              </div>
            </div>
            <CrunchModeToggle />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {/* ── Left column (60%) ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 md:w-3/5">
          {/* F-STU-032 AC-03: Primary CTA */}

          <TodaysLearningCard {...cardProps} />
          {!isCrunchMode && <SecondaryStartOptions todaysConceptId={cardProps.recommendation?.conceptId} />}

          {/* F-STU-031: XP + Level + source breakdown (hidden in crunch mode) */}
          {!isCrunchMode && (
            <XPWidget totalXp={user.totalXp} level={user.level} xpThisWeek={xpThisWeek} xpBySource={xpBySource} />
          )}

          {/* Weekly activity strip (hidden in crunch mode) */}
          {!isCrunchMode && <WeeklyStudyStrip data={weeklyStripData} />}

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
                  Full report &rarr;
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
                      predictedRange={r.predictedRange}
                      retakeEligibleAt={r.retakeEligibleAt}
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
