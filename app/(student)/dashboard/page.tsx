/**
 * FILE OBJECTIVE:
 * - Server-render the student dashboard with primary/secondary learning CTAs,
 *   readiness cards, and freemium/subscription widgets.
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
 */
 
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getNextAction } from '@/lib/homeEngine/getNextAction'
import { computeReadinessScore, type ReadinessChapter } from '@/lib/student/examReadiness'
import { logger } from '@/lib/logger'
import TodaysLearningCard, {
  type TodaysLearningCardProps,
} from '@/components/student/dashboard/TodaysLearningCard'
import SecondaryStartOptions from '@/components/student/dashboard/SecondaryStartOptions'
import { XPWidget } from '@/components/student/dashboard/XPWidget'
import WeeklyStudyStrip from '@/components/student/dashboard/WeeklyStudyStrip'
import { RevisionWidget } from '@/components/student/dashboard/RevisionWidget'
import { SubjectReadinessCard } from '@/components/student/dashboard/SubjectReadinessCard'
import { FocusAreaCard } from '@/components/student/dashboard/FocusAreaCard'
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore'
import { FreemiumCounter } from '@/components/student/dashboard/FreemiumCounter'
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow'
import CrunchModeToggle from '@/components/student/dashboard/CrunchModeToggle'
import ReferralShareCard from '@/components/student/referral/ReferralShareCard'

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
const FALLBACK_BROWSE_HREF = '/learn/learning-path'

export default async function StudentHomeDashboardPage() {
  const authSession = await requireActiveSession()
  if (!authSession) redirect('/')

  const userId = (authSession.user as { id: string }).id

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const currentPeriodStart = new Date()
  currentPeriodStart.setDate(1)
  currentPeriodStart.setHours(0, 0, 0, 0)

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
    prisma.freeTierUsage.findFirst({
      where: { studentId: userId, subjectScope: '__ALL__', periodStart: currentPeriodStart },
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
            chapters: [],
          })),
          getSubjectDiagnosticStatus(userId, sub.id).catch(() => null),
        ])
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          score: result.score,
          predictedRange: (result as any).predictedRange ?? undefined,
          chapters: result.chapters ?? [],
          // Diagnostic status lives in StudentLearningProfile.recommendations
          // (lowercase 'completed'), not in the DiagnosticSession Prisma model.
          diagnosticDone: diagStatus?.status === 'completed',
          retakeEligibleAt: diagStatus?.retakeEligibleAt ?? null,
        }
      }),
    )
    readinessResults.push(...batchRows)
  }

  const weakestFocusArea = readinessResults
    .flatMap((subject) =>
      subject.chapters.map((chapter) => ({
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        masteryScore: chapter.masteryScore,
        status: chapter.status,
      })),
    )
    .sort((a, b) => a.masteryScore - b.masteryScore)[0]

  const focusArea = weakestFocusArea
    ? (() => {
        const masteryPercent = Math.round(weakestFocusArea.masteryScore * 100)
        const targetPercent = 75
        const gapToTarget = Math.max(0, targetPercent - masteryPercent)
        const sessionsNeeded = Math.max(1, Math.ceil(gapToTarget / 20))
        return {
          subjectId: weakestFocusArea.subjectId,
          subjectName: weakestFocusArea.subjectName,
          chapterId: weakestFocusArea.chapterId,
          chapterName: weakestFocusArea.chapterName,
          masteryPercent,
          status: weakestFocusArea.status,
          sessionsNeeded,
          estimatedMinutes: sessionsNeeded * 15,
        }
      })()
    : null

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
    weeklyActivity.map((s: { startedAt: Date }) => s.startedAt.toISOString().split('T')[0])
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
    // Unwrap dev-mode { action, traceId } wrapper -- production returns NextAction directly.
    // getNextAction() returns { action, traceId } in non-production environments, but the
    // dashboard consumed it as if it were a bare NextAction, causing ruleId to be undefined
    // and every branch to be skipped → cardProps fell back to plan_loading.
    const resolvedAction =
      typeof nextAction === 'object' && 'action' in nextAction
        ? nextAction.action
        : nextAction

    if (resolvedAction?.ruleId === 'resume_session' && resolvedAction.sessionId) {
      cardProps = {
        type: 'resume',
        session: {
          sessionId: resolvedAction.sessionId,
          topicId: resolvedAction.topicId ?? '',
          topicName: resolvedAction.topicName ?? 'Continue where you left off',
          subject: resolvedAction.subject ?? '',
          chapter: resolvedAction.chapter ?? '',
          currentPhase: resolvedAction.resumePhase ?? 'OVERVIEW',
        },
      }
    } else if (resolvedAction?.ruleId === 'homework_pending' && resolvedAction.assignmentId) {
      cardProps = {
        type: 'homework',
        homework: {
          id: resolvedAction.assignmentId,
          topicName: resolvedAction.topicName ?? 'Homework',
          questionCount: 5,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'PENDING',
        },
      }
    } else if (resolvedAction?.topicId) {
      // Resolve topicId → first non-suspended Concept.id.
      // The pre-session page (/session/pre/[conceptId]) performs
      // prisma.concept.findUnique({ where: { id } }) and redirects
      // to /dashboard when given a TopicDef.id instead of a Concept.id,
      // making both "Today's topic" and "Surprise me" appear to do nothing.
      const firstConcept = await prisma.concept.findFirst({
        where: { topicId: resolvedAction.topicId, isSuspended: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (firstConcept?.id) {
        cardProps = {
          type: 'start',
          recommendation: {
            conceptId: firstConcept.id,
            topicTitle: resolvedAction.topicName ?? 'Start a session',
            subject: resolvedAction.subject ?? '',
            estimatedTimeMin: 20,
          },
          ctaLabel: isCrunchMode ? 'Study for exam' : undefined,
        }
      } else {
        logger.warn('dashboard.start_action.skipped_missing_concept', {
          userId,
          topicId: resolvedAction.topicId,
          ruleId: resolvedAction.ruleId,
        })
      }
    }
  }

  // When all enrolled subjects have a completed diagnostic but no learning plan
  // is ready yet, show the plan-loading state instead of the onboarding checklist.
  // This prevents "Take diagnostic test" from appearing after all tests are done.
  const allDiagnosticsComplete =
    readinessResults.length > 0 && readinessResults.every((r) => r.diagnosticDone)
  if (cardProps.type === 'empty' && allDiagnosticsComplete) {
    cardProps = { type: 'plan_loading' }
  }

  // AC-02 (F-STU-010): Secondary "Today's topic" should follow today's planned
  // learning-plan item, not the primary card's resume/homework route.
  const todaysPlan = await prisma.learningPlan.findFirst({
    where: { studentId: userId },
    orderBy: { generatedAt: 'desc' },
    select: { id: true },
  })
  const firstSession = await prisma.structuredSession.findFirst({
    where: { studentId: userId },
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true },
  })
  const daysSinceFirst = firstSession
    ? Math.floor((Date.now() - firstSession.startedAt.getTime()) / 86_400_000)
    : 0
  const currentWeek = Math.max(1, Math.ceil((daysSinceFirst + 1) / 7))

  const inProgressPlanItem = todaysPlan
    ? await prisma.learningPlanItem.findFirst({
        where: { planId: todaysPlan.id, status: 'IN_PROGRESS' },
        orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
        select: { conceptId: true },
      })
    : null
  const currentWeekUpcomingPlanItem = !inProgressPlanItem && todaysPlan
    ? await prisma.learningPlanItem.findFirst({
        where: {
          planId: todaysPlan.id,
          status: 'UPCOMING',
          weekNumber: { lte: currentWeek },
        },
        orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
        select: { conceptId: true },
      })
    : null
  const fallbackUpcomingPlanItem = !inProgressPlanItem && !currentWeekUpcomingPlanItem && todaysPlan
    ? await prisma.learningPlanItem.findFirst({
        where: { planId: todaysPlan.id, status: 'UPCOMING' },
        orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
        select: { conceptId: true },
      })
    : null
  const todaysPlanItem = inProgressPlanItem ?? currentWeekUpcomingPlanItem ?? fallbackUpcomingPlanItem
  const secondaryTodaysHref =
    todaysPlanItem?.conceptId
      ? `/session/pre/${encodeURIComponent(todaysPlanItem.conceptId)}`
      : cardProps.type === 'start' && cardProps.recommendation?.conceptId
        ? `/session/pre/${encodeURIComponent(cardProps.recommendation.conceptId)}`
        : FALLBACK_BROWSE_HREF

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
          {!isCrunchMode && (
            <SecondaryStartOptions
              todaysConceptId={cardProps.recommendation?.conceptId}
              todaysHref={secondaryTodaysHref}
            />
          )}

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
          {/* {!isPremium && sessionsRemaining > 0 && (
            <FreemiumCounter
              sessionsUsed={sessionsUsed}
              sessionsRemaining={sessionsRemaining}
              periodStart={periodStart}
            />
          )} */}

          {/* F-STU-041: Upgrade prompt when cap hit */}
          {!isPremium && sessionsRemaining === 0 && (
            <UpgradeFlow
              studentName={user.name}
              studentEmail={user.email}
              freeTierUsage={{ sessionsUsed, sessionsRemaining, periodStart }}
            />
          )}

          {/* F-STU-042 AC-01: Referral share card -- copy or WhatsApp share */}
          {/* <ReferralShareCard /> */}

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
                      chapters={r.chapters}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Focus Area: weakest chapter across subjects (hidden in crunch mode) */}
          {!isCrunchMode && focusArea && (
            <FocusAreaCard
              subjectId={focusArea.subjectId}
              subjectName={focusArea.subjectName}
              chapterId={focusArea.chapterId}
              chapterName={focusArea.chapterName}
              masteryPercent={focusArea.masteryPercent}
              status={focusArea.status}
              sessionsNeeded={focusArea.sessionsNeeded}
              estimatedMinutes={focusArea.estimatedMinutes}
              href={`/student/progress/${focusArea.subjectId}?focusChapter=${encodeURIComponent(focusArea.chapterId)}`}
            />
          )}
        </div>
      </div>
    </main>
  )
}
