-- Migration: parent SHOULD-gap enhancements
-- Adds topicFocusRequest on ParentChildControl for F-PAR-002 AC-03.

-- Parent can submit a topic-focus preference that the AI considers on next plan refresh.
ALTER TABLE "ParentChildControl" ADD COLUMN IF NOT EXISTS "topicFocusRequest" TEXT;
