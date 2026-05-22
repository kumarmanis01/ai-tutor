
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ activities: [] });

  // Query StructuredSession for active and recently completed sessions
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.structuredSession.findMany({
    where: {
      studentId: session.user.id,
      OR: [
        { state: { notIn: ['COMPLETE', 'EXPIRED'] } },
        { state: 'COMPLETE', completedAt: { gt: sevenDaysAgo } },
      ],
    },
    take: 10,
    orderBy: [
      { state: { sort: 'asc' } }, // active sessions first
      { completedAt: 'desc' },
      { startedAt: 'desc' },
    ],
    include: {
      topic: {
        select: {
          name: true,
          chapter: {
            select: { name: true, subject: { select: { name: true } } },
          },
        },
      },
    },
  });

  const activities = sessions.map((s) => {
    // Keep response shape compatible with LearningSession-based version
    return {
      id: s.id,
      activityType: 'structured_session',
      subject: s.topic?.chapter?.subject?.name ?? undefined,
      title: s.topic?.name ?? undefined,
      contentId: s.topicId,
      startedAt: s.startedAt,
      endedAt: s.completedAt,
      completionPercentage: s.state === 'COMPLETE' ? 100 : 0,
      meta: s.meta ?? null,
    };
  });

  return NextResponse.json({ activities });
}
