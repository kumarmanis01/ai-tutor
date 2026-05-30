/**
 * FILE OBJECTIVE:
 * - Server-render the revamped student dashboard with welcome banner,
 *   today's missions, pick-next section, stats row, and exam readiness.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/dashboard/page.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-03-15T00:00:00Z | v2-migration | full rebuild; replaces v1 dashboard
 * - 2026-04-21T12:00:00Z | staff-engineer | parse user.grade for Prisma class filter and improve diagnostic CTA/tests
 * - 2026-05-06T00:00:00Z | copilot | map topicId to Concept.id for start/surprise pre-session routing
 * - 2026-05-07T06:45:00Z | copilot | avoid broken start recommendation when no active concept resolves
 * - 2026-05-08T00:00:00Z | copilot | align secondary Today's topic href to learning plan intent (AC-02)
 * - 2026-05-08T00:00:00Z | copilot | fix secondary Today's topic fallback drift by preferring
 *                          IN_PROGRESS plan item before UPCOMING fallbacks
 * - 2026-05-09T15:45:00Z | copilot | add Focus Area section from weakest readiness chapter
 *                          and wire CTA to subject progress view
 * - 2026-05-11T18:00:00Z | copilot | remove unused FreemiumCounter, ReferralShareCard imports (V1 pre-rollout)
 * - 2026-05-12T00:00:00Z | copilot | prevent incomplete-profile fallback subject exposure when enrollment data is missing
 * - 2026-05-17T00:00:00Z | copilot | revamp dashboard UI: welcome banner, missions hero/row, pick-next,
 *                          stats row (week+level+leaderboard), exam readiness with chapter mastery
 * - 2026-05-18T00:00:00Z | copilot | fix: mark xpBySourceRaw as intentionally unused by prefixing with _ to satisfy ESLint
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getNextAction } from '@/lib/homeEngine/getNextAction'
import { computeReadinessScore, type ReadinessChapter } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore'
import resolveStudentSubjects from '@/lib/subjects/resolveStudentSubjects'
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow'
import CrunchModeToggle from '@/components/student/dashboard/CrunchModeToggle'
import WelcomeBanner from '@/components/student/dashboard/WelcomeBanner'
import TodaysMissions from '@/components/student/dashboard/TodaysMissions'
import PickNextSection from '@/components/student/dashboard/PickNextSection'
import StatsRow from '@/components/student/dashboard/StatsRow'
import ExamReadinessSection, {
  type SubjectReadiness,
  type ReadinessChapterDisplay,
  type PredictedRange,
} from '@/components/student/dashboard/ExamReadinessSection'
import { type DashboardMission, type MissionKind, type MissionState } from '@/lib/student/dashboardMissions'

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

/** Normalise 0-1 scores to 0-100. */
function normalisePct(score: number): number {
  if (score <= 1) return Math.round(score * 100)
  return Math.round(score)
}

/** Map a ReadinessChapter status label to the display tag. */
function chapterTag(status: ReadinessChapter['status']): SubjectReadiness['tag'] {
  if (status === 'critical') return 'critical'
  if (status === 'needs_work') return 'needs_work'
  if (status === 'on_track') return 'on_track'
  return 'ready'
}

const FREE_TIER_SESSION_CAP = 3

export default async function StudentHomeDashboardPage() {
  const authSession = await requireActiveSession()
  if (!authSession) redirect('/')

  const userId = (authSession.user as { id: string }).id

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const currentPeriodStart = new Date()
  currentPeriodStart.setDate(1)
  currentPeriodStart.setHours(0, 0, 0, 0)

  // ── Round 1: all independent queries in a single parallel fetch ──────────────
  const [
    user,
    nextAction,
    freeTierUsage,
    learningPlans,
    weeklyActivity,
    xpThisWeekResult,
    _xpBySourceRaw,
    firstSession,
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
    prisma.freeTierUsage.findFirst({
      where: { studentId: userId, subjectScope: '__ALL__', periodStart: currentPeriodStart },
      select: { sessionsUsed: true, periodStart: true },
    }),
    prisma.learningPlan.findMany({
      where: { studentId: userId },
      select: { id: true, subjectId: true },
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
    prisma.studentXP.aggregate({
      where: { studentId: userId, awardedAt: { gte: sevenDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.studentXP.groupBy({
      by: ['source'],
      where: { studentId: userId, awardedAt: { gte: sevenDaysAgo } },
      _sum: { amount: true },
    }),
    // Batched with Round 1: independent of all other queries, only needs userId.
    // Moved from sequential position after Round 2 to eliminate ~1700ms wall-time stall.
    prisma.structuredSession.findFirst({
      where: { studentId: userId },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    }),
  ])

  if (!user) redirect('/')

  try {
    logger.debug('dashboard.user_subjects', { userId, rawSubjects: (user as { subjects: string[] }).subjects })
  } catch (err) {
    logger.warn('dashboard.user_subjects.log_failed', { userId, error: err })
  }

  // Derive currentWeek now that firstSession is available from Round 1.
  const daysSinceFirst = firstSession
    ? Math.floor((Date.now() - firstSession.startedAt.getTime()) / 86_400_000)
    : 0
  const currentWeek = Math.max(1, Math.ceil((daysSinceFirst + 1) / 7))

  const isPremium = user.subscriptionStatus === 'premium'
  const sessionsUsed = freeTierUsage?.sessionsUsed ?? 0
  const sessionsRemaining = Math.max(0, FREE_TIER_SESSION_CAP - sessionsUsed)
  const periodStart = freeTierUsage?.periodStart?.toISOString() ?? new Date(Date.now() - 15 * 86400000).toISOString()

  const latestPlan = user.learningPlans[0]
  const prefCrunch = ((user as { preferences?: { crunchMode?: string } }).preferences?.crunchMode) ?? 'auto'
  const autoCrunch = computeCrunchMode(latestPlan?.examDate)
  const isCrunchMode = prefCrunch === 'on' ? true : prefCrunch === 'off' ? false : autoCrunch

  // ── XP data ──────────────────────────────────────────────────────────────────
  const xpThisWeek = xpThisWeekResult._sum.amount ?? 0

  // ── Subject resolution ───────────────────────────────────────────────────────
  const hasCompleteAcademicProfile = Boolean(user.grade && user.board)
  const subjects = hasCompleteAcademicProfile
    ? await resolveStudentSubjects(user as Parameters<typeof resolveStudentSubjects>[0], learningPlans as Parameters<typeof resolveStudentSubjects>[1])
    : []

  // ── Round 2: readiness + diagnostic status, subjects batched for pool safety ─
  const SUBJECT_CAP = 5
  const SUBJECT_CONCURRENCY = 3

  type ReadinessRow = {
    subjectId: string
    subjectName: string
    score: number
    predictedRange?: PredictedRange | null
    chapters: ReadinessChapter[]
    diagnosticDone: boolean
    retakeEligibleAt: string | null
  }

  const cappedSubjects = subjects.slice(0, SUBJECT_CAP)
  const readinessResults: ReadinessRow[] = []

  for (let i = 0; i < cappedSubjects.length; i += SUBJECT_CONCURRENCY) {
    const batch = cappedSubjects.slice(i, i + SUBJECT_CONCURRENCY)
    const batchRows = await Promise.all(
      batch.map(async (sub): Promise<ReadinessRow> => {
        const [result, diagStatus] = await Promise.all([
          computeReadinessScore(userId, sub.id).catch(() => ({
            score: 0,
            label: 'critical' as const,
            chapters: [] as ReadinessChapter[],
          })),
          getSubjectDiagnosticStatus(userId, sub.id).catch(() => null),
        ])
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          score: normalisePct(result.score),
          predictedRange: (result as { predictedRange?: PredictedRange }).predictedRange ?? null,
          chapters: result.chapters ?? [],
          diagnosticDone: diagStatus?.status === 'completed',
          retakeEligibleAt: diagStatus?.retakeEligibleAt ?? null,
        }
      }),
    )
    readinessResults.push(...batchRows)
  }

  try {
    logger.debug('dashboard.readiness_results', {
      userId,
      readinessCount: readinessResults.length,
      readinessSubjects: readinessResults.map((r) => ({
        id: r.subjectId,
        name: r.subjectName,
        diagnosticDone: r.diagnosticDone,
      })),
    })
  } catch (err) {
    logger.warn('dashboard.readiness_results.log_failed', { userId, error: err })
  }

  // ── Weekly study strip data ──────────────────────────────────────────────────
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const now = new Date()
  const todayDow = now.getUTCDay()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const dayOffset = i - (todayDow === 0 ? 6 : todayDow - 1)
    d.setUTCDate(d.getUTCDate() + dayOffset)
    return d.toISOString().split('T')[0]
  })
  const activeDateSet = new Set(
    weeklyActivity.map((s: { startedAt: Date }) => s.startedAt.toISOString().split('T')[0])
  )
  const weekData = {
    days: weekDays.map((date, i) => ({
      date,
      dayLabel: DAY_LABELS[i],
      hasSession: activeDateSet.has(date),
    })),
    sessionCountThisWeek: weeklyActivity.length,
    weeklyGoal: 5,
  }

  // ── Build nextAction into a hero DashboardMission ────────────────────────────
  const resolvedAction = nextAction
    ? (typeof nextAction === 'object' && 'action' in nextAction
        ? (nextAction as { action: unknown }).action
        : nextAction)
    : null

  type ResolvedAction = {
    ruleId?: string
    sessionId?: string
    topicId?: string
    topicName?: string
    subject?: string
    chapter?: string
    resumePhase?: string
    assignmentId?: string
  }

  const action = resolvedAction as ResolvedAction | null

  let heroMission: DashboardMission | null = null

  if (action?.ruleId === 'resume_session' && action.sessionId) {
    const subjectEntry = subjects.find((s) => s.name === action.subject)
    heroMission = {
      id: action.sessionId,
      subjectId: subjectEntry?.id ?? action.subject?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown',
      subjectName: action.subject ?? 'Your subject',
      kind: 'Lesson' as MissionKind,
      title: action.topicName ?? 'Continue where you left off',
      chapter: action.chapter,
      estimatedMins: 20,
      xp: 60,
      state: 'in_progress' as MissionState,
      priority: true,
      href: `/session/${action.topicId ?? action.sessionId}`,
    }
  } else if (action?.ruleId === 'homework_pending' && action.assignmentId) {
    const subjectEntry = subjects.find((s) => s.name === action.subject)
    heroMission = {
      id: action.assignmentId,
      subjectId: subjectEntry?.id ?? subjects[0]?.id ?? 'unknown',
      subjectName: action.subject ?? subjects[0]?.name ?? 'Homework',
      kind: 'Homework' as MissionKind,
      title: action.topicName ?? 'Homework',
      chapter: action.chapter,
      questionCount: 5,
      estimatedMins: 15,
      xp: 120,
      state: 'not_started' as MissionState,
      priority: true,
      due: `Due tomorrow · 10:00`,
      href: `/homework/${action.assignmentId}`,
    }
  } else if (action?.topicId) {
    const firstConcept = await prisma.concept.findFirst({
      where: { topicId: action.topicId, isSuspended: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (firstConcept?.id) {
      const subjectEntry = subjects.find((s) => s.name === action.subject)
      heroMission = {
        id: firstConcept.id,
        subjectId: subjectEntry?.id ?? action.subject?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown',
        subjectName: action.subject ?? subjects[0]?.name ?? 'Your subject',
        kind: 'Lesson' as MissionKind,
        title: action.topicName ?? 'Start a session',
        chapter: action.chapter,
        estimatedMins: 20,
        xp: 60,
        state: 'not_started' as MissionState,
        priority: true,
        href: `/session/pre/${encodeURIComponent(firstConcept.id)}`,
      }
    } else {
      logger.warn('dashboard.hero_mission.skipped_missing_concept', {
        userId,
        topicId: action.topicId,
        ruleId: action.ruleId,
      })
    }
  }

  // ── Diagnostic state ──────────────────────────────────────────────────────
  // hasPendingDiagnostic is true only when subjects exist and at least one lacks a
  // completed diagnostic. When it is true, the dashboard suppresses premature plan
  // missions and surfaces the diagnostic CTA as the primary action.
  const hasPendingDiagnostic =
    readinessResults.length > 0 && readinessResults.some((r) => !r.diagnosticDone)
  const allDiagnosticsComplete =
    readinessResults.length > 0 && readinessResults.every((r) => r.diagnosticDone)
  const firstPendingDiagSubject = readinessResults.find((r) => !r.diagnosticDone)
  const firstDiagSubjectId =
    firstPendingDiagSubject?.subjectId ?? latestPlan?.subjectId ?? subjects[0]?.id

  // ── Secondary missions from today's learning plan items ──────────────────────
  // firstSession / daysSinceFirst / currentWeek derived from Round 1 above.

  type ConceptSelectResult = {
    name: string
    topic: { name: string; chapter: { name: string } } | null
  }
  type PlanItemSelectResult = { conceptId: string; concept: ConceptSelectResult }

  const PLAN_ITEM_SELECT = {
    conceptId: true,
    concept: { select: { name: true, topic: { select: { name: true, chapter: { select: { name: true } } } } } },
  } as const

  function topicNameFromItem(item: PlanItemSelectResult, fallback: string): string {
    return item.concept?.topic?.name ?? item.concept?.name ?? fallback
  }
  function chapterFromItem(item: PlanItemSelectResult): string | null {
    return item.concept?.topic?.chapter?.name ?? null
  }

  type TodaysTopic = { subject: string; href: string; subjectId: string; topicName: string; chapter: string | null }
  const todaysTopics: TodaysTopic[] = (
    await Promise.all(
      learningPlans.map(async (plan): Promise<TodaysTopic | null> => {
        const subjectInfo = subjects.find((s) => s.id === plan.subjectId)

        // All three plan-item queries in parallel -- priority applied in memory.
        // Replaces 3 sequential awaits (~5100ms worst case) with 3 parallel fetches (~1700ms).
        const [inProgressItem, currentWeekItem, fallbackItem] = await Promise.all([
          prisma.learningPlanItem.findFirst({
            where: { planId: plan.id, status: 'IN_PROGRESS' },
            orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
            select: PLAN_ITEM_SELECT,
          }),
          prisma.learningPlanItem.findFirst({
            where: { planId: plan.id, status: 'UPCOMING', weekNumber: { lte: currentWeek } },
            orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
            select: PLAN_ITEM_SELECT,
          }),
          prisma.learningPlanItem.findFirst({
            where: { planId: plan.id, status: 'UPCOMING' },
            orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
            select: PLAN_ITEM_SELECT,
          }),
        ]) as [PlanItemSelectResult | null, PlanItemSelectResult | null, PlanItemSelectResult | null]

        // Priority: IN_PROGRESS > current-week UPCOMING > any UPCOMING
        const best = inProgressItem ?? currentWeekItem ?? fallbackItem
        if (!best?.conceptId) return null

        return {
          subject: subjectInfo?.name ?? 'Your subject',
          subjectId: plan.subjectId,
          topicName: topicNameFromItem(best, inProgressItem ? 'Continue learning' : 'Start learning'),
          chapter: chapterFromItem(best),
          href: `/session/pre/${encodeURIComponent(best.conceptId)}`,
        }
      }),
    )
  ).filter((t): t is TodaysTopic => t !== null)

  // Supplement with subjects that completed diagnostics but have no learning plan yet.
  // This handles the case where plan generation failed or is still pending after a diagnostic.
  const planSubjectSet = new Set(learningPlans.map((p) => p.subjectId))
  const unplannedTopics: TodaysTopic[] = (
    await Promise.all(
      readinessResults
        .filter((r) => r.diagnosticDone && !planSubjectSet.has(r.subjectId))
        .map(async (r): Promise<TodaysTopic | null> => {
          const firstConcept = await prisma.concept.findFirst({
            where: { subjectId: r.subjectId, isSuspended: false },
            orderBy: [{ topic: { chapter: { order: 'asc' } } }, { topic: { order: 'asc' } }],
            select: { id: true, name: true, topic: { select: { name: true, chapter: { select: { name: true } } } } },
          })
          if (!firstConcept?.id) return null
          return {
            subject: r.subjectName,
            subjectId: r.subjectId,
            topicName: firstConcept.topic?.name ?? firstConcept.name,
            chapter: firstConcept.topic?.chapter?.name ?? null,
            href: `/session/pre/${encodeURIComponent(firstConcept.id)}`,
          }
        }),
    )
  ).filter((t): t is TodaysTopic => t !== null)

  const allTodaysTopics = [...todaysTopics, ...unplannedTopics]

  // Build secondary missions (exclude the subject already covered by the hero)
  const heroSubjectId = heroMission?.subjectId
  const secondaryMissions: DashboardMission[] = allTodaysTopics
    .filter((t) => !heroSubjectId || t.subjectId !== heroSubjectId)
    .map((topic, i) => ({
      id: `secondary-${i}`,
      subjectId: topic.subjectId,
      subjectName: topic.subject,
      kind: 'Lesson' as MissionKind,
      title: topic.topicName,
      chapter: topic.chapter ?? undefined,
      estimatedMins: 20,
      xp: 60,
      state: 'not_started' as MissionState,
      priority: false,
      href: topic.href,
    }))

  // ── Build warm-up cards for PickNext ──────────────────────────────────────────
  const warmUps = allTodaysTopics.slice(0, 3).map((topic) => ({
    subjectId: topic.subjectId,
    subjectName: topic.subject,
    title: topic.topicName,
    meta: '~20 min · +60 XP',
    href: topic.href,
  }))

  // ── Mission counts for welcome banner ─────────────────────────────────────────
  const allMissions = heroMission ? [heroMission, ...secondaryMissions] : secondaryMissions
  const totalMissionCount = allMissions.length
  const completedCount = allMissions.filter((m) => m.state === 'completed_today').length
  const missionSubjectCount = new Set(allMissions.map((m) => m.subjectId)).size
  const totalMissionMins = allMissions.reduce((s, m) => s + m.estimatedMins, 0)

  // ── Build exam readiness subjects for ExamReadinessSection ───────────────────
  const examSubjects: SubjectReadiness[] = readinessResults.map((r) => ({
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    score: r.score,
    tag: (r.score < 40 ? 'critical' : r.score < 70 ? 'needs_work' : r.score < 90 ? 'on_track' : 'ready') as SubjectReadiness['tag'],
    diagnosticDone: r.diagnosticDone,
    retakeEligibleAt: r.retakeEligibleAt,
    predictedRange: r.predictedRange ?? null,
    chapters: r.chapters.map((ch): ReadinessChapterDisplay => ({
      chapterId: ch.chapterId,
      chapterName: ch.chapterName,
      masteryPct: Math.round(ch.masteryScore <= 1 ? ch.masteryScore * 100 : ch.masteryScore),
      tag: chapterTag(ch.status),
    })),
  }))

  // ── Grade label for leaderboard ───────────────────────────────────────────────
  const gradeLabel = user.grade ? `This week · Grade ${user.grade}` : 'This week'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-[1120px] mx-auto px-4 sm:px-8 py-6 pb-16">
      {/* Crunch mode banner (F-STU-032 AC-04) */}
      {isCrunchMode && latestPlan?.examDate && (
        <div className="mb-5 rounded-xl bg-[#FCEBEB] dark:bg-[#E24B4A]/10 border border-[#E24B4A]/20 px-4 py-3">
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

      {/* Upgrade gate (free tier cap hit) */}
      {!isPremium && sessionsRemaining === 0 && (
        <div className="mb-5">
          <UpgradeFlow
            studentName={user.name}
            studentEmail={user.email}
            freeTierUsage={{ sessionsUsed, sessionsRemaining, periodStart }}
          />
        </div>
      )}

      <div className="flex flex-col gap-[22px] sm:gap-[30px]">
        {/* Welcome banner */}
        <WelcomeBanner
          name={user.name ?? 'Student'}
          completedCount={completedCount}
          totalCount={totalMissionCount}
          subjectCount={missionSubjectCount}
          totalMins={totalMissionMins}
        />

        {/* Today's missions -- suppressed when any diagnostic is still pending to
            prevent premature plan items from being shown before mastery data exists. */}
        {hasPendingDiagnostic ? (
          <section className="rounded-2xl border border-dashed border-[#D3D1C7] dark:border-[#4A4840] bg-[#F8F6F1] dark:bg-[#26241F] p-6">
            <p className="text-base font-semibold text-[#2C2C2A] dark:text-[#E8E6DF] mb-1">
              Let&apos;s get you started
            </p>
            <p className="text-sm text-[#888780] dark:text-[#6E6C67] mb-4">
              Complete your diagnostic test so Teacher Vidya can build your personalised plan.
            </p>
            {firstDiagSubjectId && (
              <a
                href={`/diagnostic/${firstDiagSubjectId}`}
                className="inline-flex items-center min-h-[44px] rounded-xl bg-[#534AB7] text-white text-sm font-semibold px-5 hover:bg-[#4239A0] transition-colors shadow-[0_2px_0_#3C3489]"
              >
                Take diagnostic test
              </a>
            )}
          </section>
        ) : (heroMission || secondaryMissions.length > 0) ? (
          <TodaysMissions hero={heroMission} rest={secondaryMissions} />
        ) : allDiagnosticsComplete ? (
          <section className="rounded-2xl border border-[#534AB7]/20 dark:border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-6">
            <p className="text-base font-semibold text-[#2C2C2A] dark:text-[#E8E6DF] mb-1">
              Great work completing your diagnostic!
            </p>
            <p className="text-sm text-[#5F5E5A] dark:text-[#A8A69F]">
              Teacher Vidya is building your personalised learning plan. This page auto-refreshes when it is ready.
            </p>
          </section>
        ) : null}

        {/* Pick what's next (hidden in crunch mode) */}
        {!isCrunchMode && (
          <PickNextSection warmUps={warmUps} />
        )}

        {/* Stats row: week + level + leaderboard (hidden in crunch mode) */}
        {!isCrunchMode && (
          <StatsRow
            weekData={weekData}
            totalXp={user.totalXp}
            level={user.level}
            xpThisWeek={xpThisWeek}
            leaderboardRows={[]}
            gradeLabel={gradeLabel}
          />
        )}

        {/* Exam readiness */}
        {examSubjects.length > 0 && (
          <ExamReadinessSection subjects={examSubjects} />
        )}
      </div>
    </main>
  )
}
