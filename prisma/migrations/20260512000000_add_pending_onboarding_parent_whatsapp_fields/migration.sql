-- Add new parent contact and channel verification columns (additive).
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "parentWhatsappPhone" TEXT,
ADD COLUMN IF NOT EXISTS "parentEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "parentWhatsappVerifiedAt" TIMESTAMP(3);

-- Add new enum value for not-yet-submitted onboarding users.
-- This migration is not transactional because ALTER TYPE ADD VALUE cannot run inside a transaction.
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'pending_onboarding';

-- New users should start inactive until onboarding submit.
ALTER TABLE "User" ALTER COLUMN "accountStatus" SET DEFAULT 'pending_onboarding';

-- Safe backfill: if any rows are in pending_onboarding but already have key academic fields,
-- promote to active to preserve prior behavior for previously onboarded users.
UPDATE "User"
SET "accountStatus" = 'active'
WHERE "accountStatus" = 'pending_onboarding'
  AND "grade" IS NOT NULL
  AND "board" IS NOT NULL;
