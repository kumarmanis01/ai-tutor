-- Compound index for hot PRACTICE/TEST question serving path
-- Covers: WHERE topicId = $1 AND difficulty = $2 AND status = 'ACTIVE'
CREATE INDEX IF NOT EXISTS "Question_topicId_difficulty_status_idx"
  ON "Question"("topicId", "difficulty", "status");

-- Compound index for GeneratedTest assembly scan (assembleWorker + idempotency check)
-- Covers: WHERE topicId = $1 AND status = $2 AND difficulty = $3
CREATE INDEX IF NOT EXISTS "GeneratedTest_topicId_status_difficulty_idx"
  ON "GeneratedTest"("topicId", "status", "difficulty");

-- Index for GeneratedQuestion promotion join (testId FK scan)
CREATE INDEX IF NOT EXISTS "GeneratedQuestion_testId_idx"
  ON "GeneratedQuestion"("testId");
