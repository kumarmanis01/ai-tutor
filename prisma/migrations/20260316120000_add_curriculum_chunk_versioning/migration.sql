-- This migration is not transactional
ALTER TABLE "CurriculumChunk" ADD COLUMN IF NOT EXISTS "contentHash"  TEXT;
ALTER TABLE "CurriculumChunk" ADD COLUMN IF NOT EXISTS "version"      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CurriculumChunk" ADD COLUMN IF NOT EXISTS "supersededBy" TEXT;
CREATE INDEX IF NOT EXISTS "CurriculumChunk_contentHash_idx" ON "CurriculumChunk"("contentHash");

CREATE TABLE IF NOT EXISTS "IngestRunLog" (
  "id"                  TEXT NOT NULL,
  "runAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileSource"          TEXT,
  "board"               TEXT,
  "subjectId"           TEXT,
  "chunksCreated"       INTEGER NOT NULL DEFAULT 0,
  "chunksUpdated"       INTEGER NOT NULL DEFAULT 0,
  "embeddingsGenerated" INTEGER NOT NULL DEFAULT 0,
  "errors"              INTEGER NOT NULL DEFAULT 0,
  "durationMs"          INTEGER,
  "errorDetails"        JSONB,
  CONSTRAINT "IngestRunLog_pkey" PRIMARY KEY ("id")
);
