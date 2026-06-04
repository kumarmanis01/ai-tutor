/**
 * GET /api/student/dashboard
 * Aggregates all data needed to render the new student dashboard in one round-trip.
 *
 * Response: DashboardData (see app/(student)/student/dashboard/page.tsx)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { getReadinessTier } from '@/lib/constants/readiness'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

export const dynamic = 'force-dynamic'

const XP_PER_LEVEL = 500

function xpFloor(level: number) {
  return (level - 1) * XP_PER_LEVEL
}

function toSubjectKey(name: string): SubjectKey {
  const n = name.toLowerCase()
  if (n.includes('math')) return 'math'
  if (n.includes('science') && !n.includes('social')) return 'science'
  if (n.includes('social')) return 'social'
  if (n.includes('english')) return 'english'
  if (n.includes('hindi')) return 'hindi'
  return n as SubjectKey
}

function readinessTierFromScore(score: number): TierKey {
  return getReadinessTier(score) as TierKey
}

export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [user, readinessRows, learningPlans, revisionsDue, sessionsToday] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        grade: true,
        board: true,
        totalXp: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
      },
    }),
    prisma.readinessStatus.findMany({
      where: { studentId: userId },
      select: { subject: true, readinessScore: true },
    }),
    prisma.learningPlan.findMany({
      where: { studentId: userId },
      take: 1,
      orderBy: { generatedAt: 'desc' },
      select: {
        examDate: true,
        subjectId: true,
      },
    }),
    prisma.studentConceptState.count({
      where: { studentId: userId, nextReviewAt: { lte: new Date() } },
    }),
    prisma.structuredSession.count({
      where: { studentId: userId, startedAt: { gte: todayStart } },
    }),
  ])

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // --- Derive exam info ---
  const examDate = learningPlans[0]?.examDate ?? null
  const examDaysLeft = examDate
    ? Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86_400_000))
    : 365
  const examName =
    user.board && user.grade ? `${user.board} Class ${user.grade}` : 'Board Exam'

  // --- XP level bands ---
  const level = user.level ?? 1
  const xp = user.totalXp ?? 0
  const xpLevelFloor = xpFloor(level)
  const xpToNext = xpFloor(level + 1)

  // --- Readiness per subject ---
  const readinessBySubject = readinessRows.map((r) => ({
    subject: toSubjectKey(r.subject),
    tier: readinessTierFromScore(r.readinessScore) as TierKey,
    trend: 0, // trend requires historical snapshots; not available in ReadinessStatus
  }))

  // --- Next recommended topic from learning plan ---
  let nextTopic: {
    concept: string
    subject: SubjectKey
    minutes: number
    reason: string
  } | null = null

  const nextItem = await prisma.learningPlanItem.findFirst({
    where: {
      plan: { studentId: userId },
      status: { in: ['IN_PROGRESS', 'UPCOMING'] },
    },
    orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
    select: {
      concept: {
        select: {
          name: true,
          subject: { select: { name: true } },
        },
      },
    },
  })

  if (nextItem?.concept) {
    nextTopic = {
      concept: nextItem.concept.name,
      subject: toSubjectKey(nextItem.concept.subject.name),
      minutes: 20,
      reason: 'Next in your learning plan',
    }
  }

  // --- Premium / freemium status ---
  const isPremium =
    user.subscriptionStatus === 'premium' ||
    (user.subscriptionExpiry !== null &&
      user.subscriptionExpiry !== undefined &&
      user.subscriptionExpiry > new Date())
  const isFreemium = !isPremium

  return NextResponse.json({
    studentName: user.name ?? 'Student',
    grade: user.grade ?? '',
    streak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    xp,
    xpLevel: level,
    xpLevelFloor,
    xpToNext,
    examName,
    examDate: examDate?.toISOString() ?? null,
    examDaysLeft,
    readinessBySubject,
    nextTopic,
    isPremium,
    isFreemium,
    sessionsUsed: sessionsToday,
    plan: isPremium ? 'premium' : ('free' as const),
    revisionsDue,
  })
}
