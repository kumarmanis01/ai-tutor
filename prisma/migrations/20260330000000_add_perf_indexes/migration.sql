-- Migration: add_perf_indexes
-- Additive only. No columns dropped or renamed.
-- Purpose: reduce Neon CU cost by eliminating sequential scans on hot query paths.
-- Note: CONCURRENTLY removed -- Prisma wraps migrations in a transaction and
-- CONCURRENTLY is forbidden inside a transaction block (PG error 25001).
-- Table locks from plain CREATE INDEX are milliseconds on startup-scale data.

-- 1. LearningSession: dashboard weekly-activity strip queries filter by studentId + startedAt range
CREATE INDEX IF NOT EXISTS "LearningSession_studentId_startedAt_idx"
  ON "LearningSession" ("studentId", "startedAt" DESC);

-- 2. LearningPlanItem: recently-completed fetch uses planId + status + completedAt DESC
CREATE INDEX IF NOT EXISTS "LearningPlanItem_planId_status_completedAt_idx"
  ON "LearningPlanItem" ("planId", "status", "completedAt" DESC);

-- 3. StructuredSession: weekly-sessions query filters studentId + startedAt range
CREATE INDEX IF NOT EXISTS "StructuredSession_studentId_startedAt_idx"
  ON "StructuredSession" ("studentId", "startedAt" DESC);

-- 4. StudentTopicProgress: upcoming-topics filter uses studentId + mastery
CREATE INDEX IF NOT EXISTS "StudentTopicProgress_studentId_mastery_idx"
  ON "StudentTopicProgress" ("studentId", "mastery");

-- 5. pgvector HNSW indexes for embedding similarity search.
--    Requires pgvector extension (already enabled on this Neon project).
--    ef_construction=64 / m=16 is conservative -- safe for cold Neon instances.

CREATE INDEX IF NOT EXISTS "CurriculumChunk_embedding_hnsw_idx"
  ON "CurriculumChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "DoubtKb_embedding_hnsw_idx"
  ON "DoubtKb" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
