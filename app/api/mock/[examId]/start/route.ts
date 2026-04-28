import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mock/[examId]/start
 *
 * Creates a MockExamAttempt and returns the full exam structure
 * (sections + questions) needed to render MockExamRunner.
 *
 * AC-02: Returns durationSeconds so the client can start the countdown.
 * Auth-guarded: 401 before any DB query.
 */
export async function POST(req: Request, { params }: { params: { examId: string } }) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id: string } | undefined;

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockStartAPI', methodName: 'POST' }, start);
    return res;
  }

  const { examId } = await Promise.resolve(params);

  const exam = await prisma.mockExam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      totalMarks: true,
      durationMin: true,
      subject: { select: { name: true } },
      sections: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          order: true,
          totalMarks: true,
          instructions: true,
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              marks: true,
              order: true,
              question: {
                select: {
                  id: true,
                  type: true,
                  prompt: true,
                  choices: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    const res = NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'MockStartAPI', methodName: 'POST' }, start);
    return res;
  }

  const attempt = await prisma.mockExamAttempt.create({
    data: {
      mockExamId: examId,
      studentId: user.id,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  // Flatten sections for client
  const sections = exam.sections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    order: sec.order,
    totalMarks: sec.totalMarks,
    instructions: sec.instructions,
    questions: sec.questions.map((mq) => ({
      mockQuestionId: mq.id,
      questionId: mq.question.id,
      marks: mq.marks,
      order: mq.order,
      type: mq.question.type,
      prompt: mq.question.prompt,
      choices: mq.question.choices ?? null,
    })),
  }));

  const payload = {
    attemptId: attempt.id,
    examTitle: exam.title,
    subjectName: exam.subject.name,
    totalMarks: exam.totalMarks,
    durationSeconds: exam.durationMin * 60,
    sections,
  };

  const res = NextResponse.json(payload);
  logger.logAPI(req, res, { className: 'MockStartAPI', methodName: 'POST' }, start);
  return res;
}
