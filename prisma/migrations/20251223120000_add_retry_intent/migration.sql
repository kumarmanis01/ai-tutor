-- Migration: Add RetryIntent model and enums for Phase 14

DO $$ BEGIN
    CREATE TYPE "RetryIntentStatus" AS ENUM ('PENDING', 'CONSUMED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RetryReasonCode" AS ENUM ('TRANSIENT_FAILURE', 'BAD_INPUT', 'IMPROVED_PROMPT', 'INFRA_ERROR', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "RetryIntent" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceJobId" TEXT NOT NULL,
  "sourceOutputRef" JSONB,
  "reasonCode" RetryReasonCode NOT NULL,
  "reasonText" TEXT NOT NULL,
  "approvedBy" TEXT NOT NULL,
  "approvedAt" TIMESTAMP WITH TIME ZONE,
  "status" RetryIntentStatus NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS "idx_retryintent_sourceJobId" ON "RetryIntent" ("sourceJobId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
