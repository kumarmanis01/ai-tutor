import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ activities: [] });

  const sessions = await prisma.learningSession.findMany({
    where: { studentId: session.user.id, isCompleted: false },
    take: 10,
    orderBy: { lastAccessed: 'desc' },
  });

  const activities = sessions.map((s) => {
    const meta = (s.meta && typeof s.meta === 'object' ? s.meta : {}) as Record<string, unknown>;
    const subject = (meta.subject as string) || (meta.subjectName as string) || undefined;
    const title = (meta.title as string) || (meta.activityTitle as string) || undefined;

    return {
      id: s.id,
      activityType: s.activityType,
      subject,
      title,
      contentId: s.activityRef || undefined,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      completionPercentage: s.completionPercentage,
      meta: s.meta ?? null,
    };
  });

  return NextResponse.json({ activities });
}
