-- Migration: add_doubt_kb_vector (T26)
-- Additive: extends DoubtKb with subjectId-scoped pgvector fields.
-- Existing rows are preserved; old columns (studentId, sessionId, question, answer) kept.

-- Make conceptId nullable (was NOT NULL)
ALTER TABLE "DoubtKb" ALTER COLUMN "conceptId" DROP NOT NULL;

-- Add new columns
ALTER TABLE "DoubtKb"
  ADD COLUMN IF NOT EXISTS "subjectId"          TEXT,
  ADD COLUMN IF NOT EXISTS "questionText"        TEXT,
  ADD COLUMN IF NOT EXISTS "answerText"          TEXT,
  ADD COLUMN IF NOT EXISTS "embedding"           vector(1536),
  ADD COLUMN IF NOT EXISTS "timesServed"         INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "alternatePhrasings"  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- New subjectId index
CREATE INDEX IF NOT EXISTS "DoubtKb_subjectId_idx" ON "DoubtKb"("subjectId");
