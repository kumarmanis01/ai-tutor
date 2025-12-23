-- Migration: add lockedAt and completedAt to RegenerationJob

DO $$ BEGIN
    ALTER TABLE "RegenerationJob" ADD COLUMN "lockedAt" TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "RegenerationJob" ADD COLUMN "completedAt" TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Optional: index to help queries that look for stuck jobs
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS "idx_regenerationjob_lockedAt" ON "RegenerationJob" ("lockedAt");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
