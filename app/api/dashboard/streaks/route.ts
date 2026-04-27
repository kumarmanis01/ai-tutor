import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ streaks: [] });
  const streaks = await prisma.studentStreak.findMany({ where: { studentId: session.user.id }, orderBy: { updatedAt: 'desc' }, take: 5 });
  return NextResponse.json({ streaks });
}
