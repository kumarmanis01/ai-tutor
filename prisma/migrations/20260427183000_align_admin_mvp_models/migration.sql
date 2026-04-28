-- FILE OBJECTIVE:
-- - Align admin onboarding/auth schema to A0.1-A0.3 without destructive changes.
-- - Add AdminSession model and additive columns/enums for admin invite/login flows.
--
-- LINKED UNIT TEST:
-- - tests/unit/app/api/v1/admin/auth/refresh/route.spec.ts
--
-- EDIT LOG:
-- - 2026-04-27T18:30:00Z | copilot | add AdminSession and additive admin model fields for Sprint 3 MVP

-- 1) AdminStatus enum additions (additive only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminStatus' AND e.enumlabel = 'SUSPENDED'
  ) THEN
    ALTER TYPE "AdminStatus" ADD VALUE 'SUSPENDED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AdminStatus' AND e.enumlabel = 'DELETED'
  ) THEN
    ALTER TYPE "AdminStatus" ADD VALUE 'DELETED';
  END IF;
END $$;

-- 2) AdminUser additive fields
ALTER TABLE "AdminUser"
  ADD COLUMN IF NOT EXISTS "backupCodesHash" TEXT,
  ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT;

-- 3) AdminTrustedDevice additive fields
ALTER TABLE "AdminTrustedDevice"
  ADD COLUMN IF NOT EXISTS "deviceToken" TEXT,
  ADD COLUMN IF NOT EXISTS "ipSubnet" TEXT,
  ADD COLUMN IF NOT EXISTS "fingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "AdminTrustedDevice_deviceToken_key"
  ON "AdminTrustedDevice"("deviceToken");

-- 4) AdminAuditLog additive fields
ALTER TABLE "AdminAuditLog"
  ADD COLUMN IF NOT EXISTS "targetType" TEXT,
  ADD COLUMN IF NOT EXISTS "targetId" TEXT,
  ADD COLUMN IF NOT EXISTS "details" JSONB,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;

UPDATE "AdminAuditLog"
SET "ipAddress" = COALESCE("ipAddress", '0.0.0.0')
WHERE "ipAddress" IS NULL;

-- Make ipAddress effectively required for future writes
ALTER TABLE "AdminAuditLog"
  ALTER COLUMN "ipAddress" SET DEFAULT '0.0.0.0';

-- 5) AdminSession table for refresh-token session management
CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AdminSession_adminId_fkey'
      AND table_name = 'AdminSession'
  ) THEN
    ALTER TABLE "AdminSession"
      ADD CONSTRAINT "AdminSession_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_refreshToken_key"
  ON "AdminSession"("refreshToken");
CREATE INDEX IF NOT EXISTS "AdminSession_adminId_expiresAt_idx"
  ON "AdminSession"("adminId", "expiresAt");
CREATE INDEX IF NOT EXISTS "AdminSession_revokedAt_idx"
  ON "AdminSession"("revokedAt");
