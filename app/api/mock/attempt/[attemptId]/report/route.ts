import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mock/attempt/[attemptId]/report
 *
 * Returns the full detailed report for a completed mock exam attempt.
 * AC-04: Section-wise score, time per question (from answers JSON), percentile.
 *
 * Auth-guarded: 401 before any DB query.
 */
export async function GET(
  req: Request,
  { params }: { params: { attemptId: string } },
) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id: string } | undefined;

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockReportAPI', methodName: 'GET' }, start);
    return res;
  }

  const { attemptId } = await Promise.resolve(params);

  const attempt = await prisma.mockExamAttempt.findFirst({
    where: { id: attemptId, studentId: user.id },
    include: {
      mockExam: {
        select: {
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
                      correctAnswer: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      sectionAttempts: {
        select: { sectionId: true, scorePercent: true, answers: true, submittedAt: true },
      },
    },
  });

  if (!attempt) {
    const res = NextResponse.json({ error: 'Report not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'MockReportAPI', methodName: 'GET' }, start);
    return res;
  }

  // Build per-section detail including per-question time heatmap (AC-04)
  const saMap = new Map(attempt.sectionAttempts.map((sa) => [sa.sectionId, sa]));

  const sectionsDetail = attempt.mockExam.sections.map((sec) => {
    const sa = saMap.get(sec.id);
    const answersArr: Array<{ questionId: string; answer: string; timeSpentSeconds: number }> =
      Array.isArray(sa?.answers) ? (sa.answers as any) : [];
    const answerMap = new Map(answersArr.map((a) => [a.questionId, a]));

    const questions = sec.questions.map((mq) => {
      const submitted = answerMap.get(mq.question.id);
      return {
        order: mq.order,
        marks: mq.marks,
        prompt: mq.question.prompt,
        type: mq.question.type,
        correctAnswer: mq.question.correctAnswer,
        submittedAnswer: submitted?.answer ?? null,
        timeSpentSeconds: submitted?.timeSpentSeconds ?? 0,
      };
    });

    return {
      sectionId: sec.id,
      title: sec.title,
      totalMarks: sec.totalMarks,
      scorePercent: sa?.scorePercent ?? 0,
      marksEarned: Math.round(((sa?.scorePercent ?? 0) / 100) * sec.totalMarks),
      questions,
    };
  });

  const payload = {
    attemptId,
    examTitle: attempt.mockExam.title,
    subjectName: attempt.mockExam.subject.name,
    totalMarks: attempt.mockExam.totalMarks,
    scorePercent: attempt.scorePercent,
    percentile: attempt.percentile,
    priorityPlan: attempt.priorityPlan,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    sections: sectionsDetail,
  };

  const res = NextResponse.json(payload);
  logger.logAPI(req, res, { className: 'MockReportAPI', methodName: 'GET' }, start);
  return res;
}
