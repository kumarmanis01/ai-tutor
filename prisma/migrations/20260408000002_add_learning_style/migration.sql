-- AC-06 (F-STU-004): Add learningStyle to User for prompt personalisation.
-- Self-reported learning style: 'visual' | 'verbal' | 'practice' | 'mixed'.
-- Additive only -- no existing data is touched.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "learningStyle" TEXT;
