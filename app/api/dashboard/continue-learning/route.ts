import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ activities: [] });
  const sessions = await prisma.learningSession.findMany({
    where: { studentId: session.user.id },
    take: 5,
    orderBy: { startedAt: 'desc' },
  });
  const activities = sessions
    .filter((s) => !s.endedAt)
    .map((s) => ({
      id: s.id,
      activityType: s.activityType,
      subject: undefined,
      contentId: s.activityRef || undefined,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      meta: s.meta ?? null,
    }));
  return NextResponse.json({ activities });
}
