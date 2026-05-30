-- Migration: add_slow_query_log
-- Creates the SlowQueryLog table for the daily slow query digest feature.
-- Append-only telemetry table -- no foreign keys, no cascades.

CREATE TABLE "SlowQueryLog" (
  "id"          TEXT         NOT NULL,
  "model"       TEXT,
  "operation"   TEXT         NOT NULL,
  "durationMs"  INTEGER      NOT NULL,
  "threshold"   INTEGER      NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlowQueryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlowQueryLog_createdAt_idx" ON "SlowQueryLog"("createdAt");
CREATE INDEX "SlowQueryLog_model_operation_idx" ON "SlowQueryLog"("model", "operation");
