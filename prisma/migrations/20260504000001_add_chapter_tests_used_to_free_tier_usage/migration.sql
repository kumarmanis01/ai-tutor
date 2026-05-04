-- F-STU-040 AC-01: Add chapterTestsUsed to FreeTierUsage
-- Free-tier students are capped at 1 chapter test per subject per month.
-- This column tracks how many chapter tests have been started in the current period.
-- Additive-only migration -- no data destroyed.

ALTER TABLE "FreeTierUsage" ADD COLUMN "chapterTestsUsed" INTEGER NOT NULL DEFAULT 0;
