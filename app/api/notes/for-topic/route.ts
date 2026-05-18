/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch notes for a given topic.
 * - Used by cascading dropdown filters and content display.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/notes/for-topic/route.spec.ts
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

/** Cache key for a topic's approved notes list. */
export function notesForTopicCacheKey(topicId: string, language: string | null): string {
  return `notes:for-topic:v1:${topicId}:${language ?? 'all'}`;
}

/**
 * GET /api/notes/for-topic?topicId=xxx&language=en
 *
 * Returns approved notes for the given topic, optionally filtered by language.
 *
 * Query params:
 *   - topicId (required): Topic ID
 *   - language (optional): Language code (en, hi)
 *
 * Response: { notes: [{ id, title, language, version, topicId }] }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get('topicId');
    const language = searchParams.get('language');

    if (!topicId) {
      return NextResponse.json(
        { error: 'topicId is required' },
        { status: 400 }
      );
    }

    const cacheKey = notesForTopicCacheKey(topicId, language);
    const cached = await cacheGet<{ notes: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const where: Record<string, unknown> = {
      topicId,
      lifecycle: 'active',
      status: 'approved',
    };

    if (language) {
      where.language = language;
    }

    const notes = await prisma.topicNote.findMany({
      where,
      orderBy: [
        { language: 'asc' },
        { version: 'desc' },
      ],
      take: 20,
      select: {
        id: true,
        title: true,
        language: true,
        version: true,
        topicId: true,
        createdAt: true,
      },
    });

    const body = { notes };
    await cacheSet(cacheKey, body, CACHE_TTL);
    return NextResponse.json(body);
  } catch (err) {
    logger.error('/api/notes/for-topic error', { err });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
