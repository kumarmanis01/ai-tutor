/**
 * POST /api/student/onboarding/generate-plan
 *
 * Saves examDate + studyDaysPerWeek to StudentLearningProfile then kicks off
 * LearningPlan generation for every subject the student has enrolled in.
 * Returns { ok: true, firstSubjectId } on success.
 *
 * Body: { examDate?: string | null, studyDaysPerWeek: number }
 * Auth: session required -- 401 if missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { generateLearningPlan } from '@/lib/ai/learningPlan';

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

    // Resolve subject IDs filtered by student's exact grade + board.
    // Without the grade+board filter the query would return SubjectDef rows for
    // the wrong grade (e.g. Grade 1 English for a Grade 6 student) because the
    // same slug exists for every grade.
    const subjectDefs =
      normalisedSlugs.length > 0 && studentGrade && studentBoard
        ? await prisma.subjectDef.findMany({
            where: {
              slug: { in: normalisedSlugs },
              lifecycle: 'active',
              class: {
                grade: studentGrade,
                board: { slug: { equals: studentBoard, mode: 'insensitive' } },
              },
            },
            select: { id: true, slug: true },
          })
        : [];

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

    const res = NextResponse.json({ ok: true, firstSubjectId });
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
