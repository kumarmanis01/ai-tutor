-- Migration: add_student_concept_state
-- Adds StudentConceptState table to persist per-student per-concept state

CREATE TABLE IF NOT EXISTS "StudentConceptState" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hintCount" INTEGER NOT NULL DEFAULT 0,
    "hintTier1" INTEGER NOT NULL DEFAULT 0,
    "hintTier2" INTEGER NOT NULL DEFAULT 0,
    "hintTier3" INTEGER NOT NULL DEFAULT 0,
    "lastHintAt" TIMESTAMP(3),
    "needsConsolidation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentConceptState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentConceptState_studentId_conceptId_key" ON "StudentConceptState"("studentId","conceptId");
CREATE INDEX IF NOT EXISTS "StudentConceptState_studentId_idx" ON "StudentConceptState"("studentId");
CREATE INDEX IF NOT EXISTS "StudentConceptState_conceptId_idx" ON "StudentConceptState"("conceptId");

-- Foreign keys
ALTER TABLE "StudentConceptState" ADD CONSTRAINT "StudentConceptState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "StudentConceptState" ADD CONSTRAINT "StudentConceptState_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE;
