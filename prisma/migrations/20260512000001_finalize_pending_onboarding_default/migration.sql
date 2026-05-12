-- Finalize AccountStatus rollout after enum value exists.
-- Safe once 20260512000000_add_pending_onboarding_parent_whatsapp_fields is committed.

-- New users should start inactive until onboarding submit.
ALTER TABLE "User" ALTER COLUMN "accountStatus" SET DEFAULT 'pending_onboarding';

-- Backfill legacy rows that were auto-defaulted to pending_onboarding but already have key profile fields.
UPDATE "User"
SET "accountStatus" = 'active'
WHERE "accountStatus" = 'pending_onboarding'
  AND "grade" IS NOT NULL
  AND "board" IS NOT NULL;
