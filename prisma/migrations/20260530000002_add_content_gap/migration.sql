-- Migration: add_content_gap
-- Adds ContentGap model and ContentGapStatus enum for automated content gap detection.
-- ContentHealthChecker scans question counts per topic/difficulty and writes gaps here.
-- questionsWorker resolves gaps after soft-promoting questions to the Question table.

CREATE TYPE "ContentGapStatus" AS ENUM ('detected', 'hydration_pending', 'resolved', 'ignored');

CREATE TABLE "ContentGap" (
  "id"             TEXT NOT NULL,
  "topicId"        TEXT NOT NULL,
  "subjectId"      TEXT NOT NULL,
  "boardSlug"      TEXT NOT NULL,
  "grade"          INTEGER NOT NULL,
  "difficulty"     TEXT NOT NULL,
  "currentCount"   INTEGER NOT NULL,
  "targetCount"    INTEGER NOT NULL DEFAULT 5,
  "status"         "ContentGapStatus" NOT NULL DEFAULT 'detected',
  "detectedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"     TIMESTAMP(3),
  "hydrationJobId" TEXT,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentGap_pkey" PRIMARY KEY ("id")
);

-- Idempotent upsert key: one gap record per topic + difficulty
ALTER TABLE "ContentGap" ADD CONSTRAINT "ContentGap_topicId_difficulty_key" UNIQUE ("topicId", "difficulty");

-- Foreign keys
ALTER TABLE "ContentGap" ADD CONSTRAINT "ContentGap_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentGap" ADD CONSTRAINT "ContentGap_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "SubjectDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "ContentGap_status_idx" ON "ContentGap"("status");
CREATE INDEX "ContentGap_subjectId_boardSlug_grade_idx" ON "ContentGap"("subjectId", "boardSlug", "grade");
