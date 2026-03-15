-- Migration: add_student_concept_state_relation
-- Adds FK from StudentConceptState.conceptId → Concept.id
-- No new columns — pure relation enforcement.

ALTER TABLE "StudentConceptState"
  ADD CONSTRAINT "StudentConceptState_conceptId_fkey"
  FOREIGN KEY ("conceptId") REFERENCES "Concept"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
