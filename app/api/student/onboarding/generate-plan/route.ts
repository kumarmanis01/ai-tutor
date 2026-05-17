/**
 * POST /api/student/onboarding/generate-plan
 *
 * Saves examDate + studyDaysPerWeek to StudentLearningProfile then kicks off
 * LearningPlan generation for every subject the student has enrolled in.
 * Returns { ok: true, firstSubjectId, belowMinimumHours?, weeklyMinutes? } on success.
 *
 * F-STU-003 AC-02: belowMinimumHours is true when computed weekly study time < 180 min (3 hrs).
 *
 * Body: { examDate?: string | null, studyDaysPerWeek: number }
 * Auth: session required -- 401 if missing.
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | AC-02: add belowMinimumHours warning to response
 * - 2026-05-13T00:00:00Z | copilot | emit learning path generated analytics after onboarding plan generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { generateLearningPlan } from '@/lib/ai/learningPlan';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import resolveStudentSubjects from '@/lib/subjects/resolveStudentSubjects';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'GeneratePlanAPI', methodName: 'POST' }, start);
      return res;
    }

    const body = await req.json().catch(() => ({}));
    const studyDaysRaw = Number(body.studyDaysPerWeek);
    const studyDaysPerWeek =
      Number.isInteger(studyDaysRaw) && studyDaysRaw >= 1 && studyDaysRaw <= 7
        ? studyDaysRaw
        : 5;

    let examDate: Date | null = null;
    if (body.examDate && typeof body.examDate === 'string') {
      const parsed = new Date(body.examDate);
      if (!isNaN(parsed.getTime()) && parsed > new Date()) {
        examDate = parsed;
      }
    }

    // AC-02: load existing dailyTargetMin to compute weekly study minutes
    const existingProfile = await prisma.studentLearningProfile.findUnique({
      where: { studentId: userId },
      select: { dailyTargetMin: true },
    });
    const dailyTargetMin = existingProfile?.dailyTargetMin ?? 30; // default 30 min/day
    const weeklyMinutes = studyDaysPerWeek * dailyTargetMin;
    const belowMinimumHours = weeklyMinutes < 180; // 3 hrs = 180 min

    // 1. Upsert StudentLearningProfile with study preference
    await prisma.studentLearningProfile.upsert({
      where: { studentId: userId },
      update: { studyDaysPerWeek },
      create: { studentId: userId, studyDaysPerWeek },
    });

    // 2. Find student's enrolled subjects
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subjects: true, board: true, grade: true },
    });

    // Normalise stored slugs to lowercase to handle capitalised values
    // e.g. 'Mathematics' -> 'mathematics', 'Science' -> 'science'
    const normalisedSlugs: string[] = Array.isArray(user?.subjects)
      ? (user!.subjects as string[])
          .filter(Boolean)
          .map((s) => String(s).toLowerCase().replace(/\s+/g, '-'))
      : [];

    const studentGrade = user?.grade ? Number(user.grade) : null;
    const studentBoard = user?.board ?? null;

    if (normalisedSlugs.length === 0 || !studentGrade || !studentBoard) {
      logger.warn('[generate-plan] missing grade/board/subjects -- cannot resolve SubjectDef', {
        className: 'GeneratePlanAPI',
        methodName: 'POST',
        studentId: userId,
        normalisedSlugs,
        grade: user?.grade,
        board: user?.board,
      });
    }

    // Resolve subject IDs using centralised resolver.
    const subjectDefs = await resolveStudentSubjects(user as any, [])
    if (subjectDefs.length === 0) {
      logger.warn('[generate-plan] no SubjectDef rows resolved after resolver', {
        className: 'GeneratePlanAPI',
        methodName: 'POST',
        studentId: userId,
        normalisedSlugs,
        grade: studentGrade,
        board: studentBoard,
      });
    } else {
      logger.info('[generate-plan] resolved subjects', {
        className: 'GeneratePlanAPI',
        methodName: 'POST',
        studentId: userId,
        subjects: subjectDefs.map((s) => ({ id: s.id, slug: (s as any).slug })),
      });
    }

    // 3. Generate a LearningPlan for each subject (fire sequentially to avoid overload)
    let firstSubjectId: string | null = null;
    for (const subj of subjectDefs) {
      try {
        await generateLearningPlan(userId, subj.id, {
          examDate: examDate ?? undefined,
          weeklyGoal: studyDaysPerWeek,
        });
        if (!firstSubjectId) firstSubjectId = subj.id;
      } catch (planErr) {
        // Non-fatal: log and continue. Student can still use the app.
        logger.warn('generateLearningPlan failed for subject', {
          className: 'GeneratePlanAPI',
          methodName: 'POST',
          studentId: userId,
          subjectId: subj.id,
          error: String(planErr),
        });
      }
    }

    if (firstSubjectId) {
      void emitServerAnalyticsEvent(
        {
          eventType: ANALYTICS_EVENTS.STUDENT.LEARNING_PATH_GENERATED,
          userId,
          courseId: firstSubjectId,
          metadata: {
            subjectCount: subjectDefs.length,
            studyDaysPerWeek,
            belowMinimumHours,
          },
        },
        'student.onboarding.generate-plan',
      );
    }

    // 4. Check whether the first subject already has diagnostic questions available.
    // This lets the client decide whether to redirect to the diagnostic immediately
    // or show a "Vidya is preparing" waiting screen.
    // Notification registration is intentionally omitted here -- it is strictly
    // user-initiated via POST /api/student/diagnostic/notify-ready.
    let diagnosticReady = false;
    if (firstSubjectId) {
      try {
        const topicIds = await prisma.topicDef
          .findMany({
            where: {
              chapter: { subjectId: firstSubjectId, lifecycle: 'active' },
              lifecycle: 'active',
            },
            select: { id: true },
          })
          .then((rows) => rows.map((r) => r.id));

        if (topicIds.length > 0) {
          const qCount = await prisma.question.count({
            where: { status: 'ACTIVE', topicId: { in: topicIds } },
          });
          if (qCount === 0) {
            const gqCount = await prisma.generatedQuestion.count({
              where: {
                test: {
                  lifecycle: 'active',
                  topic: {
                    lifecycle: 'active',
                    chapter: { lifecycle: 'active', subjectId: firstSubjectId },
                  },
                },
              },
            });
            diagnosticReady = gqCount > 0;
          } else {
            diagnosticReady = true;
          }
        }
      } catch (readinessErr) {
        // Non-fatal: default to false -- client will show waiting screen
        logger.warn('[generate-plan] diagnosticReady check failed', {
          className: 'GeneratePlanAPI',
          methodName: 'POST',
          studentId: userId,
          firstSubjectId,
          error: String(readinessErr),
        });
      }
    }

    const res = NextResponse.json({ ok: true, firstSubjectId, diagnosticReady, belowMinimumHours, weeklyMinutes });
    logger.logAPI(req, res, { className: 'GeneratePlanAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('generate-plan error', {
      className: 'GeneratePlanAPI',
      methodName: 'POST',
      error: err,
    });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
