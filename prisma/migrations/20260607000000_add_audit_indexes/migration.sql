-- Migration: audit-driven composite indexes
-- ---------------------------------------------------------------------------
-- This migration is purely additive (CREATE INDEX IF NOT EXISTS only). It adds
-- composite indexes that the 2026-06-07 release-prep audit identified as
-- missing for hot query paths on student dashboard, parent dashboard, IRT
-- worker, and the diagnostic notification scheduler.
--
-- Production note: for tables with millions of rows (AnswerEvent,
-- StudentConceptState) the corresponding CREATE INDEX should be run manually
-- as CREATE INDEX CONCURRENTLY before this migration is applied -- Prisma
-- doesn't support CONCURRENTLY out of the box and a plain CREATE INDEX would
-- take an ACCESS EXCLUSIVE lock for the duration of the build.
-- ---------------------------------------------------------------------------

-- Parent dashboard: parentStudent.findMany({ where: { parentId, status: 'active' } })
CREATE INDEX IF NOT EXISTS "ParentStudent_parentId_status_idx"
  ON "ParentStudent"("parentId", "status");

-- Parent progress / recent-mastery delta: studentConceptState.findMany({ where: { studentId, updatedAt: { gte: ... } } })
CREATE INDEX IF NOT EXISTS "StudentConceptState_studentId_updatedAt_idx"
  ON "StudentConceptState"("studentId", "updatedAt");

-- Spaced repetition scheduler: studentConceptState.findMany({ where: { studentId, nextReviewAt: { lt: now } } })
CREATE INDEX IF NOT EXISTS "StudentConceptState_studentId_nextReviewAt_idx"
  ON "StudentConceptState"("studentId", "nextReviewAt");

-- Diagnostic restart de-dup: answerEvent.findMany({ where: { studentId, sessionId } })
CREATE INDEX IF NOT EXISTS "AnswerEvent_studentId_sessionId_idx"
  ON "AnswerEvent"("studentId", "sessionId");

-- IRT worker idempotency check: answerEvent.findFirst({ where: { sessionId, questionId } })
CREATE INDEX IF NOT EXISTS "AnswerEvent_sessionId_questionId_idx"
  ON "AnswerEvent"("sessionId", "questionId");

-- Pending-diagnostic notification scheduler (admin hourly job):
-- diagnosticSession.findMany({ where: { status: 'COMPLETED', completedAt: { gte: ... } } })
CREATE INDEX IF NOT EXISTS "DiagnosticSession_status_completedAt_idx"
  ON "DiagnosticSession"("status", "completedAt");
