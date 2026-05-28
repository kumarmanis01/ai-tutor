-- Migration: perf_add_index_audit
-- Full schema index audit (2026-05-28).
-- Covers both slow-query hot-spot fixes and the broader model audit.
-- All drops use IF EXISTS; all creates use IF NOT EXISTS — idempotent.
--
-- ⚠️  PRODUCTION WARNING
--     CREATE INDEX without CONCURRENTLY holds an AccessShareLock that blocks
--     writes for the duration of the build. For the tables listed below, run
--     the CREATE statements manually with CONCURRENTLY before deploying this
--     migration, then mark it applied without re-running:
--       npx prisma migrate resolve --applied 20260528000000_perf_add_index_audit
--
--     Large / high-write tables requiring CONCURRENTLY treatment:
--       LearningSession, Event, ChatHistory, AnalyticsEvent,
--       AIContentLog, GeneratedStudyContent, DoubtKb, Outbox
--
--     After migration, also run:
--       VACUUM ANALYZE "LearningSession";
--       VACUUM ANALYZE "Event";
--       VACUUM ANALYZE "ChatHistory";
--       VACUUM ANALYZE "AnalyticsEvent";
--       VACUUM ANALYZE "AIContentLog";
--       VACUUM ANALYZE "GeneratedStudyContent";

-- =============================================================================
-- DROPS — remove redundant / replaced indexes first to reduce write overhead
-- =============================================================================

-- AIContentLog: bare [createdAt] replaced by (promptType, createdAt)
DROP INDEX IF EXISTS "AIContentLog_createdAt_idx";

-- GeneratedStudyContent: bare [createdAt] replaced by (status, lifecycle, createdAt)
DROP INDEX IF EXISTS "idx_generated_study_content_created";

-- RegenerationOutput: exact duplicate of the unnamed @@index([targetId]) above it
DROP INDEX IF EXISTS "idx_regenerationoutput_targetId";

-- BoardChapterWeight: @@unique([chapterId]) already creates a B-tree index
DROP INDEX IF EXISTS "BoardChapterWeight_chapterId_idx";

-- BoardSubjectConfig: @@unique([subjectDefId]) already creates a B-tree index
DROP INDEX IF EXISTS "BoardSubjectConfig_subjectDefId_idx";

-- =============================================================================
-- P0 — Auth hot path + worker enumeration (every request / every job)
-- =============================================================================

-- Account: NextAuth resolves accounts by userId on every authenticated request.
-- Covers: findMany WHERE userId = $1
CREATE INDEX IF NOT EXISTS "Account_userId_idx"
  ON "Account"("userId");

-- TopicNote: worker + student session fetch approved notes on every content load.
-- Covers: findFirst WHERE topicId = $1 AND language = $2 AND status = 'approved'
CREATE INDEX IF NOT EXISTS "TopicNote_topicId_language_status_idx"
  ON "TopicNote"("topicId", "language", "status");

-- TopicNote: admin content review queue.
-- Covers: findMany WHERE status = $1 AND lifecycle = $2
CREATE INDEX IF NOT EXISTS "TopicNote_status_lifecycle_idx"
  ON "TopicNote"("status", "lifecycle");

-- ChapterDef: hydration worker enumerates active chapters per subject on every syllabus job.
-- Covers: findMany WHERE subjectId = $1 AND lifecycle = 'active' AND status = $2
CREATE INDEX IF NOT EXISTS "ChapterDef_subjectId_lifecycle_status_idx"
  ON "ChapterDef"("subjectId", "lifecycle", "status");

-- TopicDef: hydration worker enumerates topics per chapter.
-- Covers: findMany WHERE chapterId = $1
CREATE INDEX IF NOT EXISTS "TopicDef_chapterId_idx"
  ON "TopicDef"("chapterId");

-- TopicDef: content-ready check and admin filters.
-- Covers: findMany WHERE chapterId = $1 AND status = $2 AND lifecycle = $3
CREATE INDEX IF NOT EXISTS "TopicDef_chapterId_status_lifecycle_idx"
  ON "TopicDef"("chapterId", "status", "lifecycle");

-- LearningSession: dashboard subject-session filter.
-- Covers: findMany WHERE studentId = $1 AND activityType = $2
CREATE INDEX IF NOT EXISTS "LearningSession_studentId_activityType_idx"
  ON "LearningSession"("studentId", "activityType");

-- LearningSession: completion counts and session history feed.
-- Covers: findMany WHERE studentId = $1 AND isCompleted = $2 ORDER BY startedAt
CREATE INDEX IF NOT EXISTS "LearningSession_studentId_isCompleted_startedAt_idx"
  ON "LearningSession"("studentId", "isCompleted", "startedAt");

-- =============================================================================
-- P1 — Worker heartbeats, outbox poller, tutor turn path
-- =============================================================================

-- WorkerLifecycle: heartbeat UPDATE targets WHERE type = $workerType — was a seq scan.
-- Covers: UPDATE WHERE type = $1
CREATE INDEX IF NOT EXISTS "WorkerLifecycle_type_idx"
  ON "WorkerLifecycle"("type");

-- WorkerLifecycle: worker status dashboard.
-- Covers: findMany WHERE type = $1 AND status = $2
CREATE INDEX IF NOT EXISTS "WorkerLifecycle_type_status_idx"
  ON "WorkerLifecycle"("type", "status");

-- AnalyticsEvent: admin queries and aggregator filter by userId.
-- Covers: findMany WHERE userId = $1 ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx"
  ON "AnalyticsEvent"("userId", "createdAt");

-- ExecutionJob: worker findFirst with lock-expiry filter.
-- Covers: findFirst WHERE status = 'pending' AND (lockedAt IS NULL OR lockedAt < now()) ORDER BY nextRunAt
CREATE INDEX IF NOT EXISTS "ExecutionJob_status_lockedAt_nextRunAt_idx"
  ON "ExecutionJob"("status", "lockedAt", "nextRunAt");

-- Outbox: poller unsent-rows scan — (queue, sentAt) can't efficiently serve sentAt IS NULL.
-- Covers: findMany WHERE sentAt IS NULL ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "Outbox_sentAt_createdAt_idx"
  ON "Outbox"("sentAt", "createdAt");

-- Outbox: per-queue poller covering index.
-- Covers: findMany WHERE queue = $1 AND sentAt IS NULL ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "Outbox_queue_sentAt_createdAt_idx"
  ON "Outbox"("queue", "sentAt", "createdAt");

-- DoubtKb: tutor session dedup check.
-- Covers: findFirst WHERE sessionId = $1 AND conceptId = $2
CREATE INDEX IF NOT EXISTS "DoubtKb_sessionId_idx"
  ON "DoubtKb"("sessionId");

-- AIContentLog: replaces bare [createdAt]; cost/usage reports by promptType + date range.
-- Covers: findMany WHERE promptType = $1 AND createdAt BETWEEN $2 AND $3
CREATE INDEX IF NOT EXISTS "AIContentLog_promptType_createdAt_idx"
  ON "AIContentLog"("promptType", "createdAt");

-- AIContentLog: per-topic hydration cost queries.
-- Covers: findMany WHERE topicId = $1
CREATE INDEX IF NOT EXISTS "AIContentLog_topicId_idx"
  ON "AIContentLog"("topicId");

-- Event: activity feed and analytics queries by userId.
-- Covers: findMany WHERE userId = $1 ORDER BY timestamp
CREATE INDEX IF NOT EXISTS "Event_userId_timestamp_idx"
  ON "Event"("userId", "timestamp");

-- Event: analytics aggregation by event type + time range.
-- Covers: groupBy WHERE type = $1 AND timestamp BETWEEN $2 AND $3
CREATE INDEX IF NOT EXISTS "Event_type_timestamp_idx"
  ON "Event"("type", "timestamp");

-- ChatHistory: every chat history page load.
-- Covers: findMany WHERE userId = $1 ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "ChatHistory_userId_createdAt_idx"
  ON "ChatHistory"("userId", "createdAt");

-- =============================================================================
-- P2 — Admin views, background jobs, observability queries
-- =============================================================================

-- DiagnosticSession: background completion checker.
-- Covers: findMany WHERE status = 'IN_PROGRESS' AND startedAt < $cutoff
CREATE INDEX IF NOT EXISTS "DiagnosticSession_status_startedAt_idx"
  ON "DiagnosticSession"("status", "startedAt");

-- NotificationLog: admin broadcast list filtered by audience.
-- Covers: findMany WHERE audience = $1 ORDER BY sentAt
CREATE INDEX IF NOT EXISTS "NotificationLog_audience_sentAt_idx"
  ON "NotificationLog"("audience", "sentAt");

-- NotificationLog: admin broadcast list filtered by delivery status.
-- Covers: findMany WHERE status = $1 ORDER BY sentAt
CREATE INDEX IF NOT EXISTS "NotificationLog_status_sentAt_idx"
  ON "NotificationLog"("status", "sentAt");

-- SessionQuestionFlag: student "my flagged questions" view.
-- Covers: findMany WHERE studentId = $1
CREATE INDEX IF NOT EXISTS "SessionQuestionFlag_studentId_idx"
  ON "SessionQuestionFlag"("studentId");

-- RecommendationTrace: admin debugging by content entity.
-- Covers: findMany WHERE entityId = $1 ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "RecommendationTrace_entityId_createdAt_idx"
  ON "RecommendationTrace"("entityId", "createdAt");

-- RecommendationTrace: A/B comparison by engine version.
-- Covers: findMany WHERE engineVersion = $1 ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "RecommendationTrace_engineVersion_createdAt_idx"
  ON "RecommendationTrace"("engineVersion", "createdAt");

-- GeneratedStudyContent: replaces bare [createdAt]; admin moderation queue.
-- Covers: findMany WHERE status = $1 AND lifecycle = $2 ORDER BY createdAt
CREATE INDEX IF NOT EXISTS "idx_generated_study_content_status_lifecycle_created"
  ON "GeneratedStudyContent"("status", "lifecycle", "createdAt");
