-- FILE OBJECTIVE:
-- - Add ParentRelation enum and relationToChild field to ParentStudent.
-- - Stores the parent's relationship to the child (Mom, Dad, LegalGuardian)
--   as selected in the parent onboarding Add Child form.
-- - Additive only: nullable field, no existing rows affected.
--
-- EDIT LOG:
-- - 2026-04-29T00:00:00Z | claude | add ParentRelation enum + relationToChild on ParentStudent

-- 1) Create ParentRelation enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParentRelation') THEN
    CREATE TYPE "ParentRelation" AS ENUM ('Mom', 'Dad', 'LegalGuardian');
  END IF;
END
$$;

-- 2) Add nullable relationToChild column to ParentStudent
ALTER TABLE "ParentStudent"
  ADD COLUMN IF NOT EXISTS "relationToChild" "ParentRelation";
