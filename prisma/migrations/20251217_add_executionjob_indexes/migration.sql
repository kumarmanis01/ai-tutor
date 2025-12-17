-- Migration: add indexes to ExecutionJob for admin queries and cursor pagination
-- Timestamp: 2025-12-17

-- Index on createdAt to support cursor pagination and range scans
CREATE INDEX IF NOT EXISTS "ExecutionJob_createdAt_idx" ON "ExecutionJob"("createdAt");

-- Index to support common filter by status while preserving createdAt ordering
CREATE INDEX IF NOT EXISTS "ExecutionJob_status_createdAt_idx" ON "ExecutionJob"("status", "createdAt");

-- Index to support filtering by jobType with createdAt sorting
CREATE INDEX IF NOT EXISTS "ExecutionJob_jobType_createdAt_idx" ON "ExecutionJob"("jobType", "createdAt");

-- Index to support filtering by entityType with createdAt sorting
CREATE INDEX IF NOT EXISTS "ExecutionJob_entityType_createdAt_idx" ON "ExecutionJob"("entityType", "createdAt");

-- Index to support direct lookups by entityId (search by entityId)
CREATE INDEX IF NOT EXISTS "ExecutionJob_entityId_idx" ON "ExecutionJob"("entityId");

-- Optional composite for combined heavy queries (status + jobType + createdAt)
-- Create if expected query patterns indicate high volume for combined filters.
CREATE INDEX IF NOT EXISTS "ExecutionJob_status_jobType_createdAt_idx" ON "ExecutionJob"("status", "jobType", "createdAt");
