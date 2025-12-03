-- Migration: add phone column to User and unique index
-- This migration is intentionally idempotent so it can be applied safely.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "phone" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
