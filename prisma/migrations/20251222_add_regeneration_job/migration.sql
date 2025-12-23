-- Migration: Add RegenerationJob model and enums for Phase 12

-- Create enum types
DO $$ BEGIN
    CREATE TYPE "RegenerationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RegenerationTargetType" AS ENUM ('LESSON', 'QUIZ', 'PROJECT', 'MODULE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS "RegenerationJob" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "suggestionId" TEXT NOT NULL,
  "targetType" RegenerationTargetType NOT NULL,
  "targetId" TEXT NOT NULL,
  "instructionJson" JSONB NOT NULL,
  "status" RegenerationJobStatus NOT NULL DEFAULT 'PENDING',
  "outputRef" JSONB,
  "errorJson" JSONB,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Ensure updatedAt is maintained via trigger if desired (optional)

-- Unique constraint for idempotency: one job per suggestion+target
DO $$ BEGIN
    ALTER TABLE "RegenerationJob" ADD CONSTRAINT regenerationjob_unique_suggestion_target UNIQUE ("suggestionId", "targetType", "targetId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_regenerationjob_suggestionId" ON "RegenerationJob" ("suggestionId");
CREATE INDEX IF NOT EXISTS "idx_regenerationjob_status" ON "RegenerationJob" ("status");

-- Create outputs table
CREATE TABLE IF NOT EXISTS "RegenerationOutput" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" TEXT UNIQUE NOT NULL,
  "targetType" RegenerationTargetType NOT NULL,
  "targetId" TEXT NOT NULL,
  "contentJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

DO $$ BEGIN
    ALTER TABLE "RegenerationOutput" ADD CONSTRAINT regenerationoutput_jobid_fk FOREIGN KEY ("jobId") REFERENCES "RegenerationJob" ("id") ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_regenerationoutput_targetId" ON "RegenerationOutput" ("targetId");
