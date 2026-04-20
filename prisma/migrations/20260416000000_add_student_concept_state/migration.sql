-- FILE OBJECTIVE:
-- - Create the StudentConceptState table to persist per-student, per-concept
--   mastery and hint-usage state. All DDL is fully idempotent (IF NOT EXISTS +
--   DO $$ guards on FKs) so this migration is safe to re-run if partially applied.
--
-- LINKED UNIT TEST:
-- - tests/unit/prisma/migrations/20260416000000_add_student_concept_state.spec.ts
--
-- EDIT LOG:
-- - 2026-04-16T00:00:00Z | dev     | initial version — FKs were not guarded;
--                                    failed with error 42710 when run after the
--                                    table already existed (constraint already exists).
-- - 2026-04-20T00:00:00Z | copilot | wrapped both FK statements in DO $$ blocks.
--
-- NOTE FOR PRODUCTION:
-- If prisma migrate deploy reports P3009 for this migration, run
-- scripts/fix_prod_migrations.sql against production DB to recover.

-- IMMUTABILITY NOTE:
-- - This migration was edited in-place on branch feat/f-adm-admin-fixes to add
--   defensive guards around FK creation. Editing a committed migration file
--   after it has been applied in other environments can cause Prisma checksum
--   mismatches (P3009) and deployment failures.
-- - Recommended workflow for fixes: create a new (forward) migration with the
--   corrective DDL and deploy that, or if the production schema was already
--   corrected manually, use `npx prisma migrate resolve --applied <migration>`
--   to mark the migration as applied. Do NOT rely on editing this file to
--   repair production databases; treat committed migrations as immutable.

-- 1. Table (idempotent)
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

-- 2. Foreign keys (guarded — see EDIT LOG for why DO blocks are required here)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentConceptState_studentId_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE "StudentConceptState" ADD CONSTRAINT "StudentConceptState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentConceptState_conceptId_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE "StudentConceptState" ADD CONSTRAINT "StudentConceptState_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE';
    END IF;
END;
$$;
