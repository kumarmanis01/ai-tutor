-- AC-04 (F-STU-013): Add StudentMisconception table.
-- Tracks per-student occurrence of known misconceptions.
-- Injected into future session prompts for the same concept cluster.
-- Additive only -- no existing data is touched.

CREATE TABLE IF NOT EXISTS "StudentMisconception" (
  "id"              TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "misconceptionId" TEXT NOT NULL,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt"      TIMESTAMP(3) NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "StudentMisconception_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentMisconception_studentId_misconceptionId_key"
  ON "StudentMisconception"("studentId", "misconceptionId");

CREATE INDEX IF NOT EXISTS "StudentMisconception_studentId_idx"
  ON "StudentMisconception"("studentId");

CREATE INDEX IF NOT EXISTS "StudentMisconception_studentId_misconceptionId_idx"
  ON "StudentMisconception"("studentId", "misconceptionId");

ALTER TABLE "StudentMisconception"
  ADD CONSTRAINT "StudentMisconception_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentMisconception"
  ADD CONSTRAINT "StudentMisconception_misconceptionId_fkey"
    FOREIGN KEY ("misconceptionId") REFERENCES "Misconception"("id") ON DELETE CASCADE ON UPDATE CASCADE;
