-- Migration: add parent-student pause fields to ParentStudent
-- Adds isPaused (boolean), pausedUntil (timestamptz), pauseReason (text), updatedAt (timestamptz)

ALTER TABLE "ParentStudent"
  ADD COLUMN IF NOT EXISTS "isPaused" boolean NOT NULL DEFAULT false;

ALTER TABLE "ParentStudent"
  ADD COLUMN IF NOT EXISTS "pausedUntil" timestamptz NULL;

ALTER TABLE "ParentStudent"
  ADD COLUMN IF NOT EXISTS "pauseReason" text NULL;

ALTER TABLE "ParentStudent"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

-- Note: This migration is additive and safe to run on existing databases.
