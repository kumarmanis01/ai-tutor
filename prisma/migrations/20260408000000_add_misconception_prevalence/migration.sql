-- Migration: add prevalenceRate to Misconception
-- Adds an additive nullable=NO column with default 0.0

ALTER TABLE "Misconception"
ADD COLUMN IF NOT EXISTS "prevalenceRate" double precision NOT NULL DEFAULT 0;

-- Ensure index exists for subject/concept queries (already present in earlier migrations)
-- No further actions required.
