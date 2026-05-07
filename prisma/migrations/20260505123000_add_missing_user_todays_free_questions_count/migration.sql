-- Ensure legacy free-question column exists for older databases.
-- Safe additive migration: no-op when column already exists.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "todaysFreeQuestionsCount" INTEGER NOT NULL DEFAULT 5;
