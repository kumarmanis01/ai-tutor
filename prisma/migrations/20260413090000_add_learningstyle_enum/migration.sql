-- Migration: add LearningStyle enum and convert user.learningStyle column
-- NOTE: This migration assumes existing values (if any) are one of the new enum members.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learningstyle') THEN
    CREATE TYPE "LearningStyle" AS ENUM ('visual','verbal','practice','mixed');
  END IF;
END
$$;

-- Ensure the column exists (create as text if missing), then convert to enum type (nullable).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "learningStyle" text;
ALTER TABLE "User" ALTER COLUMN "learningStyle" TYPE "LearningStyle" USING ("learningStyle"::text::"LearningStyle");
-- Ensure correct quoting for the existing column name (camelCase)
ALTER TABLE "User" ALTER COLUMN "learningStyle" TYPE "LearningStyle" USING ("learningStyle"::text::"LearningStyle");

COMMIT;
