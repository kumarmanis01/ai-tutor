import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { buildPriorityPlan } from '@/lib/mock/buildPriorityPlan';
import { computeSectionScores } from '@/lib/mock/selectMockQuestions';
import { logger } from '@/lib/logger';
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery';
import { milestoneEmailHtml } from '@/lib/email/templates';
import { buildMilestoneTemplate } from '@/lib/whatsapp/templates';

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
  const MIN_COHORT = Number(process.env.MOCK_COHORT_MIN ?? 10);

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
    const percentileReliable = (attempt.cohortCount ?? 0) >= MIN_COHORT && typeof attempt.percentile === 'number';
    const res = NextResponse.json({
      attemptId,
      scorePercent: attempt.scorePercent,
      percentile: attempt.percentile,
      percentileReliable,
      cohortCount: attempt.cohortCount ?? undefined,
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

  // Percentile: fraction of completed attempts in the user's grade/board/subject
  // for the same mock version within a recent time window (last 90 days).
  const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const cohortCount = await prisma.mockExamAttempt.count({
    where: {
      finishedAt: { not: null, gte: windowStart },
      mockExam: {
        subjectId: attempt.mockExam.subjectId,
        grade: attempt.mockExam.grade,
        board: attempt.mockExam.board,
        version: attempt.mockExam.version,
      },
    },
  });

  const belowCount = await prisma.mockExamAttempt.count({
    where: {
      finishedAt: { not: null, gte: windowStart },
      scorePercent: { lte: overallScore },
      mockExam: {
        subjectId: attempt.mockExam.subjectId,
        grade: attempt.mockExam.grade,
        board: attempt.mockExam.board,
        version: attempt.mockExam.version,
      },
    },
  });

  // Only consider percentiles reliable when cohort reaches a minimum size.
  let percentile: number | null = null;
  let percentileReliable = false;
  if (cohortCount >= MIN_COHORT) {
    percentile = cohortCount > 0 ? (belowCount / cohortCount) * 100 : 50;
    percentileReliable = true;
  } else {
    percentile = null;
    percentileReliable = false;
  }

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
      cohortCount,
      priorityPlan,
      rawResult: rawResult as any,
    },
  });

  // Award a one-time 'mock_complete' badge for students who finish their first
  // full mock exam. Badge rows are upserted (auto-seed) and userBadge uses
  // skipDuplicates to be idempotent.
  try {
    await prisma.$transaction([
      prisma.badge.upsert({
        where: { key: 'mock_complete' },
        create: { key: 'mock_complete', name: 'Mock Champ', description: 'Completed your first full mock exam', icon: 'medal' },
        update: {},
      }),
      prisma.userBadge.createMany({ data: [{ studentId: user.id, badgeKey: 'mock_complete' }], skipDuplicates: true }),
    ])
  } catch (err) {
    // Non-blocking: don't fail the mock complete API if badge awarding fails
    logger.warn('mock.complete: failed to award mock_complete badge', { studentId: user.id, error: String(err) })
  }

  // Parent milestone notification (F-PAR-022 AC-01): mock completion + score.
  try {
    const parentLinks = await prisma.parentStudent.findMany({
      where: { studentId: user.id, status: 'active' },
      include: { parent: { select: { id: true, email: true, whatsappPhone: true, name: true, language: true } } },
    })
    if (parentLinks.length > 0) {
      const scoreLabel = `${Math.round(overallScore)}%`
      const milestoneLabel = `Mock exam completed (${scoreLabel})`
      const dashboardUrl = `${(process.env.NEXTAUTH_URL ?? 'https://spinzyacademy.com').replace(/\/$/, '')}/parent/dashboard`
      await Promise.allSettled(parentLinks.map((pl) => {
        // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
        const brandedHtml = milestoneEmailHtml({
          parentName: pl.parent.name ?? 'Parent',
          studentName: 'Your child',
          milestoneLabel,
          milestoneDetail: `Great effort. Encourage a quick review of weaker sections this week to build exam confidence.`,
          dashboardUrl,
        })
        const waTemplate = pl.parent.whatsappPhone
          ? buildMilestoneTemplate(pl.parent.name ?? 'Parent', 'Your child', milestoneLabel, dashboardUrl)
          : undefined
        return sendParentMilestoneNotification(pl.parent.id, {
          email: pl.parent.email ?? undefined,
          whatsappPhone: pl.parent.whatsappPhone ?? undefined,
          whatsappTemplate: waTemplate,
          subject: `Mock completed: ${scoreLabel}`,
          html: brandedHtml,
          text: `Mock completed with ${scoreLabel}. View details: ${dashboardUrl}`,
          meta: { studentId: user.id, type: 'milestone', locale: pl.parent.language ?? undefined },
        })
      }))
    }
  } catch (err) {
    logger.warn('mock.complete: failed to notify parents', { studentId: user.id, error: String(err) })
  }

  logger.info('mock.completed', {
    studentId: user.id,
    attemptId,
    overallScore,
    percentile,
    cohortCount,
    percentileReliable,
  });

  const res = NextResponse.json({
    attemptId,
    scorePercent: overallScore,
    percentile,
    percentileReliable,
    cohortCount,
    priorityPlan,
    rawResult,
  });
  logger.logAPI(req, res, { className: 'MockCompleteAPI', methodName: 'POST' }, start);
  return res;
}
