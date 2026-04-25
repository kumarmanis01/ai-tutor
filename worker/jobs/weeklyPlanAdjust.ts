/**
 * AC-05 (F-STU-003): Weekly learning plan auto-adjust job.
 *
 * Detects students who are behind their plan (have UPCOMING items in weeks
 * earlier than the current week) and regenerates the plan to re-prioritise
 * remaining concepts starting from the current week.
 *
 * Idempotent: calling twice in the same week regenerates the same plan.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { generateLearningPlan } from '../../lib/ai/learningPlan.js';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Run the weekly plan adjustment for all active students.
 * Returns the number of plans that were regenerated.
 */
export async function weeklyPlanAdjust(): Promise<{ checked: number; adjusted: number }> {
  const now = new Date();

  const plans = await prisma.learningPlan.findMany({
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      examDate: true,
      weeklyGoal: true,
      generatedAt: true,
    },
  });

  let adjusted = 0;
  for (const plan of plans) {
    // Week 1 is the first 7 days after generatedAt.
    // currentWeek >= 2 means at least one full week has elapsed.
    const currentWeek = Math.floor((now.getTime() - plan.generatedAt.getTime()) / MS_PER_WEEK) + 1;

    if (currentWeek < 2) {
      // Plan is less than 1 week old -- skip, student is not yet behind
      continue;
    }

    // Count UPCOMING items in weeks before the current week
    const behindCount = await prisma.learningPlanItem.count({
      where: {
        planId: plan.id,
        weekNumber: { lt: currentWeek },
        status: 'UPCOMING',
      },
    });

    if (behindCount === 0) continue;

    logger.info('weeklyPlanAdjust: student behind plan', {
      event: 'weekly_plan_adjust_triggered',
      context: { studentId: plan.studentId, subjectId: plan.subjectId, behindCount, currentWeek },
    });

    try {
      await generateLearningPlan(plan.studentId, plan.subjectId, {
        examDate: plan.examDate instanceof Date ? plan.examDate : undefined,
        weeklyGoal: plan.weeklyGoal,
      });
      adjusted++;
    } catch (err) {
      logger.warn('weeklyPlanAdjust: generateLearningPlan failed', {
        event: 'weekly_plan_adjust_failed',
        context: { studentId: plan.studentId, subjectId: plan.subjectId, error: String(err) },
      });
    }
  }

  return { checked: plans.length, adjusted };
}
