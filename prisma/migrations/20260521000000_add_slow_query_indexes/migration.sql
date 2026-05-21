-- Composite index for heartbeat watchdog scan
-- Covers: WHERE lastHeartbeatAt < $1 AND status != 'FAILED'
CREATE INDEX IF NOT EXISTS "WorkerLifecycle_lastHeartbeatAt_status_idx"
  ON "WorkerLifecycle"("lastHeartbeatAt", "status");

-- Composite index for reconciler isLevelComplete groupBy
-- Covers: WHERE rootJobId = $1 AND hierarchyLevel = $2 GROUP BY status
CREATE INDEX IF NOT EXISTS "HydrationJob_rootJobId_hierarchyLevel_status_idx"
  ON "HydrationJob"("rootJobId", "hierarchyLevel", "status");

-- Composite index for stuck-job detection (unstick-all route)
-- Covers: WHERE status = 'running' AND lockedAt < $1
CREATE INDEX IF NOT EXISTS "HydrationJob_status_lockedAt_idx"
  ON "HydrationJob"("status", "lockedAt");

-- Composite index for reconciler getRootJobsForReconciliation
-- Covers: WHERE rootJobId IS NULL AND status IN ('pending', 'running')
CREATE INDEX IF NOT EXISTS "HydrationJob_status_rootJobId_idx"
  ON "HydrationJob"("status", "rootJobId");
