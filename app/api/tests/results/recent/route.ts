import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ results: [] });
  const results = await prisma.testResult.findMany({
    where: { studentId: session.user.id },
    select: { id: true, testId: true, score: true, finishedAt: true, createdAt: true },
    take: 10,
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
  });
  const payload = results.map((r) => ({
    id: r.id,
    title: r.testId,
    score: (typeof r.score === 'number' ? r.score : null) ?? undefined,
    date: (r.finishedAt || r.createdAt).toISOString(),
  }));
  return NextResponse.json({ results: payload });
}
