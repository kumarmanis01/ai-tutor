-- Migration: add SessionArtifact table for persisted session artifacts
-- Generated: 2026-04-13

CREATE TABLE IF NOT EXISTS "SessionArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "sessionId" TEXT,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "meta" JSONB,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "SessionArtifact_studentId_index" ON "SessionArtifact" ("studentId");
CREATE INDEX IF NOT EXISTS "SessionArtifact_sessionId_index" ON "SessionArtifact" ("sessionId");

-- Foreign keys (cascade on student/session deletion to keep data consistent)
ALTER TABLE "SessionArtifact"
  ADD CONSTRAINT "SessionArtifact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "SessionArtifact"
  ADD CONSTRAINT "SessionArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StructuredSession"("id") ON DELETE CASCADE;
