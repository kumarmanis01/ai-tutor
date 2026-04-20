-- Migration: add inactivityOptOut column to ParentStudent
-- This column was accidentally omitted from 20260417123000_add_parent_notification_and_inactivity_optout
-- which only added it to ParentProfile. This migration is idempotent (IF NOT EXISTS).
-- Generated: 2026-04-20

ALTER TABLE "ParentStudent"
ADD COLUMN IF NOT EXISTS "inactivityOptOut" boolean NOT NULL DEFAULT false;
