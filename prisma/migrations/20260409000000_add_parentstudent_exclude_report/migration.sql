-- Migration: add excludeFromParentReport to ParentStudent
-- Adds a boolean column `excludeFromParentReport` to allow per-student opt-out from parent reports

ALTER TABLE "ParentStudent"
  ADD COLUMN IF NOT EXISTS "excludeFromParentReport" boolean NOT NULL DEFAULT false;

-- Note: additive migration, safe to run on existing DBs.
