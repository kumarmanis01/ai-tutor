/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch questions/tests for a given topic.
 * - Used by cascading dropdown filters and content display.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/questions/for-topic/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-03 | claude  | created for cascading filters
 * - 2026-02-07 | copilot | added force-dynamic to prevent static render error
 * - 2026-05-18 | claude  | add Redis cache (TTL 300 s) + take:20 pagination
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_TTL = 300; // 5 minutes

/** Cache key for a topic's approved tests list. */
export function questionsForTopicCacheKey(topicId: string, difficulty: string | null, language: string | null): string {
  return `questions:for-topic:v1:${topicId}:${difficulty ?? 'all'}:${language ?? 'all'}`;
}

/**
 * GET /api/questions/for-topic?topicId=xxx&difficulty=easy&language=en
 *
 * Returns approved tests/questions for the given topic, filtered by difficulty and language.
 *
 * Query params:
 *   - topicId (required): Topic ID
 *   - difficulty (optional): Difficulty level (easy, medium, hard)
 *   - language (optional): Language code (en, hi)
 *
 * Response: { tests: [{ id, title, difficulty, language, version, questionCount }] }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get('topicId');
    const difficulty = searchParams.get('difficulty');
    const language = searchParams.get('language');

    if (!topicId) {
      return NextResponse.json(
        { error: 'topicId is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      topicId,
      lifecycle: 'active',
      status: 'approved',
    };

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (language) {
      where.language = language;
    }

    const cacheKey = questionsForTopicCacheKey(topicId, difficulty, language);
    const cached = await cacheGet<{ tests: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const tests = await prisma.generatedTest.findMany({
      where,
      orderBy: [
        { difficulty: 'asc' },
        { language: 'asc' },
        { version: 'desc' },
      ],
      take: 20,
      select: {
        id: true,
        title: true,
        difficulty: true,
        language: true,
        version: true,
        topicId: true,
        createdAt: true,
        _count: {
          select: { questions: true },
        },
      },
    });

    // Transform to include question count
    const result = tests.map((t) => ({
      id: t.id,
      title: t.title,
      difficulty: t.difficulty,
      language: t.language,
      version: t.version,
      topicId: t.topicId,
      questionCount: t._count.questions,
      createdAt: t.createdAt,
    }));

    const body = { tests: result };
    await cacheSet(cacheKey, body, CACHE_TTL);
    return NextResponse.json(body);
  } catch (err) {
    logger.error('/api/questions/for-topic error', { err });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
