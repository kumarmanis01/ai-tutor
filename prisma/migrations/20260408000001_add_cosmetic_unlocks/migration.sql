-- AC-06 (F-STU-030): persist unlocked cosmetic items per student.
-- Additive only -- no existing columns dropped.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cosmeticUnlocks" TEXT[] NOT NULL DEFAULT '{}';
