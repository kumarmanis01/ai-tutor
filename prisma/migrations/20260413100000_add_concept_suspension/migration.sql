-- Migration: F-ADM-013 AC-04 -- concept suspension flag
-- Admin can temporarily suspend a concept from AI teaching when a hallucination is
-- confirmed. Suspended concepts are blocked at session start (not at serve time) so
-- students see a clear "under review" message rather than a mid-session error.

ALTER TABLE "Concept"
  ADD COLUMN IF NOT EXISTS "isSuspended"     BOOLEAN    NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "suspendedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

-- Partial index: fast lookup of currently suspended concepts.
CREATE INDEX IF NOT EXISTS idx_concept_suspended
  ON "Concept" ("isSuspended")
  WHERE "isSuspended" = TRUE;

-- Enum values for AdminActionType (Prisma enums live in the DB as string literals).
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'CONCEPT_SUSPEND';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'CONCEPT_UNSUSPEND';
