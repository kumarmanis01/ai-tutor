import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import OpenAI from 'openai'

export interface RagChunk {
  chunkId: string
  content: string
  conceptIds: string[]
  similarityScore: number
}

export interface RagContext {
  chunks: RagChunk[]
  chunkIds: string[]
}

const DEFAULT_TOP_N = 4

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Retrieve top N curriculum chunks relevant to the query.
 * Returns empty RagContext (not an error) when:
 *   - no embeddings exist yet (T1 data not ready)
 *   - pgvector query fails
 * Never throws.
 *
 * @param query - Free-text query, typically conceptName + recent student message.
 * @param conceptIds - Concept IDs to filter CurriculumChunk rows by.
 * @param opts - Optional configuration (topN).
 * @returns A RagContext containing reranked chunks and their ids.
 */
export async function retrieveRelevantChunks(
  query: string,
  conceptIds: string[],
  opts?: { topN?: number },
): Promise<RagContext> {
  const topN = opts?.topN ?? DEFAULT_TOP_N

  if (!query || !query.trim() || !Array.isArray(conceptIds) || conceptIds.length === 0) {
    return { chunks: [], chunkIds: [] }
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('rag.retrieveRelevantChunks.missingApiKey')
      return { chunks: [], chunkIds: [] }
    }

    // 1. Embed query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })

    const vector = embeddingResponse.data?.[0]?.embedding
    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      logger.warn('rag.retrieveRelevantChunks.emptyEmbedding')
      return { chunks: [], chunkIds: [] }
    }

    // 2. Vector similarity search via pgvector
    type RawRow = {
      id: string
      content: string | null
      concept_ids: string[]
      similarity: number
    }

    let rows: RawRow[] = []
    try {
      // NOTE: This assumes a pgvector "vector" column named embedding exists on CurriculumChunk.
      rows =
        ((await prisma.$queryRawUnsafe(
          `
            SELECT id, content, concept_ids,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM "CurriculumChunk"
            WHERE concept_ids && $2::text[]
              AND embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $3
          `,
          vector,
          conceptIds,
          topN,
        )) as RawRow[]) ?? []
    } catch (err) {
      logger.warn('rag.retrieveRelevantChunks.vectorQueryFailed', {
        error: String((err as any)?.message ?? err),
      })
      return { chunks: [], chunkIds: [] }
    }

    if (!rows.length) {
      return { chunks: [], chunkIds: [] }
    }

    // 3. Rerank: apply similarity threshold and sort desc
    const threshold = 0.75
    const filtered = rows
      .filter((r) => typeof r.similarity === 'number' && r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN)

    if (!filtered.length) {
      return { chunks: [], chunkIds: [] }
    }

    const chunks: RagChunk[] = filtered.map((r) => ({
      chunkId: r.id,
      content: r.content ?? '',
      conceptIds: r.concept_ids ?? [],
      similarityScore: r.similarity,
    }))

    const chunkIds = chunks.map((c) => c.chunkId)

    return { chunks, chunkIds }
  } catch (err) {
    logger.warn('rag.retrieveRelevantChunks.failed', {
      error: String((err as any)?.message ?? err),
    })
    return { chunks: [], chunkIds: [] }
  }
}

