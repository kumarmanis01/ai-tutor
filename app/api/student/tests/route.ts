/**
 * GET /api/student/tests
 * Returns test data for the new tests screen.
 *
 * Response: TestsData  (see app/(student)/student/tests/page.tsx)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { getReadinessTier } from '@/lib/constants/readiness'
import { FREE_TIER_CHAPTER_TEST_LIMIT } from '@/lib/constants/freemium'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

export const dynamic = 'force-dynamic'

function toSubjectKey(name: string): SubjectKey {
  const n = name.toLowerCase()
  if (n.includes('math')) return 'math'
  if (n.includes('science') && !n.includes('social')) return 'science'
  if (n.includes('social')) return 'social'
  if (n.includes('english')) return 'english'
  if (n.includes('hindi')) return 'hindi'
  return n as SubjectKey
}

export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user, recentResults, upcomingItems] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpiry: true },
    }),
    prisma.testResult.findMany({
      where: { studentId: userId },
      orderBy: { finishedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        testId: true,
        score: true,
        finishedAt: true,
        startedAt: true,
      },
    }),
    prisma.learningPlanItem.findMany({
      where: {
        plan: { studentId: userId },
        status: { in: ['UPCOMING', 'IN_PROGRESS'] },
      },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
      take: 10,
      select: {
        id: true,
        status: true,
        concept: {
          select: {
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const isPremium =
    user?.subscriptionStatus === 'premium' ||
    (user?.subscriptionExpiry != null && user.subscriptionExpiry > new Date())

  const testsUsed = recentResults.length
  const freeRemaining = Math.max(0, FREE_TIER_CHAPTER_TEST_LIMIT - testsUsed)

  // Build recommended tests from upcoming learning plan items (chapter tests)
  const recommended = upcomingItems.slice(0, 5).map((item, idx) => ({
    id: `plan-${item.id}`,
    title: `${item.concept.name} Test`,
    subject: toSubjectKey(item.concept.subject.name),
    type: 'chapter' as const,
    questionCount: 10,
    durationMinutes: 15,
    isLocked: !isPremium && idx >= freeRemaining,
    reason: item.status === 'IN_PROGRESS' ? 'In progress' : 'Up next in your plan',
  }))

  // History from TestResult
  const history = recentResults.map((r) => ({
    id: r.id,
    title: `Test ${r.testId.slice(0, 8)}`,
    subject: 'math' as SubjectKey, // testId not joined to subject; fallback
    type: 'chapter' as const,
    questionCount: 10,
    durationMinutes: 15,
    isLocked: false,
    bestScore: r.score ?? undefined,
    tier: r.score != null
      ? (getReadinessTier(r.score) as TierKey)
      : undefined,
    xpEarned: r.score != null ? Math.round(r.score * 1.5) : 0,
    date: r.finishedAt
      ? new Date(r.finishedAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })
      : undefined,
  }))

  return NextResponse.json({
    isPremium,
    testsUsed,
    recommended,
    upcoming: [],
    history,
    mockExam: null,
  })
}
