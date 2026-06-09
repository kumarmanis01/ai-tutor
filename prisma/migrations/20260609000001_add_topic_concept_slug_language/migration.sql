-- Migration: add slug and language fields to TopicConcept
-- slug: nullable, URL-safe identifier derived from title, populated on next generate run
-- language: non-null with default 'en', existing rows inherit English

ALTER TABLE "TopicConcept" ADD COLUMN "slug" TEXT;
ALTER TABLE "TopicConcept" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- Index for language-scoped queries
CREATE INDEX "TopicConcept_topicSlug_subject_grade_board_language_idx"
  ON "TopicConcept"("topicSlug", "subject", "grade", "board", "language");
