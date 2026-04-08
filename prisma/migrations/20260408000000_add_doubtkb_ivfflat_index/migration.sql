-- Migration: add_doubtkb_ivfflat_index
-- Purpose: Add an ivfflat index for DoubtKb.embedding to improve large-scale vector lookups.
-- NOTE: Tune the "lists" parameter to your dataset size (e.g., 100-200 for millions of vectors).

CREATE INDEX IF NOT EXISTS "DoubtKb_embedding_ivfflat_idx"
ON "DoubtKb" USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- It's recommended to run: ANALYZE "DoubtKb"; and to adjust the ivfflat "lists" value
-- depending on data size. For production, test probe counts via: SET pgvector.ivfflat.probes = <n>;
