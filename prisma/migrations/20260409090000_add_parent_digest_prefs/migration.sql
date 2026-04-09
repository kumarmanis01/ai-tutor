-- Migration: add parent digest preference columns
ALTER TABLE "ParentProfile"
  ADD COLUMN "digestOptOut" boolean NOT NULL DEFAULT false,
  ADD COLUMN "digestDay" text NOT NULL DEFAULT 'Sunday',
  ADD COLUMN "digestTime" text NOT NULL DEFAULT '09:00',
  ADD COLUMN "digestTimezone" text;
