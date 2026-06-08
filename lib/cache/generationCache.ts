/**
 * FILE OBJECTIVE:
 * - Redis-backed cache for LLM-generated content with 7-day TTL.
 *   Keyed by board/grade/subject/topic/contentType/difficulty so identical
 *   context requests skip the OpenAI call entirely.
 *
 * EDIT LOG:
 * - 2026-06-08T13:00:00Z | claude | initial implementation for task S1-2
 */

import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export type GenerationCacheKey = {
  board: string;
  grade: string;
  subject: string;
  topicSlug: string;
  contentType: string;
  difficulty: string;
};

const TTL_SECONDS = 604800; // 7 days

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildGenerationCacheKey(key: GenerationCacheKey): string {
  return [
    'gen',
    slugify(key.board),
    slugify(key.grade),
    slugify(key.subject),
    slugify(key.topicSlug),
    slugify(key.contentType),
    slugify(key.difficulty),
  ].join(':');
}

export async function getGeneratedContent(key: GenerationCacheKey): Promise<string | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get(buildGenerationCacheKey(key));
    return raw ?? null;
  } catch (e) {
    logger.error('generationCache.get failed', { className: 'generationCache', methodName: 'getGeneratedContent', error: String(e) });
    return null;
  }
}

export async function setGeneratedContent(key: GenerationCacheKey, value: string): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(buildGenerationCacheKey(key), value, 'EX', TTL_SECONDS);
  } catch (e) {
    logger.error('generationCache.set failed', { className: 'generationCache', methodName: 'setGeneratedContent', error: String(e) });
  }
}
