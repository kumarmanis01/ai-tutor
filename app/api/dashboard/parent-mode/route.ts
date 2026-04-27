import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ status: 'disconnected', metrics: null });
  const relations = await prisma.parentStudent.findMany({ where: { OR: [{ parentId: session.user.id }, { studentId: session.user.id }] } });
  const connected = relations.length > 0;
  const lastWeek = await prisma.learningSession.count({ where: { studentId: session.user.id } });
  return NextResponse.json({ status: connected ? 'connected' : 'disconnected', metrics: { sessionsLastWeek: lastWeek } });
}
