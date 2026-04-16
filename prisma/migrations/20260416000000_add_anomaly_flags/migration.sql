-- Migration: add anomalyFlags jsonb columns to Message and AITutorTurnLog
-- Created: 2026-04-16

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "anomalyFlags" jsonb;

ALTER TABLE "AITutorTurnLog" ADD COLUMN IF NOT EXISTS "anomalyFlags" jsonb;
