import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tests/history
 * Returns the user's recent attempts with summary.
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const attempts = await prisma.testResult.findMany({
    where: { studentId: user.id },
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  });

  const history = attempts.map((a) => ({
    id: a.id,
    testId: a.testId,
    scorePercent: a.score ?? null,
    startedAt: a.startedAt ?? null,
    finishedAt: a.finishedAt ?? null,
  }));

  return NextResponse.json({ attempts: history });
}
