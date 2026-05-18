/**
 * FILE OBJECTIVE:
 * - Single-round-trip endpoint that returns the latest approved note (with full contentJson)
 *   for a topic. Eliminates the two-step waterfall in the student Notes component
 *   (for-topic -> topic-note/[id]).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/notes/topic-content/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18 | claude | created to replace client-side waterfall (single-fetch)
 * - 2026-05-18 | claude | fix: normalize language before Prisma enum query; always fall back to any language
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/cache';
import { LanguageCode } from '@prisma/client';

const CACHE_TTL = 900; // 15 minutes
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set<string>(['en', 'hi']);

/** Normalize raw query param to a supported LanguageCode; defaults to 'en'. */
function normalizeLanguage(raw: string | null): LanguageCode {
  const lower = (raw ?? '').toLowerCase().trim();
  return (SUPPORTED_LANGUAGES.has(lower) ? lower : 'en') as LanguageCode;
}

/** Cache key for a topic's latest note content. */
export function topicContentCacheKey(topicId: string, language: string | null): string {
  return `notes:topic-content:v1:${topicId}:${language ?? 'en'}`;
}

/**
 * GET /api/notes/topic-content?topicId=xxx&language=en
 *
 * Returns the latest approved TopicNote for the topic including full contentJson.
 * Prefers the requested language; falls back to any approved language if not found.
 *
 * Query params:
 *   - topicId (required)
 *   - language (optional, default "en"; unsupported codes silently coerced to "en")
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
  const language = normalizeLanguage(searchParams.get('language'));

  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
  }

  try {
    const cacheKey = topicContentCacheKey(topicId, language);
    const cached = await cacheGet<{ note: unknown }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const noteSelect = {
      id: true,
      title: true,
      contentJson: true,
      language: true,
      version: true,
      topicId: true,
    } as const;

    // Try preferred language first
    let note = await prisma.topicNote.findFirst({
      where: { topicId, lifecycle: 'active', status: 'approved', language },
      orderBy: { version: 'desc' },
      select: noteSelect,
    });

    // Always fall back to any approved note -- covers topics that only have a
    // non-English note and requests without an explicit language param.
    if (!note) {
      note = await prisma.topicNote.findFirst({
        where: { topicId, lifecycle: 'active', status: 'approved' },
        orderBy: [{ language: 'asc' }, { version: 'desc' }],
        select: noteSelect,
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
