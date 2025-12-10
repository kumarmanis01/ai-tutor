import { getServerSessionForHandlers } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const by = searchParams.get('by');

  if (by === 'tests') {
    const grade = searchParams.get('grade');
    const board = searchParams.get('board');
    const subject = searchParams.get('subject');
    const period = searchParams.get('period') ?? 'weekly';

    const now = new Date();
    const start = new Date(now);
    if (period === 'weekly') start.setDate(now.getDate() - 7);
    else start.setFullYear(now.getFullYear() - 10); // effectively all-time

    const attempts = await prisma.testResult.findMany({
      where: {
        finishedAt: { gte: start },
        score: { not: null },
      },
      orderBy: { score: 'desc' },
      take: 200,
    });

    const userIds = [...new Set(attempts.map((a) => a.studentId))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
    const byUser = new Map(users.map((u) => [u.id, u] as const));

    const attemptIds = attempts.map((a) => a.id);
    const firstItems = await prisma.attemptQuestion.findMany({
      where: { testResultId: { in: attemptIds }, order: 1 },
      include: { question: true },
    });
    const firstByAttempt = new Map(firstItems.map((i) => [i.testResultId, i] as const));

    const scoped = attempts.filter((a) => {
      const user = byUser.get(a.studentId);
      if (grade && user?.grade !== grade) return false;
      if (board && user?.board !== board) return false;
      if (subject) {
        const first = firstByAttempt.get(a.id);
        const qSubject = first?.question?.subject ?? null;
        if (!qSubject || qSubject.toLowerCase() !== subject.toLowerCase()) return false;
      }
      return true;
    });

    const top = scoped
      .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
      .slice(0, 20)
      .map((a, idx) => ({
        rank: idx + 1,
        userId: a.studentId,
        scorePercent: a.score ?? 0,
        attemptId: a.id,
      }));

    logApiUsage('/api/leaderboard?by=tests', 'GET');
    return NextResponse.json({ period, grade, board, subject, top });
  }

  // default leaderboard by points
  const top = await prisma.user.findMany({
    orderBy: { points: 'desc' },
    take: 20,
    select: { id: true, name: true, image: true, points: true },
  });
  logApiUsage('/api/leaderboard', 'GET');
  return NextResponse.json({ top });
}
