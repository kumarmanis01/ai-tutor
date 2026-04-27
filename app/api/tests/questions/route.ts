import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tests/questions?attemptId=...
 * Returns ordered questions for the given attempt.
 */
export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get('attemptId');
  if (!attemptId) return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });

  // Ensure attempt belongs to user
  const attempt = await prisma.testResult.findFirst({ where: { id: attemptId, studentId: user.id } });
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  const rows = await prisma.attemptQuestion.findMany({
    where: { testResultId: attemptId },
    include: { question: true },
    orderBy: { order: 'asc' },
  });

  const questions = rows.map((r) => ({
    id: r.question.id,
    type: r.question.type,
    prompt: r.question.prompt,
    choices: r.question.choices ?? null,
    difficulty: r.question.difficulty ?? null,
    order: r.order,
  }));

  return NextResponse.json({ attemptId, questions });
}
