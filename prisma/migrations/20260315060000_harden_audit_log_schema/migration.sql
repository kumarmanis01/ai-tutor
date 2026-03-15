-- This migration is not transactional
-- Reason: CREATE TYPE (PostgreSQL enum) cannot run inside a transaction.
-- Prisma wraps migrations in transactions by default; this pragma disables that.

-- Step 1: Add new columns as nullable
ALTER TABLE "AuditLog" ADD COLUMN "adminId"       TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetEntity"  TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetId"      TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "previousValue" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "newValue"      JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "reason"        TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ipAddress"     TEXT;

-- Step 2a: Migrate existing soft_delete_user rows
-- COALESCE(details->>'userId', id) guards against rows where details is null
UPDATE "AuditLog"
SET "adminId"      = "userId",
    "targetEntity" = 'User',
    "targetId"     = COALESCE("details"->>'userId', "id")
WHERE "action" = 'soft_delete_user';

-- Step 2b: Backfill all remaining rows so NOT NULL constraint can be applied
UPDATE "AuditLog"
SET "targetEntity" = 'SYSTEM',
    "targetId"     = COALESCE("userId", 'SYSTEM')
WHERE "targetEntity" IS NULL;

-- Step 3: Drop old free-text action column
ALTER TABLE "AuditLog" DROP COLUMN "action";

-- Step 4: Create typed enum (must be outside a transaction)
CREATE TYPE "AdminActionType" AS ENUM (
  'GRADE_CHANGE',
  'DIAGNOSTIC_RESET',
  'ACCOUNT_SUSPEND',
  'ACCOUNT_REACTIVATE',
  'ACCOUNT_DEACTIVATE',
  'SUBSCRIPTION_EXTEND',
  'SUBSCRIPTION_REFUND',
  'QUESTION_QUARANTINE',
  'QUESTION_APPROVE',
  'QUESTION_REJECT',
  'FEATURE_FLAG_CHANGE',
  'ERASURE_REQUEST',
  'ERASURE_PSEUDONYMISE',
  'ERASURE_PURGE',
  'CONTENT_APPROVE',
  'DOUBT_RESOLVE',
  'CONTENT_REJECT',
  'JOB_CANCEL',
  'JOB_RETRY',
  'JOB_REQUEUE',
  'CONTENT_HYDRATE',
  'WORKER_START',
  'WORKER_STOP'
);

-- Add typed action column (nullable — null = system/non-admin event)
ALTER TABLE "AuditLog" ADD COLUMN "action" "AdminActionType";

-- Step 4b: Backfill enum value for the migrated suspend rows
UPDATE "AuditLog"
SET "action" = 'ACCOUNT_SUSPEND'
WHERE "targetEntity" = 'User'
  AND "adminId" IS NOT NULL
  AND "action" IS NULL;

-- Step 5: Make targetEntity and targetId non-nullable (all rows backfilled above)
ALTER TABLE "AuditLog" ALTER COLUMN "targetEntity" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "targetId"     SET NOT NULL;

-- Step 6: Drop old userId FK and column
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "userId";

-- Step 7: Add new adminId FK + indexes
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_targetEntity_targetId_idx" ON "AuditLog"("targetEntity", "targetId");
CREATE INDEX "AuditLog_adminId_createdAt_idx"     ON "AuditLog"("adminId", "createdAt");
