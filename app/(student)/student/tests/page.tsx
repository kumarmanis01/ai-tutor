import { redirect } from 'next/navigation'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getReadinessTier } from '@/lib/constants/readiness'
import { FREE_TIER_CHAPTER_TEST_LIMIT } from '@/lib/constants/freemium'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'
import TestsClient from './TestsClient'

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

export default async function TestsPage() {
  const session = await requireActiveSession()
  if (!session) redirect('/login/student')

  const userId = session.user.id

  const [user, planItems, testResults] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionStatus: true },
    }),
    prisma.learningPlanItem.findMany({
      where: {
        plan: { userId },
        status: { in: ['UPCOMING', 'IN_PROGRESS'] },
      },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
      take: 5,
      select: {
        id: true,
        concept: {
          select: {
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    prisma.testResult.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        score: true,
        createdAt: true,
      },
    }),
  ])

  const isPremium = user.subscriptionStatus === 'premium' || user.subscriptionStatus === 'active'
  const testsUsed = testResults.length // simplified: count of all test results

  const recommended = planItems.map((item, idx) => {
    const subjectName = item.concept.subject?.name ?? ''
    const isLocked = !isPremium && idx >= FREE_TIER_CHAPTER_TEST_LIMIT
    return {
      id: item.id,
      title: `${item.concept.name} Test`,
      subject: toSubjectKey(subjectName) as SubjectKey,
      type: 'chapter' as const,
      questionCount: 10,
      durationMinutes: 15,
      isLocked,
      reason: 'Based on your learning plan',
    }
  })

  const history = testResults.map(r => {
    const score = r.score ?? 0
    const tier = getReadinessTier(score) as TierKey
    return {
      id: r.id,
      title: 'Chapter Test',
      subject: 'science' as SubjectKey,
      type: 'chapter' as const,
      questionCount: 10,
      durationMinutes: 15,
      isLocked: false,
      bestScore: Math.round(score),
      tier,
      xpEarned: 0,
      date: r.createdAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }
  })

  return (
    <TestsClient
      initialData={{
        isPremium,
        testsUsed,
        recommended,
        upcoming: [],
        history,
        mockExam: null,
      }}
    />
  )
}
