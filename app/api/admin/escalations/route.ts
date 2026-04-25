import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const escalations = await prisma.doubtEscalation.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      student: { select: { id: true, name: true, email: true, grade: true, board: true } },
    },
  });

  return NextResponse.json({ escalations, count: escalations.length });
}
