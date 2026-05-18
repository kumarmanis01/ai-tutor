export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Single-round-trip endpoint that returns the latest approved note (with full contentJson)
 *   for a topic. Eliminates the two-step waterfall in the student Notes component
 *   (for-topic → topic-note/[id]).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/notes/topic-content/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-18 | claude | created to replace client-side waterfall
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_TTL = 900; // 15 minutes

/** Cache key for a topic's latest note content. */
export function topicContentCacheKey(topicId: string, language: string | null): string {
  return `notes:topic-content:v1:${topicId}:${language ?? 'en'}`;
}

/**
 * GET /api/notes/topic-content?topicId=xxx&language=en
 *
 * Returns the latest approved TopicNote for the topic including full contentJson.
 * Prefers English; falls back to first available language if English not found.
 *
 * Query params:
 *   - topicId (required)
 *   - language (optional, default "en")
 *
 * Response: { note: { id, title, contentJson, language, version, topicId } | null }
 */
export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topicId');
  const language = searchParams.get('language') ?? 'en';

  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
  }

  try {
    const cacheKey = topicContentCacheKey(topicId, language);
    const cached = await cacheGet<{ note: unknown }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Try preferred language first, then fall back to any approved note for the topic
    let note = await prisma.topicNote.findFirst({
      where: { topicId, lifecycle: 'active', status: 'approved', language },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        title: true,
        contentJson: true,
        language: true,
        version: true,
        topicId: true,
      },
    });

    if (!note && language !== 'en') {
      note = await prisma.topicNote.findFirst({
        where: { topicId, lifecycle: 'active', status: 'approved' },
        orderBy: [{ language: 'asc' }, { version: 'desc' }],
        select: {
          id: true,
          title: true,
          contentJson: true,
          language: true,
          version: true,
          topicId: true,
        },
      });
    }

    const body = { note: note ?? null };
    if (note) await cacheSet(cacheKey, body, CACHE_TTL);
    return NextResponse.json(body);
  } catch (err) {
    logger.error('NotesTopicContentAPI.error', { topicId, error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
