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
    // Recompute cohort size and mark percentile as reliable only when cohort is large enough.
    // This protects students from misleading percentiles when very few attempts exist.
    percentile: attempt.percentile,
    // include cohortCount and a reliability flag in the report payload
    // (consumer UI may override displayed percentile when unreliable)
    cohortCount: undefined as number | undefined,
    percentileReliable: undefined as boolean | undefined,
    priorityPlan: attempt.priorityPlan,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    sections: sectionsDetail,
  };

  // Compute cohortCount to inform UI about percentile reliability
  try {
    const MIN_COHORT = Number(process.env.MOCK_COHORT_MIN ?? 10);
    const cohortCount = await prisma.mockExamAttempt.count({
      where: { mockExamId: attempt.mockExamId, finishedAt: { not: null } },
    });
    const percentileReliable = cohortCount >= MIN_COHORT && typeof attempt.percentile === 'number';
    (payload as any).cohortCount = cohortCount;
    (payload as any).percentileReliable = percentileReliable;
    if (!percentileReliable) {
      // Hide percentile when not reliable
      (payload as any).percentile = null;
    }
  } catch (e) {
    // best-effort; if counting fails, leave cohortCount/percentileReliable undefined
  }

  const res = NextResponse.json(payload);
  logger.logAPI(req, res, { className: 'MockReportAPI', methodName: 'GET' }, start);
  return res;
}
