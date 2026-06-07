import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ status: 'disconnected', metrics: null });

  // We only need to know whether ANY parent-student link exists for this user,
  // not the full list. Cap to 1 (existence check) and replace the prior
  // unbounded findMany that would have OOM'd for a school admin with many
  // attached children.
  const link = await prisma.parentStudent.findFirst({
    where: {
      OR: [
        { parentId: session.user.id, status: 'active' },
        { studentId: session.user.id, status: 'active' },
      ],
    },
    select: { id: true },
  });
  const connected = !!link;
  const lastWeek = await prisma.learningSession.count({ where: { studentId: session.user.id } });
  return NextResponse.json({ status: connected ? 'connected' : 'disconnected', metrics: { sessionsLastWeek: lastWeek } });
}
