-- Migration: add_requested_subject_slugs
-- Adds demand-signal field for subjects selected during onboarding that are not yet live.

ALTER TABLE "User"
  ADD COLUMN "requestedSubjectSlugs" TEXT[] NOT NULL DEFAULT '{}';
