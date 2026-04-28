-- FILE OBJECTIVE:
-- - Create AdminUser, AdminTrustedDevice, AdminAuditLog tables and add INVITED enum value.
-- - These tables were defined in the schema but never had a CREATE TABLE migration.
--
-- LINKED UNIT TEST:
-- - tests/unit/app/api/v1/admin/auth/login/start/route.spec.ts
--
-- EDIT LOG:
-- - 2026-04-25T00:00:00Z | copilot | add A0.1-A0.3 admin invite/setup/login additive fields
-- - 2026-04-25T01:00:00Z | copilot | rewrote to CREATE TABLE (tables were missing from DB)

-- ============================================================
-- 1. Add INVITED to AdminStatus enum (safe, idempotent)
-- ============================================================
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

-- ============================================================
-- 2. Create AdminUser table (all columns including new invite/
--    mfa/lockout fields added in A0.1-A0.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS "AdminUser" (
  "id"                  TEXT          NOT NULL,
  "userId"              TEXT          NOT NULL,
  "role"                "AdminRole"   NOT NULL DEFAULT 'SUPPORT_ADMIN',
  "status"              "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
  "inviteToken"         TEXT,
  "inviteExpiresAt"     TIMESTAMP(3),
  "invitedAt"           TIMESTAMP(3),
  "passwordHash"        TEXT,
  "mfaSecret"           TEXT,
  "mfaEnabled"          BOOLEAN       NOT NULL DEFAULT false,
  "mfaBackupCodes"      TEXT,
  "failedLoginAttempts" INTEGER       NOT NULL DEFAULT 0,
  "lockoutUntil"        TIMESTAMP(3),
  "lastLoginAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- Add any columns that may be missing if the table already existed without them.
ALTER TABLE "AdminUser"
  ADD COLUMN IF NOT EXISTS "inviteToken"         TEXT,
  ADD COLUMN IF NOT EXISTS "inviteExpiresAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "invitedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordHash"        TEXT,
  ADD COLUMN IF NOT EXISTS "mfaSecret"           TEXT,
  ADD COLUMN IF NOT EXISTS "mfaEnabled"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaBackupCodes"      TEXT,
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockoutUntil"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginAt"         TIMESTAMP(3);

-- FK: AdminUser.userId -> User.id  (add if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AdminUser_userId_fkey'
      AND table_name = 'AdminUser'
  ) THEN
    ALTER TABLE "AdminUser"
      ADD CONSTRAINT "AdminUser_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. Create AdminTrustedDevice table
-- ============================================================
CREATE TABLE IF NOT EXISTS "AdminTrustedDevice" (
  "id"          TEXT         NOT NULL,
  "adminUserId" TEXT         NOT NULL,
  "deviceHash"  TEXT         NOT NULL,
  "label"       TEXT,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminTrustedDevice_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AdminTrustedDevice_adminUserId_fkey'
      AND table_name = 'AdminTrustedDevice'
  ) THEN
    ALTER TABLE "AdminTrustedDevice"
      ADD CONSTRAINT "AdminTrustedDevice_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. Create AdminAuditLog table
-- ============================================================
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"          TEXT         NOT NULL,
  "adminUserId" TEXT         NOT NULL,
  "action"      TEXT         NOT NULL,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "payload"     JSONB,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AdminAuditLog_adminUserId_fkey'
      AND table_name = 'AdminAuditLog'
  ) THEN
    ALTER TABLE "AdminAuditLog"
      ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. Unique constraint and indexes
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AdminUser_userId_key'
      AND table_name = 'AdminUser'
  ) THEN
    ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_userId_key" UNIQUE ("userId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AdminTrustedDevice_adminUserId_deviceHash_key'
      AND table_name = 'AdminTrustedDevice'
  ) THEN
    ALTER TABLE "AdminTrustedDevice"
      ADD CONSTRAINT "AdminTrustedDevice_adminUserId_deviceHash_key"
      UNIQUE ("adminUserId", "deviceHash");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_inviteToken_key"              ON "AdminUser"("inviteToken");
CREATE INDEX        IF NOT EXISTS "AdminUser_role_status_idx"              ON "AdminUser"("role", "status");
CREATE INDEX        IF NOT EXISTS "AdminUser_inviteToken_inviteExpiresAt_idx" ON "AdminUser"("inviteToken", "inviteExpiresAt");
CREATE INDEX        IF NOT EXISTS "AdminUser_lockoutUntil_idx"             ON "AdminUser"("lockoutUntil");
CREATE INDEX        IF NOT EXISTS "AdminTrustedDevice_adminUserId_idx"     ON "AdminTrustedDevice"("adminUserId");
CREATE INDEX        IF NOT EXISTS "AdminTrustedDevice_expiresAt_idx"       ON "AdminTrustedDevice"("expiresAt");
CREATE INDEX        IF NOT EXISTS "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX        IF NOT EXISTS "AdminAuditLog_entityType_entityId_idx"  ON "AdminAuditLog"("entityType", "entityId");
