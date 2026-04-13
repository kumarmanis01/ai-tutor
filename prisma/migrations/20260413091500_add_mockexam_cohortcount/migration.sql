-- Add cohortCount to MockExamAttempt for storing cohort sizes used in percentile calculations
ALTER TABLE "MockExamAttempt" ADD COLUMN IF NOT EXISTS "cohortCount" INTEGER;
