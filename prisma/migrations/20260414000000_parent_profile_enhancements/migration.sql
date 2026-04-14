-- Migration: parent profile enhancements
-- Adds per-parent inactivity threshold, child weekly hours target,
-- preferred study schedule slot, and date-of-birth for child profiles.

-- Re-add dateOfBirth on User (was dropped in 20260313120000_drop_date_of_birth_use_age_integer)
-- Used by parent when creating a child profile. Nullable so existing rows are unaffected.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

-- Per-parent configurable inactivity alert threshold (days). Default 3 per spec F-PAR-021 AC-01.
ALTER TABLE "ParentProfile" ADD COLUMN IF NOT EXISTS "inactivityThresholdDays" INTEGER NOT NULL DEFAULT 3;

-- Weekly study hours target and preferred study schedule slot per child (F-PAR-002 AC-02).
ALTER TABLE "ParentChildControl" ADD COLUMN IF NOT EXISTS "weeklyHoursTarget" INTEGER;
ALTER TABLE "ParentChildControl" ADD COLUMN IF NOT EXISTS "schedulePreference" TEXT;
