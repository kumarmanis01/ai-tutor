/**
 * FILE OBJECTIVE:
 * - Persist recommendation scoring decisions for admin observability.
 * - Fire-and-forget: never blocks or fails the recommendation pipeline.
 * - Gated by ENABLE_RECOMMENDATION_TRACE feature flag.
 *
 * EDIT LOG:
 * - 2026-03-03 | claude | created recommendation trace persistence
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ENGINE_VERSION = '2.0.0';

export interface RecommendationTraceInput {
  studentId: string;
  entityType: string;
  entityId: string;
  score: number;
  signals: Record<string, unknown>;
}

export function isTraceEnabled(): boolean {
  const flag = process.env.ENABLE_RECOMMENDATION_TRACE;
  return flag === '1' || flag === 'true';
}

/**
 * Persist a single recommendation trace. Fire-and-forget.
 */
export async function persistRecommendationTrace(trace: RecommendationTraceInput): Promise<void> {
  if (!isTraceEnabled()) return;

  try {
    await prisma.recommendationTrace.create({
      data: {
        studentId: trace.studentId,
        entityType: trace.entityType,
        entityId: trace.entityId,
        score: trace.score,
        signals: trace.signals as Prisma.JsonObject,
        engineVersion: ENGINE_VERSION,
      },
    });
  } catch (error) {
    logger.warn('[RECOMMENDATION_TRACE_ERROR]', {
      error: error instanceof Error ? error.message : String(error),
      entityId: trace.entityId,
    });
  }
}

/**
 * Persist a batch of recommendation traces. Fire-and-forget.
 */
export async function persistRecommendationTraces(traces: RecommendationTraceInput[]): Promise<void> {
  if (!isTraceEnabled() || traces.length === 0) return;

  try {
    await prisma.recommendationTrace.createMany({
      data: traces.map(t => ({
        studentId: t.studentId,
        entityType: t.entityType,
        entityId: t.entityId,
        score: t.score,
        signals: t.signals as Prisma.JsonObject,
        engineVersion: ENGINE_VERSION,
      })),
    });
    logger.debug('[RECOMMENDATION_TRACE]', { count: traces.length, studentId: traces[0].studentId });
  } catch (error) {
    logger.warn('[RECOMMENDATION_TRACE_ERROR]', {
      error: error instanceof Error ? error.message : String(error),
      count: traces.length,
    });
  }
}
