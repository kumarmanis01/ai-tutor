export const dynamic = 'force-dynamic';

/**
 * POST /api/quiz/on-demand
 *   Create an on-demand quiz request. Returns { requestId } immediately.
 *   The quiz is generated asynchronously by the BullMQ worker.
 *
 * GET /api/quiz/on-demand?requestId=xxx
 *   Poll the status and result of a previously created request.
 *   Returns { status, resultJson?, error? }.
 *
 * Auth: session required for both methods.
 * Input validation: zod.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { createQuizRequest } from '@/lib/quiz/onDemandQuizService';
import { SessionUser } from '@/lib/types';
import { getOnDemandQuizQueue } from '@/worker/jobs/onDemandQuizJob';

// ── Input schema ──────────────────────────────────────────────────────────────

const PostBodySchema = z.object({
  scope: z.enum(['topic', 'chapter', 'subject', 'studied_so_far']),
  topicId: z.string().cuid().optional(),
  chapterId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  language: z.enum(['en', 'hi']).optional().default('en'),
  questionCount: z.number().int().min(5).max(20).optional().default(10),
});

// ── POST: create quiz request ─────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = (session.user as SessionUser)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Scope-specific ID requirements
  if (data.scope === 'topic' && !data.topicId) {
    return NextResponse.json({ error: 'topicId required for scope=topic' }, { status: 400 });
  }
  if (data.scope === 'chapter' && !data.chapterId) {
    return NextResponse.json({ error: 'chapterId required for scope=chapter' }, { status: 400 });
  }
  if (data.scope === 'subject' && !data.subjectId) {
    return NextResponse.json({ error: 'subjectId required for scope=subject' }, { status: 400 });
  }

  try {
    const { requestId } = await createQuizRequest({
      userId,
      scope: data.scope,
      topicId: data.topicId,
      chapterId: data.chapterId,
      subjectId: data.subjectId,
      difficulty: data.difficulty,
      language: data.language,
      questionCount: data.questionCount,
    });

    // Enqueue background job
    const queue = getOnDemandQuizQueue();
    await queue.add(
      'on_demand_quiz',
      { requestId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    logger.info('[POST /api/quiz/on-demand] request created', {
      event: 'quiz_request_created',
      context: { userId, requestId, scope: data.scope, difficulty: data.difficulty },
    });

    return NextResponse.json({ requestId }, { status: 202 });
  } catch (err) {
    logger.error('[POST /api/quiz/on-demand] error', {
      event: 'quiz_request_error',
      context: { userId, error: String(err) },
    });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}

// ── GET: poll quiz result ─────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = (session.user as SessionUser)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  if (!requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
  }

  try {
    const record = await prisma.onDemandQuizRequest.findUnique({
      where: { id: requestId },
      select: {
        userId: true,
        status: true,
        scope: true,
        difficulty: true,
        language: true,
        questionCount: true,
        resultJson: true,
        error: true,
        requestedAt: true,
        completedAt: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Ownership check -- never serve another user's quiz
    if (record.userId !== userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      status: record.status,
      scope: record.scope,
      difficulty: record.difficulty,
      language: record.language,
      questionCount: record.questionCount,
      quiz: record.resultJson ?? null,
      error: record.error ?? null,
      requestedAt: record.requestedAt,
      completedAt: record.completedAt ?? null,
    });
  } catch (err) {
    logger.error('[GET /api/quiz/on-demand] error', {
      event: 'quiz_poll_error',
      context: { userId, requestId, error: String(err) },
    });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
