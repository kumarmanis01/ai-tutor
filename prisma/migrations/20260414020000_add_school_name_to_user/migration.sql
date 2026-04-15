-- Migration: add schoolName to User
-- Captures the student's school name during onboarding (optional field).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolName" TEXT;
