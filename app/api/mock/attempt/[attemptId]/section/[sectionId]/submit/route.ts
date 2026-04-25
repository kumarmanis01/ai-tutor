import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { gradeSingle, normalizeAnswer } from '@/lib/tests';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type Answer = { questionId: string; answer: string; timeSpentSeconds?: number };

/**
 * POST /api/mock/attempt/[attemptId]/section/[sectionId]/submit
 * Body: { answers: Answer[] }
 *
 * Grades all answers in a section and persists the section attempt.
 * A submitted section is locked -- subsequent calls are rejected (idempotent guard).
 *
 * AC-03: Once submitted, a section cannot be revisited.
 * Auth-guarded: 401 before any DB query.
 */
export async function POST(
  req: Request,
  { params }: { params: { attemptId: string; sectionId: string } }
) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id: string } | undefined;

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockSectionSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const { attemptId, sectionId } = await Promise.resolve(params);

  // Ownership check
  const attempt = await prisma.mockExamAttempt.findFirst({
    where: { id: attemptId, studentId: user.id },
    select: { id: true, finishedAt: true },
  });

  if (!attempt) {
    const res = NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'MockSectionSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  if (attempt.finishedAt) {
    const res = NextResponse.json({ error: 'Exam already completed' }, { status: 409 });
    logger.logAPI(req, res, { className: 'MockSectionSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // Idempotent guard: section already submitted
  const existing = await prisma.mockExamSectionAttempt.findUnique({
    where: { attemptId_sectionId: { attemptId, sectionId } },
  });
  if (existing?.submittedAt) {
    const res = NextResponse.json({ error: 'Section already submitted' }, { status: 409 });
    logger.logAPI(req, res, { className: 'MockSectionSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const answers: Answer[] = Array.isArray(body?.answers) ? body.answers : [];

  // Fetch section questions with correct answers for grading
  const sectionQuestions = await prisma.mockExamQuestion.findMany({
    where: { sectionId },
    include: { question: true },
    orderBy: { order: 'asc' },
  });

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  let earnedMarks = 0;
  let totalMarks = 0;

  for (const mq of sectionQuestions) {
    totalMarks += mq.marks;
    const ans = answerMap.get(mq.question.id);
    const { correct } = gradeSingle(mq.question, ans?.answer);
    if (correct) earnedMarks += mq.marks;
  }

  const scorePercent = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;

  // Persist section attempt (upsert for safety)
  await prisma.mockExamSectionAttempt.upsert({
    where: { attemptId_sectionId: { attemptId, sectionId } },
    create: {
      attemptId,
      sectionId,
      submittedAt: new Date(),
      scorePercent,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        answer: normalizeAnswer(a.answer),
        timeSpentSeconds: a.timeSpentSeconds ?? 0,
      })) as any,
    },
    update: {
      submittedAt: new Date(),
      scorePercent,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        answer: normalizeAnswer(a.answer),
        timeSpentSeconds: a.timeSpentSeconds ?? 0,
      })) as any,
    },
  });

  logger.info('mock.section.submitted', {
    studentId: user.id,
    attemptId,
    sectionId,
    scorePercent,
  });

  const res = NextResponse.json({ sectionId, scorePercent, earnedMarks, totalMarks });
  logger.logAPI(req, res, { className: 'MockSectionSubmitAPI', methodName: 'POST' }, start);
  return res;
}
