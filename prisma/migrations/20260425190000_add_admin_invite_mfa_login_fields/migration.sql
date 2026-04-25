-- FILE OBJECTIVE:
-- - Additive AdminUser schema changes for invite onboarding, MFA activation, and login lockout flows.
--
-- LINKED UNIT TEST:
-- - tests/unit/app/api/v1/admin/auth/login/start/route.spec.ts
--
-- EDIT LOG:
-- - 2026-04-25T00:00:00Z | copilot | add A0.1-A0.3 admin invite/setup/login additive fields

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminStatus' AND e.enumlabel = 'INVITED'
  ) THEN
    ALTER TYPE "AdminStatus" ADD VALUE 'INVITED';
  END IF;
END $$;

ALTER TABLE "AdminUser"
ADD COLUMN IF NOT EXISTS "inviteToken" TEXT,
ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_inviteToken_key" ON "AdminUser"("inviteToken");
CREATE INDEX IF NOT EXISTS "AdminUser_inviteToken_inviteExpiresAt_idx" ON "AdminUser"("inviteToken", "inviteExpiresAt");
CREATE INDEX IF NOT EXISTS "AdminUser_lockoutUntil_idx" ON "AdminUser"("lockoutUntil");
