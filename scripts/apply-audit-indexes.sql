-- Apply the 2026-06-07 audit-driven indexes WITHOUT taking ACCESS EXCLUSIVE
-- locks. Paste this whole file into the Neon SQL Editor (or
-- `psql "$DATABASE_URL" -f scripts/apply-audit-indexes.sql` from a host with
-- direct Postgres reach). Each statement is independent and idempotent; if a
-- build fails midway you can rerun the file safely.
--
-- After this completes, run:
--   npx prisma migrate resolve --applied 20260607000000_add_audit_indexes
--   npx prisma migrate deploy   -- runs the DROP-INDEX migration normally
--
-- DO NOT run this inside a transaction -- CREATE INDEX CONCURRENTLY is
-- forbidden in tx blocks. The Neon SQL Editor sends each statement
-- separately by default.

-- ------------------------------------------------------------------
-- 1. ParentStudent (parentId, status)
--    Parent dashboard reads active links per visit (~3% of daily traffic).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParentStudent_parentId_status_idx"
  ON "ParentStudent" ("parentId", "status");

-- ------------------------------------------------------------------
-- 2. StudentConceptState (studentId, updatedAt)
--    Validated by live data: 1647 seq scans / 176K tuples on a 50KB table.
--    Parent /api/parent/progress + recent-mastery delta query.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StudentConceptState_studentId_updatedAt_idx"
  ON "StudentConceptState" ("studentId", "updatedAt");

-- ------------------------------------------------------------------
-- 3. StudentConceptState (studentId, nextReviewAt)
--    Spaced-repetition scheduler -- per-student due-review reads.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StudentConceptState_studentId_nextReviewAt_idx"
  ON "StudentConceptState" ("studentId", "nextReviewAt");

-- ------------------------------------------------------------------
-- 4. AnswerEvent (studentId, sessionId)
--    Diagnostic restart de-dup at /api/student/diagnostic/start.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AnswerEvent_studentId_sessionId_idx"
  ON "AnswerEvent" ("studentId", "sessionId");

-- ------------------------------------------------------------------
-- 5. AnswerEvent (sessionId, questionId)
--    IRT worker idempotency check before INSERT.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AnswerEvent_sessionId_questionId_idx"
  ON "AnswerEvent" ("sessionId", "questionId");

-- ------------------------------------------------------------------
-- 6. DiagnosticSession (status, completedAt)
--    Admin hourly job scanning recently-completed diagnostics.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DiagnosticSession_status_completedAt_idx"
  ON "DiagnosticSession" ("status", "completedAt");

-- ------------------------------------------------------------------
-- Verify all 6 are valid (no failed CONCURRENT builds)
-- ------------------------------------------------------------------
SELECT
  i.relname AS index_name,
  pg_size_pretty(pg_relation_size(i.oid)) AS size,
  idx.indisvalid AS is_valid,
  idx.indisready AS is_ready
FROM pg_index idx
JOIN pg_class i ON i.oid = idx.indexrelid
WHERE i.relname IN (
  'ParentStudent_parentId_status_idx',
  'StudentConceptState_studentId_updatedAt_idx',
  'StudentConceptState_studentId_nextReviewAt_idx',
  'AnswerEvent_studentId_sessionId_idx',
  'AnswerEvent_sessionId_questionId_idx',
  'DiagnosticSession_status_completedAt_idx'
)
ORDER BY i.relname;
-- All six should show is_valid = true, is_ready = true.
-- If any show is_valid = false, drop and re-run that single statement:
--   DROP INDEX CONCURRENTLY IF EXISTS "<name>";
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "<name>" ON ...;
