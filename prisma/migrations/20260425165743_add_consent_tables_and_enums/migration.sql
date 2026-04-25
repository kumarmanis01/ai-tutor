-- Migration: Add ConsentRequest and ConsentMessageLog tables with all enums
-- This migration was successfully applied to Neon on 2026-04-25
-- It is idempotent and safe to run on any environment

-- ============================================
-- 1. SAFE ENUM CREATION (skips if already exists)
-- ============================================
DO 20 BEGIN CREATE TYPE "TrialStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONVERTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "CouponScope" AS ENUM ('GLOBAL', 'STUDENT', 'BATCH'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "RecurrenceType" AS ENUM ('ONE_TIME', 'RECURRING'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'OVERDUE'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SessionPhase" AS ENUM ('OVERVIEW', 'EXPLANATION', 'PRACTICE', 'TEST', 'HOMEWORK', 'COMPLETE', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SessionEventType" AS ENUM ('SESSION_STARTED', 'SESSION_OVERVIEW_VIEWED', 'PHASE_STARTED', 'QUESTION_ANSWERED', 'HOMEWORK_SUBMITTED', 'SESSION_COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "QualityFlag" AS ENUM ('HALLUCINATION', 'INCORRECT_EXPLANATION', 'POOR_PEDAGOGY', 'OFF_TOPIC', 'DIRECT_ANSWER_GIVEN', 'SAFETY_CONCERN'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "PlanItemStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "AdminActionType" AS ENUM ('GRADE_CHANGE', 'DIAGNOSTIC_RESET', 'ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE', 'ACCOUNT_DEACTIVATE', 'SUBSCRIPTION_EXTEND', 'SUBSCRIPTION_REFUND', 'QUESTION_QUARANTINE', 'QUESTION_APPROVE', 'QUESTION_REJECT', 'FEATURE_FLAG_CHANGE', 'ERASURE_REQUEST', 'ERASURE_PSEUDONYMISE', 'ERASURE_PURGE', 'CONTENT_APPROVE', 'DOUBT_RESOLVE', 'CONTENT_REJECT', 'JOB_CANCEL', 'JOB_PAUSE', 'JOB_RESUME', 'JOB_RETRY', 'JOB_REQUEUE', 'REGEN_JOB_CREATED', 'REGEN_JOB_TRIGGERED', 'REGEN_JOB_STARTED', 'REGEN_JOB_COMPLETED', 'REGEN_JOB_FAILED', 'REGEN_JOB_LOCKED', 'CONTENT_HYDRATE', 'WORKER_START', 'WORKER_STOP', 'CONCEPT_SUSPEND', 'CONCEPT_UNSUSPEND'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "UserStatus" AS ENUM ('active', 'banned', 'suspended'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "AccountStatus" AS ENUM ('active', 'pending_parent_verification', 'suspended', 'deletion_pending'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "UserRole" AS ENUM ('user', 'parent', 'admin', 'moderator', 'support'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SoftDeleteStatus" AS ENUM ('active', 'deleted'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "LanguageCode" AS ENUM ('en', 'hi'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "LearningStyle" AS ENUM ('visual', 'verbal', 'practice', 'mixed'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "DifficultyLevel" AS ENUM ('easy', 'medium', 'hard'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "MasteryLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ParentLinkStatus" AS ENUM ('pending', 'active', 'revoked'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ParentInviteStatus" AS ENUM ('pending', 'consumed', 'revoked', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "DailyTaskType" AS ENUM ('learn', 'practice', 'revise', 'fix_gap', 'confidence'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "DailyTaskStatus" AS ENUM ('pending', 'completed', 'skipped', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "RecoveryNudgeType" AS ENUM ('gentle_nudge', 'easy_task', 'fresh_start'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'failed', 'completed', 'cancelled', 'paused'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "JobType" AS ENUM ('syllabus', 'notes', 'questions', 'tests', 'assemble'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "EntityType" AS ENUM ('BOARD', 'CLASS', 'SUBJECT', 'CHAPTER', 'TOPIC', 'NOTE', 'TEST'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "WorkerStatus" AS ENUM ('STARTING', 'RUNNING', 'DRAINING', 'STOPPED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SuggestionScope" AS ENUM ('COURSE', 'MODULE', 'LESSON', 'QUIZ'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SuggestionType" AS ENUM ('LOW_COMPLETION', 'HIGH_RETRY', 'DROP_OFF', 'LOW_ENGAGEMENT', 'CONTENT_CLARITY'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SuggestionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "SuggestionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "RegenerationJobStatus" AS ENUM ('MISCONCEPTION_CREATE', 'MISCONCEPTION_UPDATE', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "RegenerationTargetType" AS ENUM ('LESSON', 'QUIZ', 'PROJECT', 'MODULE'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "CoursePackageStatus" AS ENUM ('PUBLISHED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "AlertType" AS ENUM ('REDIS_DOWN', 'DB_DOWN', 'WORKER_STALE', 'WORKER_FAILED', 'JOB_STUCK', 'QUEUE_BACKLOG', 'MISCONCEPTION_HIGH_PREVALENCE'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "RetryIntentStatus" AS ENUM ('PENDING', 'CONSUMED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "RetryReasonCode" AS ENUM ('TRANSIENT_FAILURE', 'BAD_INPUT', 'IMPROVED_PROMPT', 'INFRA_ERROR', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "PublishScope" AS ENUM ('COURSE', 'MODULE', 'LESSON'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ConsentScope" AS ENUM ('DATA_PROCESSING', 'AI_INTERACTION', 'PARENT_NOTIFICATION', 'MARKETING'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'QUARANTINED', 'REJECTED', 'PENDING_REVIEW'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "FlagReason" AS ENUM ('WRONG_ANSWER', 'AMBIGUOUS', 'TYPO', 'OFF_TOPIC', 'TOO_EASY', 'TOO_HARD'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "DiagnosticStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ContentGenerationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT_ADMIN', 'BILLING_ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ConsentChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ConsentReqStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ContentType" AS ENUM ('AI_GENERATED', 'CURATED', 'UPLOADED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END 20;
DO 20 BEGIN CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN null; END 20;

-- ============================================
-- 2. SAFE TABLE CREATION
-- ============================================
CREATE TABLE IF NOT EXISTS "ConsentRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentPhone" TEXT,
    "parentEmail" TEXT,
    "parentName" TEXT,
    "channel" "ConsentChannel" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ConsentReqStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConsentMessageLog" (
    "id" TEXT NOT NULL,
    "consentRequestId" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "messageId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentMessageLog_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 3. SAFE INDEX CREATION
-- ============================================
CREATE INDEX IF NOT EXISTS "ConsentRequest_studentId_status_idx" ON "ConsentRequest"("studentId", "status");
CREATE INDEX IF NOT EXISTS "ConsentRequest_token_idx" ON "ConsentRequest"("token");
CREATE INDEX IF NOT EXISTS "ConsentRequest_expiresAt_idx" ON "ConsentRequest"("expiresAt");
CREATE INDEX IF NOT EXISTS "ConsentMessageLog_consentRequestId_status_idx" ON "ConsentMessageLog"("consentRequestId", "status");
