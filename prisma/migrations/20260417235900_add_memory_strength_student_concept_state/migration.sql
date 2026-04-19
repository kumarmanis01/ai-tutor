-- Migration: add_memory_strength_student_concept_state
-- Adds the `memoryStrength` column (DOUBLE PRECISION) to StudentConceptState

ALTER TABLE "StudentConceptState"
ADD COLUMN IF NOT EXISTS "memoryStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
