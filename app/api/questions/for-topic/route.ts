export const dynamic = 'force-dynamic'

/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch questions/tests for a given topic.
 * - Used by cascading dropdown filters and content display.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/questions/for-topic/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created for cascading filters
 * - 2026-02-07 | copilot | added force-dynamic to prevent static render error
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    const tests = await prisma.generatedTest.findMany({
      where,
      orderBy: [
        { difficulty: 'asc' },
        { language: 'asc' },
        { version: 'desc' },
      ],
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

    return NextResponse.json({ tests: result });
  } catch (err) {
    logger.error('/api/questions/for-topic error', { err });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
