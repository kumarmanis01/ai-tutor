import { redirect } from 'next/navigation'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getReadinessTier } from '@/lib/constants/readiness'
import { FREE_TIER_SESSION_LIMIT } from '@/lib/constants/freemium'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'
import DashboardClient from './DashboardClient'

const XP_PER_LEVEL = 500

function toSubjectKey(name: string): SubjectKey {
  const map: Record<string, SubjectKey> = {
    mathematics: 'math', maths: 'math', math: 'math',
    science: 'science',
    'social science': 'social', social: 'social',
    english: 'english',
    hindi: 'hindi',
  }
  return map[name.toLowerCase()] ?? 'science'
}

export default async function DashboardPage() {
  const session = await requireActiveSession()
  if (!session) redirect('/login/student')

  const userId = session.user.id

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [user, readinessList, plan, sessionsTodayCount, revisionsDueCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        grade: true,
        totalXp: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
        subscriptionStatus: true,
      },
    }),
    prisma.readinessStatus.findMany({
      where: { userId },
      select: { subject: true, readinessScore: true, readinessLabel: true },
    }),
    prisma.learningPlan.findFirst({
      where: { userId },
      select: {
        examDate: true,
        examName: true,
        items: {
          where: { status: { in: ['UPCOMING', 'IN_PROGRESS'] } },
          orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
          take: 1,
          select: {
            concept: {
              select: {
                name: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.structuredSession.count({
      where: { userId, startedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.studentConceptState.count({
      where: { userId, nextReviewAt: { lte: new Date() } },
    }),
  ])

  const isPremium = user.subscriptionStatus === 'premium' || user.subscriptionStatus === 'active'
  const isFreemium = !isPremium

  const level = user.level ?? 1
  const xp = user.totalXp ?? 0
  const xpLevelFloor = (level - 1) * XP_PER_LEVEL
  const xpToNext = level * XP_PER_LEVEL

  let examDaysLeft = 0
  let examName = 'Board Exam'
  if (plan?.examDate) {
    const diff = Math.ceil((plan.examDate.getTime() - Date.now()) / 86400000)
    examDaysLeft = Math.max(0, diff)
  }
  if (plan?.examName) examName = plan.examName

  const readinessBySubject = readinessList.map(r => ({
    subject: toSubjectKey(r.subject) as SubjectKey,
    tier: getReadinessTier(r.readinessScore) as TierKey,
    trend: 0,
  }))

  let nextTopic: { concept: string; subject: SubjectKey; minutes: number; reason: string } | null = null
  const firstItem = plan?.items?.[0]
  if (firstItem?.concept) {
    nextTopic = {
      concept: firstItem.concept.name,
      subject: toSubjectKey(firstItem.concept.subject?.name ?? ''),
      minutes: 20,
      reason: 'Next in your learning plan',
    }
  }

  const initialData = {
    studentName: user.name ?? 'Student',
    grade: user.grade ?? '',
    streak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    xp,
    xpLevel: level,
    xpLevelFloor,
    xpToNext,
    examName,
    examDate: plan?.examDate?.toISOString() ?? '',
    examDaysLeft,
    readinessBySubject,
    nextTopic,
    isPremium,
    isFreemium,
    sessionsUsed: sessionsTodayCount,
    plan: isPremium ? ('premium' as const) : ('free' as const),
    revisionsDue: revisionsDueCount,
    freeLimit: FREE_TIER_SESSION_LIMIT,
  }

  return <DashboardClient initialData={initialData} />
}
