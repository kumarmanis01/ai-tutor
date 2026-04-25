import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getEmbedding } from '@/lib/ai/embeddings';

export interface RagChunk {
  chunkId: string;
  content: string;
  conceptIds: string[];
  similarityScore: number;
}

export interface RagContext {
  chunks: RagChunk[];
  chunkIds: string[];
}

const DEFAULT_TOP_N = 4;

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
  opts?: { topN?: number }
): Promise<RagContext> {
  const topN = opts?.topN ?? DEFAULT_TOP_N;

  if (!query || !query.trim() || !Array.isArray(conceptIds) || conceptIds.length === 0) {
    return { chunks: [], chunkIds: [] };
  }

  try {
    const vector = await getEmbedding(query);
    if (!vector) {
      logger.warn('rag.retrieveRelevantChunks.emptyEmbedding');
      return { chunks: [], chunkIds: [] };
    }

    // 2. Vector similarity search via pgvector
    type RawRow = {
      id: string;
      content: string | null;
      conceptIds: string[];
      similarity: number;
    };

    let rows: RawRow[] = [];
    try {
      const embeddingLiteral = `[${vector.join(',')}]`;
      rows =
        ((await prisma.$queryRawUnsafe(
          `
            SELECT id, content, "conceptIds",
                   1 - (embedding <=> $1::vector) AS similarity
            FROM "CurriculumChunk"
            WHERE "conceptIds" && $2::text[]
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> $1::vector) > 0.75
            ORDER BY similarity DESC
            LIMIT $3
          `,
          embeddingLiteral,
          conceptIds,
          topN
        )) as RawRow[]) ?? [];
    } catch (err) {
      logger.warn('rag.retrieveRelevantChunks.vectorQueryFailed', {
        error: String((err as any)?.message ?? err),
      });
      return { chunks: [], chunkIds: [] };
    }

    if (!rows.length) {
      return { chunks: [], chunkIds: [] };
    }

    // 3. Basic check -- rows already thresholded and ordered in SQL
    if (!rows.length) {
      return { chunks: [], chunkIds: [] };
    }

    const chunks: RagChunk[] = rows.map((r) => ({
      chunkId: r.id,
      content: r.content ?? '',
      conceptIds: r.conceptIds ?? [],
      similarityScore: r.similarity,
    }));

    const chunkIds = chunks.map((c) => c.chunkId);

    return { chunks, chunkIds };
  } catch (err) {
    logger.warn('rag.retrieveRelevantChunks.failed', {
      error: String((err as any)?.message ?? err),
    });
    return { chunks: [], chunkIds: [] };
  }
}
