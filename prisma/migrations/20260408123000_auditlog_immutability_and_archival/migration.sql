-- Migration: add archival columns to AuditLog and enforce immutability
-- This migration is intentionally non-transactional because it creates a trigger/function.

-- 1) Add archival columns
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "archived" BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "archiveUrl" TEXT;

-- 2) Create trigger function to prevent UPDATE/DELETE on AuditLog
--    Allow UPDATE only when the change is limited to archival columns
CREATE OR REPLACE FUNCTION auditlog_prevent_modification()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog rows are immutable and cannot be deleted';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Allow updates only if no immutability-protected columns were changed.
    IF (OLD.adminId IS NOT DISTINCT FROM NEW.adminId)
       AND (OLD.targetEntity IS NOT DISTINCT FROM NEW.targetEntity)
       AND (OLD.targetId IS NOT DISTINCT FROM NEW.targetId)
       AND (OLD.action IS NOT DISTINCT FROM NEW.action)
       AND (OLD.previousValue IS NOT DISTINCT FROM NEW.previousValue)
       AND (OLD.newValue IS NOT DISTINCT FROM NEW.newValue)
       AND (OLD.reason IS NOT DISTINCT FROM NEW.reason)
       AND (OLD.ipAddress IS NOT DISTINCT FROM NEW.ipAddress)
       AND (OLD.details IS NOT DISTINCT FROM NEW.details)
       AND (OLD.createdAt IS NOT DISTINCT FROM NEW.createdAt)
    THEN
      -- Only archival columns (archived, archivedAt, archiveUrl) may differ.
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'AuditLog rows are immutable and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Attach trigger
DROP TRIGGER IF EXISTS auditlog_immutability_trg ON "AuditLog";
CREATE TRIGGER auditlog_immutability_trg
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION auditlog_prevent_modification();
