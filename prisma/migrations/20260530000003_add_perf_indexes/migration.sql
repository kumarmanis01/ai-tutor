-- Migration: add_perf_indexes
-- Adds two missing indexes identified by slow-query audit (2026-05-30).
-- Only CREATE INDEX statements -- no data changes, no table locks on existing rows.
--
-- APPLY MANUALLY with CONCURRENTLY to avoid table locks on live traffic:
--   psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY ..."
-- Or pipe this file after replacing CREATE INDEX with CREATE INDEX CONCURRENTLY.

-- LearningPlanItem: covers WHERE planId=X AND status=Y queries.
-- The existing (planId, weekNumber, status) index has status as the 3rd column,
-- making it sub-optimal for the IN_PROGRESS and UPCOMING-without-weekNumber lookups
-- fired by the dashboard plan-item resolver.
CREATE INDEX "LearningPlanItem_planId_status_idx" ON "LearningPlanItem"("planId", "status");

-- StructuredSession: covers ORDER BY startedAt ASC (firstSession query) and
-- WHERE startedAt >= sevenDaysAgo (weeklyActivity query). Existing indexes cover
-- state and completedAt but not the startedAt range scan or sort.
CREATE INDEX "StructuredSession_studentId_startedAt_idx" ON "StructuredSession"("studentId", "startedAt");
