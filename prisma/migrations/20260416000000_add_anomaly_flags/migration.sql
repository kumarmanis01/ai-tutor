-- Migration: add anomalyFlags jsonb columns to Message and AITutorTurnLog
-- Created: 2026-04-16

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "anomalyFlags" jsonb;

ALTER TABLE "AITutorTurnLog" ADD COLUMN IF NOT EXISTS "anomalyFlags" jsonb;

-- Add GIN indexes for fast anomalyFlags queries (jsonb)
CREATE INDEX IF NOT EXISTS "Message_anomalyflags_gin" ON "Message" USING GIN ("anomalyFlags");
CREATE INDEX IF NOT EXISTS "AITutorTurnLog_anomalyflags_gin" ON "AITutorTurnLog" USING GIN ("anomalyFlags");
