-- F-ADM-002 AC-05: Admin-controlled subject availability gate.
-- New column defaults to FALSE for new subjects (admin must explicitly enable).
-- Existing subjects are set to TRUE so they remain accessible without immediate admin action.

ALTER TABLE "SubjectDef"
  ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate existing subjects to available=true so live platform is unaffected.
UPDATE "SubjectDef" SET "isAvailable" = TRUE WHERE "isAvailable" = FALSE;

CREATE INDEX IF NOT EXISTS idx_subjectdef_available
  ON "SubjectDef" ("isAvailable")
  WHERE "isAvailable" = TRUE;
