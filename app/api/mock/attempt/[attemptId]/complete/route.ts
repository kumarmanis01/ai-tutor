import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { buildPriorityPlan } from '@/lib/mock/buildPriorityPlan';
import { computeSectionScores } from '@/lib/mock/selectMockQuestions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mock/attempt/[attemptId]/complete
 *
 * Finalises a mock exam attempt:
 *   1. Auto-submits any un-submitted sections (with empty answers = score 0).
 *   2. Computes overall scorePercent and percentile vs cohort.
 *   3. Generates AI "Next 2 Weeks Priority Plan" (AC-05).
 *   4. Persists all results.
 *   5. Returns the full report payload.
 *
 * Idempotent: calling twice returns the stored result.
 * Auth-guarded: 401 before any DB query.
 */
export async function POST(
  req: Request,
  { params }: { params: { attemptId: string } },
) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id: string } | undefined;

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  const { attemptId } = await Promise.resolve(params);

  const attempt = await prisma.mockExamAttempt.findFirst({
    where: { id: attemptId, studentId: user.id },
    include: {
      mockExam: {
        include: {
          sections: {
            orderBy: { order: 'asc' },
            select: { id: true, title: true, totalMarks: true },
          },
          subject: { select: { name: true } },
        },
      },
      sectionAttempts: true,
    },
  });

  if (!attempt) {
    const res = NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'MockCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  // Idempotent: already finished
  if (attempt.finishedAt) {
    const res = NextResponse.json({
      attemptId,
      scorePercent: attempt.scorePercent,
      percentile: attempt.percentile,
      priorityPlan: attempt.priorityPlan,
      rawResult: attempt.rawResult,
    });
    logger.logAPI(req, res, { className: 'MockCompleteAPI', methodName: 'POST' }, start);
    return res;
  }

  // Auto-submit any sections that haven't been submitted yet
  const submittedSectionIds = new Set(
    attempt.sectionAttempts.filter((sa) => sa.submittedAt).map((sa) => sa.sectionId),
  );

  for (const sec of attempt.mockExam.sections) {
    if (!submittedSectionIds.has(sec.id)) {
      await prisma.mockExamSectionAttempt.upsert({
        where: { attemptId_sectionId: { attemptId, sectionId: sec.id } },
        create: {
          attemptId,
          sectionId: sec.id,
          submittedAt: new Date(),
          scorePercent: 0,
          answers: [] as any,
        },
        update: { submittedAt: new Date(), scorePercent: 0 },
      });
    }
  }

  // Re-fetch section attempts after auto-submit
  const allSectionAttempts = await prisma.mockExamSectionAttempt.findMany({
    where: { attemptId },
    select: { sectionId: true, scorePercent: true, answers: true },
  });

  const sectionScores = computeSectionScores(attempt.mockExam.sections, allSectionAttempts);

  // Weighted overall score: sum of (section score % × section total marks) / total marks
  const totalMarks = attempt.mockExam.sections.reduce((s, sec) => s + sec.totalMarks, 0);
  const earnedMarks = sectionScores.reduce((s, ss) => s + ss.marksEarned, 0);
  const overallScore = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;

  // Percentile: fraction of completed attempts for this exam with score <= this score
  const cohortCount = await prisma.mockExamAttempt.count({
    where: { mockExamId: attempt.mockExamId, finishedAt: { not: null } },
  });
  const belowCount = await prisma.mockExamAttempt.count({
    where: {
      mockExamId: attempt.mockExamId,
      finishedAt: { not: null },
      scorePercent: { lte: overallScore },
    },
  });
  const percentile = cohortCount > 0 ? (belowCount / cohortCount) * 100 : 50;

  // AC-05: Generate AI priority plan (fire non-blocking; complete stores result)
  const priorityPlan = await buildPriorityPlan({
    studentId: user.id,
    attemptId,
    subjectName: attempt.mockExam.subject.name,
    overallScore,
    sectionScores,
  });

  const rawResult = {
    totalMarks,
    earnedMarks,
    overallScore,
    sectionScores,
  };

  await prisma.mockExamAttempt.update({
    where: { id: attemptId },
    data: {
      finishedAt: new Date(),
      scorePercent: overallScore,
      percentile,
      priorityPlan,
      rawResult: rawResult as any,
    },
  });

  logger.info('mock.completed', {
    studentId: user.id,
    attemptId,
    overallScore,
    percentile,
  });

  const res = NextResponse.json({ attemptId, scorePercent: overallScore, percentile, priorityPlan, rawResult });
  logger.logAPI(req, res, { className: 'MockCompleteAPI', methodName: 'POST' }, start);
  return res;
}
