/**
 * FILE OBJECTIVE:
 * - GET /api/concepts/[topicSlug]: returns the ordered list of pre-seeded concepts
 *   for a given topicSlug + subject + grade + board. Cached in Redis for 30 days.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for demand-pull generate flow (task S3)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { getServerSessionForHandlers } from '@/lib/session';

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days -- concepts never change without a re-seed

function buildCacheKey(board: string, grade: string, subject: string, topicSlug: string): string {
  return `concepts:${board.toLowerCase()}:${grade}:${subject.toLowerCase()}:${topicSlug}`;
}

interface RouteContext {
  params: Promise<{ topicSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  // Auth guard -- session check before any DB query
  try {
    const session = await getServerSessionForHandlers();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  } catch (e) {
    logger.error('concepts.api.session.failed', { error: String(e) });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { topicSlug } = await context.params;
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') ?? '';
  const grade = searchParams.get('grade') ?? '';
  const board = searchParams.get('board') ?? '';

  if (!subject || !grade || !board) {
    return NextResponse.json({ error: 'subject, grade, and board are required' }, { status: 400 });
  }

  // Attempt cache read first -- concepts are immutable until re-seed
  const cacheKey = buildCacheKey(board, grade, subject, topicSlug);
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached));
      }
    }
  } catch (e) {
    // Redis failure is non-fatal -- fall through to DB
    logger.error('concepts.api.cache.read.failed', { cacheKey, error: String(e) });
  }

  // DB query -- select only needed fields, ordered for display
  let concepts: { id: string; title: string; summary: string; orderIndex: number }[];
  try {
    concepts = await prisma.topicConcept.findMany({
      where: { topicSlug, subject, grade, board },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, title: true, summary: true, orderIndex: true },
    });
  } catch (e) {
    logger.error('concepts.api.db.query.failed', { topicSlug, subject, grade, board, error: String(e) });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const payload = { concepts, topicSlug };

  // Populate cache asynchronously -- never let a cache write fail the response
  try {
    const redis = getRedis();
    if (redis) {
      redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS).catch((e: unknown) => {
        logger.error('concepts.api.cache.write.failed', { cacheKey, error: String(e) });
      });
    }
  } catch (e) {
    logger.error('concepts.api.cache.write.failed', { cacheKey, error: String(e) });
  }

  return NextResponse.json(payload);
}
