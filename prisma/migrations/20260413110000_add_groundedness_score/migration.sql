-- F-ADM-013 AC-03: Add groundednessScore to AITutorTurnLog for hallucination tracking.
-- groundednessScore = 1 - riskScore (0..1). NULL when turn was served from cache or safety-blocked.

ALTER TABLE "AITutorTurnLog"
  ADD COLUMN IF NOT EXISTS "groundednessScore" DOUBLE PRECISION;

-- Partial index: only index rows where groundednessScore is NOT NULL to keep the index small.
CREATE INDEX IF NOT EXISTS idx_aitutorturnlog_groundedness
  ON "AITutorTurnLog" ("groundednessScore")
  WHERE "groundednessScore" IS NOT NULL;
