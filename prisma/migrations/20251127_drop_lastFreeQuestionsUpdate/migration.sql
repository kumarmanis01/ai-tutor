-- Migration: drop lastFreeQuestionsUpdate column from User
-- Created by automation: drop nullable timestamp column

ALTER TABLE "User"
DROP COLUMN IF EXISTS "lastFreeQuestionsUpdate";
