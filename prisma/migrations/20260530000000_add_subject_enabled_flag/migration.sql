-- Migration: add_subject_enabled_flag
-- Adds admin-controlled isEnabled toggle to BoardSubjectConfig.
-- Replaces the previous question-count >= 10 heuristic for subject visibility.

ALTER TABLE "BoardSubjectConfig"
  ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enabledAt" TIMESTAMP(3),
  ADD COLUMN "enabledBy" TEXT;

-- Back-fill: enable any subject whose SubjectDef already has isAvailable = true
-- (these were manually enabled by admins via the previous route).
UPDATE "BoardSubjectConfig" bsc
SET "isEnabled" = true,
    "enabledAt" = NOW()
FROM "SubjectDef" sd
WHERE bsc."subjectDefId" = sd.id
  AND sd."isAvailable" = true;
