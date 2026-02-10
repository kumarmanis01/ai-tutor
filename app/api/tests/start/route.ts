import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSessionForHandlers } from '@/lib/session';
import { selectQuestions } from '@/lib/tests';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tests/start
 * Body: { subject?, grade?, board?, chapter?, difficulty?, type?, count? }
 * Starts a new quick practice attempt and returns attemptId + questions.
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'TestsStartAPI', methodName: 'POST' }, start);
    return res;
  }

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

  try {
    const questions = await selectQuestions({ subject, grade, board, chapter, difficulty, type }, count);
    if (!questions.length) {
      res = NextResponse.json({ error: 'No questions available for selection' }, { status: 404 });
      logger.logAPI(req, res, { className: 'TestsStartAPI', methodName: 'POST' }, start);
      return res;
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

    res = NextResponse.json({ attemptId: attempt.id, questions: payload });
    logger.logAPI(req, res, { className: 'TestsStartAPI', methodName: 'POST' }, start);
    return res;
  } catch (err: any) {
    logger.error('TestsStartAPI POST error', { error: err?.message });
    res = NextResponse.json(
      { error: 'Failed to start test. Please try again later.' },
      { status: 500 },
    );
    logger.logAPI(req, res, { className: 'TestsStartAPI', methodName: 'POST' }, start);
    return res;
  }
}
