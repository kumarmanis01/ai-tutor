-- Migration: add ParentNotification table and inactivityOptOut column on ParentProfile
-- Generated: 2026-04-17

ALTER TABLE "ParentProfile"
ADD COLUMN IF NOT EXISTS "inactivityOptOut" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ParentNotification" (
  "id" TEXT PRIMARY KEY,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT,
  "type" TEXT,
  "channel" TEXT,
  "subject" TEXT,
  "body" JSONB,
  "sentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ParentNotification_parentId_sentAt_idx" ON "ParentNotification" ("parentId", "sentAt");
