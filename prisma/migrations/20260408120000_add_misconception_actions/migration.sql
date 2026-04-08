-- This migration is not transactional
-- Reason: ALTER TYPE ADD VALUE must not run inside a transaction in some PG versions.

-- Add new enum values for admin actions related to misconceptions
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'MISCONCEPTION_CREATE';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'MISCONCEPTION_UPDATE';
