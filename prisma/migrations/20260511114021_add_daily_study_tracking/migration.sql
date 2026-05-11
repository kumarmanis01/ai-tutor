-- Migration: add_daily_study_tracking
-- Adds two fields to the User table for daily study duration enforcement.
--   todayStudyMinutes    : running total of study minutes today (reset nightly by job)
--   lastStudySessionDate : UTC timestamp of last session; used to detect day boundary
--
-- Free tier cap : 30 minutes / day
-- Premium cap   : 60 minutes / day

ALTER TABLE "User" ADD COLUMN "todayStudyMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastStudySessionDate" TIMESTAMP(3);
