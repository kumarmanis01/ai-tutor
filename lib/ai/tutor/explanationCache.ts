import { getRedis } from '@/lib/redis'

// Cache key pattern: cache:exp:{conceptId}:{lang}:{modality}
// TTL: 7 days
const TTL_SECONDS = 604800

export type ExplanationModality = 'text' | 'analogy' | 'worked_example' | 'visual_description'
export type ExplanationLang = 'en' | 'hi'

export interface CachedExplanation {
  conceptId: string
  lang: ExplanationLang
  modality: ExplanationModality
  content: string
  cachedAt: string
}

function buildKey(conceptId: string, lang: string, modality: string): string {
  return `cache:exp:${conceptId}:${lang}:${modality}`
}

export async function getCachedExplanation(
  conceptId: string,
  lang: ExplanationLang,
  modality: ExplanationModality,
): Promise<CachedExplanation | null> {
  try {
    const redis = getRedis()
    if (!redis) return null
    const key = buildKey(conceptId, lang, modality)
    const raw = await redis.get(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedExplanation
    if (!parsed?.conceptId || !parsed?.lang || !parsed?.modality || typeof parsed?.content !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export async function setCachedExplanation(
  conceptId: string,
  lang: ExplanationLang,
  modality: ExplanationModality,
  content: string,
): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const key = buildKey(conceptId, lang, modality)
    const payload: CachedExplanation = {
      conceptId,
      lang,
      modality,
      content,
      cachedAt: new Date().toISOString(),
    }
    await redis.setex(key, TTL_SECONDS, JSON.stringify(payload))
  } catch {
    // silent no-op
  }
}

export async function invalidateExplanation(
  conceptId: string,
  lang: ExplanationLang,
  modality: ExplanationModality,
): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const key = buildKey(conceptId, lang, modality)
    await redis.del(key)
  } catch {
    // silent no-op
  }
}

export const _explanationCacheInternals = { buildKey, TTL_SECONDS }

