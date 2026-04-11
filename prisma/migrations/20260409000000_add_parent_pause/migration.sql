-- Migration: add parent pause fields to ParentChildControl
-- Adds isPaused (boolean), pausedUntil (timestamptz) and pauseReason (text)

ALTER TABLE "ParentChildControl"
  ADD COLUMN IF NOT EXISTS "isPaused" boolean NOT NULL DEFAULT false;

ALTER TABLE "ParentChildControl"
  ADD COLUMN IF NOT EXISTS "pausedUntil" timestamptz NULL;

ALTER TABLE "ParentChildControl"
  ADD COLUMN IF NOT EXISTS "pauseReason" text NULL;

-- Note: After running `prisma migrate deploy` / `prisma migrate dev`, ensure application code
-- uses the new fields. This migration is intentionally additive and backward-compatible.
