-- Migration: add TelemetrySample table for Phase 5(B) telemetry
-- Timestamp: 2025-12-18

-- Create telemetry table for flexible time-bucketed samples
CREATE TABLE IF NOT EXISTS "TelemetrySample" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "dimensions" JSONB,
  "dimensionHash" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelemetrySample_pkey" PRIMARY KEY ("id")
);

-- Indexes to support range queries and grouping by key
CREATE INDEX IF NOT EXISTS "TelemetrySample_key_timestamp_idx" ON "TelemetrySample" ("key", "timestamp");
CREATE INDEX IF NOT EXISTS "TelemetrySample_timestamp_idx" ON "TelemetrySample" ("timestamp");

-- Unique constraint to enable idempotent inserts per (key,timestamp,dimensionHash)
CREATE UNIQUE INDEX IF NOT EXISTS "TelemetrySample_key_ts_dimhash_uniq" ON "TelemetrySample" ("key", "timestamp", "dimensionHash");

-- NOTE: retention and downsampling are controlled by background jobs (TODO)
