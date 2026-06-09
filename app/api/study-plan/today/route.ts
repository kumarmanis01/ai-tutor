/**
 * FILE OBJECTIVE:
 * - GET /api/study-plan/today: returns the authenticated student's 3-topic daily
 *   study plan, cache-first via Redis with live-computation fallback.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getCachedDailyPlan, computeDailyPlan, cacheDailyPlan } from '@/lib/studyPlan/dailyPlan';

export async function GET() {
  // Auth guard -- session check before any business logic
  let userId: string;
  try {
    const session = await getServerSessionForHandlers();
    if (!session || !(session as any)?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    userId = (session as any).user.id as string;
  } catch (e) {
    logger.error('studyPlan.today.session.failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Cache-first: Redis hit returns immediately
  try {
    const cached = await getCachedDailyPlan(userId);
    if (cached) {
      return NextResponse.json({
        plan: cached.topics,
        generatedAt: cached.generatedAt,
        cached: true,
      });
    }
  } catch (e) {
    logger.error('studyPlan.today.cache.get.failed', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Live fallback: compute and populate cache in the background
  try {
    const plan = await computeDailyPlan(userId);
    // Fire-and-forget cache population
    cacheDailyPlan(userId, plan).catch((e: unknown) => {
      logger.error('studyPlan.today.cache.populate.failed', {
        userId,
        error: e instanceof Error ? (e as Error).message : String(e),
      });
    });
    return NextResponse.json({
      plan: plan.topics,
      generatedAt: plan.generatedAt,
      cached: false,
    });
  } catch (e) {
    logger.error('studyPlan.today.compute.failed', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'failed_to_compute_plan' }, { status: 500 });
  }
}
