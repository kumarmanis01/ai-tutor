-- Add `subjects` JSONB column to the `User` table if it does not already exist
ALTER TABLE IF EXISTS "public"."User"
ADD COLUMN IF NOT EXISTS "subjects" jsonb NULL;

-- (Idempotent) Ensure index for lookup by phone already exists in earlier migration
