import OpenAI from 'openai'

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
 * Returns array of same length as input — null entries for failed rows.
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
        const response = await getClient().embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map((t) => t.slice(0, 8000)),
        })
        results.push(...response.data.map((d) => d.embedding ?? null))
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[embeddings] batch ${i}–${i + batchSize} failed:`, err)
      results.push(...batch.map(() => null))
    }
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return results
}

