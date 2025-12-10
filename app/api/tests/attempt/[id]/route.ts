import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tests/attempt/:id
 * Returns attempt details including per-question results and answers.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id;
  const attempt = await prisma.testResult.findFirst({ where: { id, studentId: user.id } });
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  const items = await prisma.attemptQuestion.findMany({
    where: { testResultId: id },
    include: { question: true, answer: true },
    orderBy: { order: 'asc' },
  });

  const detail = {
    id: attempt.id,
    testId: attempt.testId,
    scorePercent: attempt.score ?? null,
    startedAt: attempt.startedAt ?? null,
    finishedAt: attempt.finishedAt ?? null,
    items: items.map((i) => ({
      id: i.id,
      order: i.order,
      timeSpent: i.timeSpent ?? null,
      result: i.result ?? null,
      awardedPoints: i.awardedPoints ?? null,
      question: {
        id: i.question.id,
        type: i.question.type,
        prompt: i.question.prompt,
        choices: i.question.choices ?? null,
        difficulty: i.question.difficulty ?? null,
      },
      answer: i.answer
        ? {
            rawAnswer: i.answer.rawAnswer ?? null,
            normalizedAnswer: i.answer.normalizedAnswer ?? null,
            autoScore: i.answer.autoScore ?? null,
            reviewerScore: i.answer.reviewerScore ?? null,
            confidence: i.answer.confidence ?? null,
          }
        : null,
    })),
  };

  return NextResponse.json({ attempt: detail });
}
