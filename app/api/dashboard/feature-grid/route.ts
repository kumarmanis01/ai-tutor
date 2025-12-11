import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ tiles: [] });
  const [bookmarkCount, sessionsCount] = await Promise.all([
    prisma.bookmark.count({ where: { studentId: session.user.id } }),
    prisma.learningSession.count({ where: { studentId: session.user.id } }),
  ]);
  const tiles = [
    { key: 'notes', title: 'Notes', enabled: true, count: bookmarkCount },
    { key: 'tests', title: 'Tests', enabled: true, count: sessionsCount },
    { key: 'practice', title: 'Practice', enabled: true },
  ];
  return NextResponse.json({ tiles });
}
