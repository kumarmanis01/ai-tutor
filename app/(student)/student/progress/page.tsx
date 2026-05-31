import { redirect } from 'next/navigation'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getReadinessTier } from '@/lib/constants/readiness'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'
import ProgressClient from './ProgressClient'

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

export default async function ProgressPage() {
  const session = await requireActiveSession()
  if (!session) redirect('/login/student')

  const userId = session.user.id

  const now = new Date()
  const days30Ago = new Date(now)
  days30Ago.setDate(days30Ago.getDate() - 30)

  const [user, readinessList, sessions30] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentStreak: true, totalXp: true, level: true },
    }),
    prisma.readinessStatus.findMany({
      where: { userId },
      select: {
        subject: true,
        readinessScore: true,
        topicsCovered: true,
        totalTopics: true,
      },
    }),
    prisma.structuredSession.findMany({
      where: { userId, startedAt: { gte: days30Ago } },
      select: { startedAt: true, topic: { select: { chapter: { select: { subject: { select: { name: true } } } } } } },
    }),
  ])

  // Build trend arrays (sessions per day as readiness proxy, 20pts each, cap 100)
  const trend30: number[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const count = sessions30.filter(s => s.startedAt >= d && s.startedAt < next).length
    trend30.push(Math.min(100, count * 20))
  }
  const trend7 = trend30.slice(-7)

  // Weekly activity per subject (last 7 days, Mon=0..Sun=6)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const weekSessions = sessions30.filter(s => s.startedAt >= weekStart)

  const overallScore = readinessList.length > 0
    ? readinessList.reduce((sum, r) => sum + r.readinessScore, 0) / readinessList.length
    : 0
  const overallTier = getReadinessTier(overallScore) as TierKey

  const subjects = readinessList.map(r => {
    const subKey = toSubjectKey(r.subject) as SubjectKey
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const count = weekSessions.filter(s =>
        s.startedAt >= d && s.startedAt < next &&
        toSubjectKey(s.topic?.chapter?.subject?.name ?? '') === subKey
      ).length
      return Math.min(100, count * 20)
    })
    return {
      subject: subKey,
      tier: getReadinessTier(r.readinessScore) as TierKey,
      topicsCompleted: r.topicsCovered,
      topicsTotal: r.totalTopics,
      weeklyActivity,
    }
  })

  return (
    <ProgressClient
      initialData={{
        streak: user.currentStreak ?? 0,
        xp: user.totalXp ?? 0,
        xpLevel: user.level ?? 1,
        overallTier,
        subjects,
        trend7,
        trend30,
      }}
    />
  )
}
