import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getReadinessTier } from '@/lib/constants/readiness'
import type { TierKey } from '@/lib/constants/tiers'
import type { AppSession } from '@/lib/types/auth'
import ParentDashboardClient from './ParentDashboardClient'

export default async function ParentDashboardPage() {
  const session = (await getServerSession(authOptions)) as AppSession | null
  if (!session?.user?.id) redirect('/login/parent')
  if ((session.user as { role?: string }).role !== 'parent' && (session.user as { accountStatus?: string }).accountStatus !== 'active') {
    redirect('/parent/onboarding')
  }

  const parentId = session.user.id

  const link = await prisma.parentStudent.findFirst({
    where: { parentId, status: 'active' },
    select: { studentId: true },
  })

  if (!link) {
    return <ParentDashboardClient initialData={null} />
  }

  const studentId = link.studentId

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [student, readinessList, recentSessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: studentId },
      select: { name: true, grade: true, currentStreak: true, subscriptionStatus: true },
    }),
    prisma.readinessStatus.findMany({
      where: { userId: studentId },
      select: { subject: true, readinessScore: true },
    }),
    prisma.structuredSession.findMany({
      where: { userId: studentId, startedAt: { gte: today, lt: tomorrow } },
      orderBy: { startedAt: 'asc' },
      take: 5,
      select: {
        id: true,
        startedAt: true,
        topic: {
          select: {
            name: true,
            chapter: { select: { subject: { select: { name: true } } } },
          },
        },
      },
    }),
  ])

  const subjectTiers = readinessList.map(r => ({
    subject: r.subject,
    tier: getReadinessTier(r.readinessScore) as TierKey,
  }))

  const avgScore = readinessList.length > 0
    ? readinessList.reduce((s, r) => s + r.readinessScore, 0) / readinessList.length
    : 0
  const overallTier = getReadinessTier(avgScore) as TierKey

  // Build alerts for subjects with critical/weak readiness
  const alerts = readinessList
    .filter(r => r.readinessScore < 40)
    .slice(0, 3)
    .map((r, i) => ({
      id: `alert-${i}`,
      message: `${r.subject}: readiness is ${getReadinessTier(r.readinessScore)} - needs attention`,
      severity: r.readinessScore < 20 ? ('critical' as const) : ('warning' as const),
    }))

  const upcomingSessions = recentSessions.map(s => ({
    id: s.id,
    concept: s.topic?.name ?? 'Session',
    subject: s.topic?.chapter?.subject?.name ?? '',
    scheduledAt: s.startedAt.toISOString(),
  }))

  return (
    <ParentDashboardClient
      initialData={{
        childName: student.name ?? 'Your child',
        grade: student.grade ?? '',
        streak: student.currentStreak ?? 0,
        overallTier,
        subjectTiers,
        upcomingSessions,
        alerts,
        isPremium: student.subscriptionStatus === 'premium' || student.subscriptionStatus === 'active',
      }}
    />
  )
}
