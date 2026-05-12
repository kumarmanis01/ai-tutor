-- Add new parent contact and channel verification columns (additive).
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "parentWhatsappPhone" TEXT,
ADD COLUMN IF NOT EXISTS "parentEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "parentWhatsappVerifiedAt" TIMESTAMP(3);

-- Add new enum value for not-yet-submitted onboarding users.
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'pending_onboarding';
