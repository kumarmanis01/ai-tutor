/**
 * GET /api/parent/schedule
 * Returns the weekly session schedule for linked student(s).
 *
 * Response: { sessions: ScheduleSession[] }  (see app/(parent)/parent/schedule/page.tsx)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { AppSession } from '@/lib/types/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = (await getServerSession(authOptions)) as AppSession | null
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'parent') {
    return NextResponse.json({ error: 'Parent role required' }, { status: 403 })
  }

  const parentId = session.user.id

  // Get linked students
  const links = await prisma.parentStudent.findMany({
    where: { parentId, status: 'active' },
    select: { studentId: true },
  })

  if (links.length === 0) {
    return NextResponse.json({ sessions: [] })
  }

  const studentIds = links.map((l) => l.studentId)

  // 7-day window: 2 days back, 5 days ahead
  const windowStart = new Date(Date.now() - 2 * 86_400_000)
  windowStart.setHours(0, 0, 0, 0)
  const windowEnd = new Date(Date.now() + 5 * 86_400_000)
  windowEnd.setHours(23, 59, 59, 999)

  // Completed sessions this week
  const completedSessions = await prisma.structuredSession.findMany({
    where: {
      studentId: { in: studentIds },
      startedAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { startedAt: 'asc' },
    take: 50,
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      topic: {
        select: {
          name: true,
          chapter: { select: { subject: { select: { name: true } } } },
        },
      },
    },
  })

  const now = new Date()

  const sessions = completedSessions.map((s) => {
    let status: 'upcoming' | 'completed' | 'missed'
    if (s.completedAt !== null) {
      status = 'completed'
    } else if (s.startedAt > now) {
      status = 'upcoming'
    } else {
      status = 'missed'
    }
    return {
      id: s.id,
      concept: s.topic.name,
      subject: s.topic.chapter.subject.name,
      scheduledAt: s.startedAt.toISOString(),
      status,
      durationMinutes: s.completedAt
        ? Math.max(5, Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60_000))
        : 20,
    }
  })

  return NextResponse.json({ sessions })
}
