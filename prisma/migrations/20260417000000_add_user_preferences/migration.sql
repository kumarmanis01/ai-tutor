-- Add preferences JSON column to user table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" jsonb;
