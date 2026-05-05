/**
 * FILE OBJECTIVE:
 * - POST /api/student/learning-plan/adjust
 * - Detects whether the student's learning plan is stale or the student is behind
 *   their weekly target and triggers a non-blocking regeneration if so.
 * - Satisfies F-STU-003 AC-05: plan auto-adjusts weekly based on actual progress.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/learning-plan/adjust/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | staff-engineer | created -- F-STU-003 AC-05 weekly auto-adjust
 * - 2026-05-04T00:00:00Z | copilot | add mid-week behind check and guarded regeneration dedup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enqueueLearningPlanRegeneration } from '@/lib/ai/learningPlanRegeneration';

export const dynamic = 'force-dynamic';

// Re-generate plan when it is older than this threshold. Matches a weekly cadence.
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Determines whether the student is behind plan for the current week.
 * Behind = fewer than half the expected weekly concepts completed so far this week.
 */
async function isStudentBehind(planId: string, weeklyGoal: number, currentWeek: number): Promise<boolean> {
  const dayOfWeek = new Date().getDay();
  const isMidWeekOrLater = dayOfWeek >= 3;
  if (!isMidWeekOrLater) {
    return false;
  }

  // Only apply the behind-target check on Wednesday or later (day >= 3).
  // Early in the week a student simply hasn't had time to reach mid-week pace.
  const dayOfWeek = new Date().getDay(); // 0 = Sun, 3 = Wed, 6 = Sat
  const isPastMidWeek = dayOfWeek >= 3;
  if (!isPastMidWeek) return false;

  const completedThisWeek = await prisma.learningPlanItem.count({
    where: { planId, weekNumber: currentWeek, status: 'COMPLETED' },
  });
  const expectedByMidWeek = Math.ceil(weeklyGoal / 2);
  return completedThisWeek < expectedByMidWeek;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'LearningPlanAdjustAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    // Load all plans for the student.
    const plans = await prisma.learningPlan.findMany({
      where: { studentId: userId },
      select: { id: true, subjectId: true, weeklyGoal: true, examDate: true, generatedAt: true },
    });

    if (plans.length === 0) {
      const res = NextResponse.json({ adjusted: false, reason: 'no_plan' });
      logger.logAPI(req, res, { className: 'LearningPlanAdjustAPI', methodName: 'POST' }, start);
      return res;
    }

    // Determine current week number from the student's first structured session.
    const firstSession = await prisma.structuredSession.findFirst({
      where: { studentId: userId },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    });
    const daysSinceFirst = firstSession
      ? Math.floor((Date.now() - firstSession.startedAt.getTime()) / 86_400_000)
      : 0;
    const currentWeek = Math.max(1, Math.ceil((daysSinceFirst + 1) / 7));

    const now = Date.now();
    const adjustedSubjects: string[] = [];

    for (const plan of plans) {
      const ageMs = now - plan.generatedAt.getTime();
      const isStale = ageMs > STALE_THRESHOLD_MS;
      const behind = isStale ? true : await isStudentBehind(plan.id, plan.weeklyGoal, currentWeek);

      if (!isStale && !behind) continue;

      const reason = isStale ? 'stale' : 'behind';
      logger.info('[learning-plan/adjust] regenerating plan', {
        className: 'LearningPlanAdjustAPI',
        methodName: 'POST',
        userId,
        subjectId: plan.subjectId,
        reason,
        planAgeMs: ageMs,
      });

      // Fire-and-forget: regeneration is non-blocking so the student's request returns fast.
      const queued = await enqueueLearningPlanRegeneration({
        studentId: userId,
        subjectId: plan.subjectId,
        examDate: plan.examDate ?? undefined,
        weeklyGoal: plan.weeklyGoal,
        routeName: 'LearningPlanAdjustAPI',
        methodName: 'POST',
      });

      if (!queued) {
        continue;
      }

      adjustedSubjects.push(plan.subjectId);
    }

    const res = NextResponse.json({
      adjusted: adjustedSubjects.length > 0,
      subjectsQueued: adjustedSubjects.length,
    });
    logger.logAPI(req, res, { className: 'LearningPlanAdjustAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('[learning-plan/adjust] error', {
      className: 'LearningPlanAdjustAPI',
      methodName: 'POST',
      userId,
      error: String((err as Error)?.message ?? err),
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'LearningPlanAdjustAPI', methodName: 'POST' }, start);
    return res;
  }
}
