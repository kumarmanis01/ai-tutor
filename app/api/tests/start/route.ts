import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSessionForHandlers } from '@/lib/session';
import { selectQuestions } from '@/lib/tests';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tests/start
 * Body: { subject?, grade?, board?, chapter?, difficulty?, type?, count? }
 * Starts a new quick practice attempt and returns attemptId + questions.
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    subject,
    grade,
    board,
    chapter,
    difficulty,
    type,
    count = 10,
  } = body ?? {};

  const questions = await selectQuestions({ subject, grade, board, chapter, difficulty, type }, count);
  if (!questions.length) {
    return NextResponse.json({ error: 'No questions available for selection' }, { status: 404 });
  }

  const attempt = await prisma.testResult.create({
    data: {
      testId: 'quick-practice',
      studentId: user.id,
      score: null,
      rawResult: Prisma.JsonNull,
      startedAt: new Date(),
    },
  });

  // Persist AttemptQuestion rows
  await prisma.$transaction(
    questions.map((q, idx) =>
      prisma.attemptQuestion.create({
        data: {
          testResultId: attempt.id,
          questionId: q.id,
          order: idx + 1,
        },
      }),
    ),
  );

  const payload = questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    choices: q.choices ?? null,
    difficulty: q.difficulty ?? null,
  }));

  return NextResponse.json({ attemptId: attempt.id, questions: payload });
}
