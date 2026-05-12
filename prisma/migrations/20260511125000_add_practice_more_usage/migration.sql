-- Migration: add_practice_more_usage
-- Adds PracticeMoreUsage table to track daily "practice more" feature usage.
-- Paid users can use "practice more" once per day to fetch fresh (non-repeating) practice questions.
-- This table tracks when the feature was last used and how many times today.

CREATE TABLE "PracticeMoreUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "usageDate" TIMESTAMP(3) NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PracticeMoreUsage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Unique constraint ensures only one entry per student per day
CREATE UNIQUE INDEX "PracticeMoreUsage_studentId_usageDate_key" ON "PracticeMoreUsage"("studentId", "usageDate");

-- Index for efficient lookups by student and date
CREATE INDEX "PracticeMoreUsage_studentId_usageDate_idx" ON "PracticeMoreUsage"("studentId", "usageDate");
