/**
 * FILE OBJECTIVE:
 * - GET /api/recommendations: returns personalized recommendations for the
 *   authenticated student, cached in Redis for 15 minutes.
 * - POST /api/recommendations: accepts IMPRESSION/CLICK/DISMISS signal events
 *   and enqueues them for async processing; returns 202 immediately.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: recommendation API route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { RecommendationService } from '@/services/recommendationService';
import { getRecommendationSignalQueue } from '@/queues/recommendationSignalQueue';

export const dynamic = 'force-dynamic';

const signalSchema = z.object({
  recommendationId: z.string().min(1),
  type: z.enum(['IMPRESSION', 'CLICK', 'DISMISS']),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/recommendations
 * Returns personalized recommendations for the authenticated user.
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  const user = (session?.user as { id?: string } | undefined);
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }

  try {
    const openai = await getOpenAIClient();
    const service = new RecommendationService(prisma, redis as any, openai);
    const result = await service.getRecommendations(user.id);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=900' },
    });
  } catch (err) {
    logger.error('recommendations.get.unhandled', {
      event: 'recommendations.get.unhandled',
      context: { userId: user.id, error: String(err) },
    });
    return NextResponse.json(
      { error: 'Could not load recommendations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recommendations
 * Accepts a signal (IMPRESSION / CLICK / DISMISS) and enqueues it for async
 * persistence. Returns 202 Accepted immediately.
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const user = (session?.user as { id?: string } | undefined);
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = signalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { recommendationId, type, metadata } = parsed.data;

  try {
    const queue = getRecommendationSignalQueue();
    // Fire-and-forget: no await on the queue add for response latency
    queue
      .add('signal', {
        userId: user.id,
        recommendationId,
        type,
        metadata: metadata as Record<string, unknown> | undefined,
      })
      .catch((err) => {
        logger.error('recommendations.signal.enqueue_failed', {
          event: 'recommendations.signal.enqueue_failed',
          context: { userId: user.id, type, error: String(err) },
        });
      });
  } catch (err) {
    logger.error('recommendations.post.unhandled', {
      event: 'recommendations.post.unhandled',
      context: { userId: user.id, error: String(err) },
    });
    return NextResponse.json(
      { error: 'Could not record signal' },
      { status: 500 }
    );
  }

  return NextResponse.json({ accepted: true }, { status: 202 });
}

async function getOpenAIClient() {
  const OpenAI = (await import('openai')).default;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
