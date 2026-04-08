import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

let _openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

/**
 * Get embedding vector for a text string.
 * Model: text-embedding-3-small (1536 dimensions).
 * Returns number[] or null on any error. Never throws.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!process.env.OPENAI_API_KEY) return null
    const input = text.slice(0, 8000)
    const response = await getClient().embeddings.create({
      model: 'text-embedding-3-small',
      input,
    })
    const embedding = response.data?.[0]?.embedding
    if (!embedding || !Array.isArray(embedding)) return null
    // Fire-and-forget analytics event for embedding call
    try {
      const inputTokensEstimate = Math.max(1, Math.ceil(input.length / 4))
      await prisma.analyticsEvent.create({
        data: {
          eventType: 'ai_call',
          userId: null,
          courseId: null,
          lessonIdx: null,
          metadata: {
            model: 'text-embedding-3-small',
            call_type: 'embed',
            input_tokens: inputTokensEstimate,
            output_tokens: Array.isArray(embedding) ? embedding.length : null,
            cost_usd: 0,
            cache_hit: false,
          },
        },
      })
    } catch (e) {
      logger.warn('analyticsEvent.embed.create.failed', { error: String((e as any)?.message ?? e) })
    }
    return embedding
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[embeddings] getEmbedding failed:', err)
    return null
  }
}

/**
 * Batch embed multiple texts.
 * Processes in chunks of batchSize (default 20) to respect rate limits.
 * Returns array of same length as input -- null entries for failed rows.
 * Never throws.
 */
export async function getEmbeddingsBatch(
  texts: string[],
  batchSize = 20,
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    try {
      if (!process.env.OPENAI_API_KEY) {
        results.push(...batch.map(() => null))
      } else {
        const inputs = batch.map((t) => t.slice(0, 8000))
        const response = await getClient().embeddings.create({
          model: 'text-embedding-3-small',
          input: inputs,
        })
        const batchEmbeddings = response.data.map((d) => d.embedding ?? null)
        // Ensure result length matches inputs length even if the provider
        // returned fewer embeddings than requested (some mocks do this).
        if (batchEmbeddings.length < inputs.length) {
          const padded = inputs.map((_, idx) => (batchEmbeddings[idx] ?? null))
          results.push(...padded)
        } else {
          results.push(...batchEmbeddings)
        }
        // Analytics per batch (fire-and-forget)
        try {
          const totalInputChars = inputs.reduce((s, it) => s + (it?.length ?? 0), 0)
          const inputTokensEstimate = Math.max(1, Math.ceil(totalInputChars / 4))
          const totalOutputTokens = batchEmbeddings.reduce((s, e) => s + (Array.isArray(e) ? e.length : 0), 0)
          await prisma.analyticsEvent.create({
            data: {
              eventType: 'ai_call',
              userId: null,
              courseId: null,
              lessonIdx: null,
              metadata: {
                model: 'text-embedding-3-small',
                call_type: 'embed',
                input_tokens: inputTokensEstimate,
                output_tokens: totalOutputTokens,
                cost_usd: 0,
                cache_hit: false,
                batch_size: inputs.length,
              },
            },
          })
        } catch (e) {
          logger.warn('analyticsEvent.embed.batch.create.failed', { error: String((e as any)?.message ?? e) })
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[embeddings] batch ${i}-${i + batchSize} failed:`, err)
      results.push(...batch.map(() => null))
    }
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return results
}

