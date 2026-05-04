-- F-STU-040 AC-01: Scope FreeTierUsage by student + subjectScope + periodStart.
-- Keeps existing session-cap semantics using subjectScope='__ALL__' and enables
-- per-subject chapter-test usage rows in the same period.

ALTER TABLE "FreeTierUsage"
ADD COLUMN "subjectScope" TEXT NOT NULL DEFAULT '__ALL__';

DROP INDEX IF EXISTS "FreeTierUsage_studentId_key";

CREATE UNIQUE INDEX "FreeTierUsage_studentId_subjectScope_periodStart_key"
ON "FreeTierUsage"("studentId", "subjectScope", "periodStart");
