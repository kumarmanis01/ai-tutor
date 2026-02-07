-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'banned', 'suspended');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'moderator', 'support');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "SoftDeleteStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('en', 'hi');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'failed', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('syllabus', 'notes', 'questions', 'tests', 'assemble');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('LOW_COMPLETION_RATE', 'LOW_QUIZ_PASS_RATE', 'HIGH_REFUND_RATE');

-- CreateEnum
CREATE TYPE "SignalSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('BOARD', 'CLASS', 'SUBJECT', 'CHAPTER', 'TOPIC', 'NOTE', 'TEST');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('STARTING', 'RUNNING', 'DRAINING', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "SuggestionScope" AS ENUM ('COURSE', 'MODULE', 'LESSON', 'QUIZ');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('LOW_COMPLETION', 'HIGH_RETRY', 'DROP_OFF', 'LOW_ENGAGEMENT', 'CONTENT_CLARITY');

-- CreateEnum
CREATE TYPE "SuggestionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RegenerationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RegenerationTargetType" AS ENUM ('LESSON', 'QUIZ', 'PROJECT', 'MODULE');

-- CreateEnum
CREATE TYPE "CoursePackageStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('REDIS_DOWN', 'DB_DOWN', 'WORKER_STALE', 'WORKER_FAILED', 'JOB_STUCK', 'QUEUE_BACKLOG');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RetryIntentStatus" AS ENUM ('PENDING', 'CONSUMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RetryReasonCode" AS ENUM ('TRANSIENT_FAILURE', 'BAD_INPUT', 'IMPROVED_PROMPT', 'INFRA_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublishScope" AS ENUM ('COURSE', 'MODULE', 'LESSON');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "parentEmail" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "country" TEXT,
    "language" "LanguageCode" NOT NULL,
    "grade" TEXT,
    "board" TEXT,
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "points" INTEGER NOT NULL DEFAULT 0,
    "welcomeEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "todaysFreeQuestionsCount" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userId" TEXT,

    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ChatHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messages" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "courseId" TEXT,
    "lessonIdx" INTEGER,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDailyAggregate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalCompletions" INTEGER NOT NULL DEFAULT 0,
    "avgTimePerLesson" DOUBLE PRECISION,
    "completionRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSignal" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "type" "SignalType" NOT NULL,
    "severity" "SignalSeverity" NOT NULL DEFAULT 'INFO',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSuggestion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "scope" "SuggestionScope" NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "severity" "SuggestionSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSignalId" TEXT,

    CONSTRAINT "ContentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegenerationJob" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "targetType" "RegenerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "instructionJson" JSONB NOT NULL,
    "status" "RegenerationJobStatus" NOT NULL DEFAULT 'PENDING',
    "outputRef" JSONB,
    "errorJson" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(6),
    "completedAt" TIMESTAMP(6),
    "retryOfJobId" TEXT,
    "retryIntentId" TEXT,

    CONSTRAINT "RegenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegenerationOutput" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "targetType" "RegenerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegenerationOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerLifecycle" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT,
    "pid" INTEGER,
    "status" "WorkerStatus" NOT NULL DEFAULT 'STARTING',
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerLifecycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLock" (
    "jobName" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("jobName")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "grade" TEXT,
    "topic" TEXT,
    "createdByAI" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT,
    "sender" TEXT,
    "role" TEXT NOT NULL,
    "type" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiMeta" JSONB,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT,
    "orderId" TEXT,
    "plan" TEXT,
    "billingCycle" TEXT,
    "meta" JSONB,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeShare" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePackage" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CoursePackageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Syllabus" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "SyllabusStatus" NOT NULL DEFAULT 'DRAFT',
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "rewardBadgeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipation" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'joined',
    "score" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardApplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChallengeParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQuestion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "grade" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "answerSummary" TEXT,
    "answerStepsJson" JSONB,
    "aiMetadata" JSONB,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "contentSafetyScore" INTEGER,
    "processingAttempts" INTEGER DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "responder" TEXT,
    "content" TEXT NOT NULL,
    "contentJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttachment" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "kind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFlag" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "autoFlagged" BOOLEAN NOT NULL DEFAULT false,
    "reviewerNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "flaggedBy" TEXT,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudent" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityRef" TEXT,
    "duration" INTEGER,
    "meta" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentQuestionIndex" INTEGER,
    "sessionData" JSONB,
    "difficultyLevel" "DifficultyLevel" NOT NULL,
    "estimatedTimeMinutes" INTEGER,
    "actualTimeSpent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumePoint" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contentPosition" JSONB,
    "contextData" JSONB,
    "autoSavedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "isShown" BOOLEAN NOT NULL DEFAULT false,
    "isClicked" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstShownAt" TIMESTAMP(3),
    "lastShownAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCatalog" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "type" TEXT,
    "subject" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "difficulty" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLearningProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weakSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strengths" JSONB,
    "recommendations" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStreak" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeTest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "grade" TEXT,
    "questions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rawResult" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentJson" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteDownload" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "chapter" TEXT,
    "grade" TEXT,
    "board" TEXT,
    "type" TEXT NOT NULL,
    "difficulty" TEXT,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctAnswer" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptQuestion" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "timeSpent" INTEGER,
    "result" TEXT,
    "awardedPoints" INTEGER,

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "attemptQuestionId" TEXT NOT NULL,
    "rawAnswer" TEXT,
    "normalizedAnswer" TEXT,
    "autoScore" INTEGER,
    "reviewerScore" INTEGER,
    "confidence" DOUBLE PRECISION
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLevel" (
    "id" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "chapterId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicNote" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "editedByTeacher" BOOLEAN NOT NULL DEFAULT false,
    "teacherNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedTest" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedQuestion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "answer" JSONB,
    "marks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIContentLog" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptType" TEXT NOT NULL,
    "board" TEXT,
    "grade" INTEGER,
    "subject" TEXT,
    "chapter" TEXT,
    "topic" TEXT,
    "language" "LanguageCode" NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "tokensUsed" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "topicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIContentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "HydrationJob" (
    "id" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "board" TEXT,
    "grade" INTEGER,
    "subject" TEXT,
    "subjectId" TEXT,
    "chapterId" TEXT,
    "topicId" TEXT,
    "parentJobId" TEXT,
    "rootJobId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "contentReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HydrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "meta" JSONB,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentContentPreference" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT,
    "difficulty" "DifficultyLevel" NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentContentPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAudit" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" "ApprovalStatus" NOT NULL,
    "toStatus" "ApprovalStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionJob" (
    "id" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExecutionLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "prevStatus" TEXT,
    "newStatus" TEXT,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetricSample" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overall" TEXT NOT NULL,
    "dbLatencyMs" INTEGER,
    "redisLatencyMs" INTEGER,
    "workersRunning" INTEGER NOT NULL DEFAULT 0,
    "workersStale" INTEGER NOT NULL DEFAULT 0,
    "workersFailed" INTEGER NOT NULL DEFAULT 0,
    "jobsPending" INTEGER NOT NULL DEFAULT 0,
    "jobsRunning" INTEGER NOT NULL DEFAULT 0,
    "jobsFailedLast5m" INTEGER NOT NULL DEFAULT 0,
    "jobsStuckRunning" INTEGER NOT NULL DEFAULT 0,
    "queueDepth" INTEGER NOT NULL DEFAULT 0,
    "queueOldestJobAge" INTEGER,
    "meta" JSONB,

    CONSTRAINT "SystemMetricSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetrySample" (
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

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonIdx" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetryIntent" (
    "id" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "sourceOutputRef" JSONB,
    "reasonCode" "RetryReasonCode" NOT NULL,
    "reasonText" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "RetryIntentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetryIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionCandidate" (
    "id" TEXT NOT NULL,
    "scope" "PublishScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "regenerationJobId" TEXT NOT NULL,
    "outputRef" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" JSONB,

    CONSTRAINT "PromotionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedOutput" (
    "id" TEXT NOT NULL,
    "scope" "PublishScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "outputRef" TEXT NOT NULL,
    "promotedBy" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedStudyContent" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT,
    "grade" INTEGER,
    "board" TEXT,
    "language" "LanguageCode" NOT NULL DEFAULT 'en',
    "contentJson" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedStudyContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStudyBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "personalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStudyBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "PhoneOtp_phone_idx" ON "PhoneOtp"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Chat_conversationId_idx" ON "Chat"("conversationId");

-- CreateIndex
CREATE INDEX "Chat_userId_conversationId_idx" ON "Chat"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "Chat_subject_idx" ON "Chat"("subject");

-- CreateIndex
CREATE INDEX "Chat_userId_subject_idx" ON "Chat"("userId", "subject");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_courseId_idx" ON "AnalyticsEvent"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailyAggregate_courseId_day_key" ON "AnalyticsDailyAggregate"("courseId", "day");

-- CreateIndex
CREATE INDEX "AnalyticsSignal_courseId_idx" ON "AnalyticsSignal"("courseId");

-- CreateIndex
CREATE INDEX "AnalyticsSignal_type_idx" ON "AnalyticsSignal"("type");

-- CreateIndex
CREATE INDEX "ContentSuggestion_courseId_idx" ON "ContentSuggestion"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSuggestion_sourceSignalId_type_targetId_key" ON "ContentSuggestion"("sourceSignalId", "type", "targetId");

-- CreateIndex
CREATE INDEX "idx_regenerationjob_lockedAt" ON "RegenerationJob"("lockedAt");

-- CreateIndex
CREATE INDEX "idx_regenerationjob_status" ON "RegenerationJob"("status");

-- CreateIndex
CREATE INDEX "idx_regenerationjob_suggestionId" ON "RegenerationJob"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "RegenerationJob_suggestionId_targetType_targetId_key" ON "RegenerationJob"("suggestionId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "regenerationjob_unique_suggestion_target" ON "RegenerationJob"("suggestionId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "RegenerationOutput_jobId_key" ON "RegenerationOutput"("jobId");

-- CreateIndex
CREATE INDEX "RegenerationOutput_targetId_idx" ON "RegenerationOutput"("targetId");

-- CreateIndex
CREATE INDEX "idx_regenerationoutput_targetId" ON "RegenerationOutput"("targetId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "WorkerLifecycle_status_idx" ON "WorkerLifecycle"("status");

-- CreateIndex
CREATE INDEX "WorkerLifecycle_lastHeartbeatAt_idx" ON "WorkerLifecycle"("lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "JobLock_lockedUntil_idx" ON "JobLock"("lockedUntil");

-- CreateIndex
CREATE INDEX "RoomMember_roomId_idx" ON "RoomMember"("roomId");

-- CreateIndex
CREATE INDEX "Message_roomId_idx" ON "Message"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_userId_endpoint_method_key" ON "ApiUsage"("userId", "endpoint", "method");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "BadgeShare_badgeId_idx" ON "BadgeShare"("badgeId");

-- CreateIndex
CREATE INDEX "BadgeShare_recipientId_idx" ON "BadgeShare"("recipientId");

-- CreateIndex
CREATE INDEX "CoursePackage_syllabusId_idx" ON "CoursePackage"("syllabusId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePackage_syllabusId_version_key" ON "CoursePackage"("syllabusId", "version");

-- CreateIndex
CREATE INDEX "Syllabus_status_idx" ON "Syllabus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_key_key" ON "Challenge"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipation_challengeId_userId_key" ON "ChallengeParticipation"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "StudentQuestion_studentId_idx" ON "StudentQuestion"("studentId");

-- CreateIndex
CREATE INDEX "StudentQuestion_status_idx" ON "StudentQuestion"("status");

-- CreateIndex
CREATE INDEX "QuestionAttachment_questionId_idx" ON "QuestionAttachment"("questionId");

-- CreateIndex
CREATE INDEX "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");

-- CreateIndex
CREATE INDEX "LearningSession_studentId_idx" ON "LearningSession"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRecommendation_userId_contentId_key" ON "ContentRecommendation"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCatalog_contentId_key" ON "ContentCatalog"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLearningProfile_studentId_key" ON "StudentLearningProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentStreak_studentId_kind_idx" ON "StudentStreak"("studentId", "kind");

-- CreateIndex
CREATE INDEX "TestResult_studentId_idx" ON "TestResult"("studentId");

-- CreateIndex
CREATE INDEX "NoteDownload_userId_idx" ON "NoteDownload"("userId");

-- CreateIndex
CREATE INDEX "NoteDownload_noteId_userId_idx" ON "NoteDownload"("noteId", "userId");

-- CreateIndex
CREATE INDEX "Bookmark_studentId_type_idx" ON "Bookmark"("studentId", "type");

-- CreateIndex
CREATE INDEX "AttemptQuestion_testResultId_idx" ON "AttemptQuestion"("testResultId");

-- CreateIndex
CREATE INDEX "AttemptQuestion_questionId_idx" ON "AttemptQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptQuestionId_key" ON "Answer"("attemptQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "Board_slug_key" ON "Board"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLevel_boardId_grade_key" ON "ClassLevel"("boardId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectDef_classId_slug_key" ON "SubjectDef"("classId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterDef_subjectId_slug_version_key" ON "ChapterDef"("subjectId", "slug", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TopicDef_chapterId_slug_key" ON "TopicDef"("chapterId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TopicNote_topicId_language_version_key" ON "TopicNote"("topicId", "language", "version");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedTest_topicId_difficulty_language_version_key" ON "GeneratedTest"("topicId", "difficulty", "language", "version");

-- CreateIndex
CREATE INDEX "AIContentLog_promptType_idx" ON "AIContentLog"("promptType");

-- CreateIndex
CREATE INDEX "AIContentLog_board_grade_subject_idx" ON "AIContentLog"("board", "grade", "subject");

-- CreateIndex
CREATE INDEX "AIContentLog_createdAt_idx" ON "AIContentLog"("createdAt");

-- CreateIndex
CREATE INDEX "HydrationJob_jobType_status_idx" ON "HydrationJob"("jobType", "status");

-- CreateIndex
CREATE INDEX "HydrationJob_parentJobId_idx" ON "HydrationJob"("parentJobId");

-- CreateIndex
CREATE INDEX "HydrationJob_rootJobId_idx" ON "HydrationJob"("rootJobId");

-- CreateIndex
CREATE INDEX "HydrationJob_lockedAt_idx" ON "HydrationJob"("lockedAt");

-- CreateIndex
CREATE INDEX "Outbox_queue_sentAt_idx" ON "Outbox"("queue", "sentAt");

-- CreateIndex
CREATE INDEX "StudentContentPreference_studentId_idx" ON "StudentContentPreference"("studentId");

-- CreateIndex
CREATE INDEX "ApprovalAudit_entityType_entityId_idx" ON "ApprovalAudit"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalAudit_createdAt_idx" ON "ApprovalAudit"("createdAt");

-- CreateIndex
CREATE INDEX "ExecutionJob_status_nextRunAt_idx" ON "ExecutionJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "JobExecutionLog_jobId_idx" ON "JobExecutionLog"("jobId");

-- CreateIndex
CREATE INDEX "JobExecutionLog_event_idx" ON "JobExecutionLog"("event");

-- CreateIndex
CREATE INDEX "JobExecutionLog_createdAt_idx" ON "JobExecutionLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemMetricSample_timestamp_idx" ON "SystemMetricSample"("timestamp");

-- CreateIndex
CREATE INDEX "SystemAlert_type_active_idx" ON "SystemAlert"("type", "active");

-- CreateIndex
CREATE INDEX "TelemetrySample_key_timestamp_idx" ON "TelemetrySample"("key", "timestamp");

-- CreateIndex
CREATE INDEX "TelemetrySample_timestamp_idx" ON "TelemetrySample"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetrySample_key_timestamp_dimensionHash_key" ON "TelemetrySample"("key", "timestamp", "dimensionHash");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");

-- CreateIndex
CREATE INDEX "LessonProgress_courseId_idx" ON "LessonProgress"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_courseId_lessonIdx_key" ON "LessonProgress"("userId", "courseId", "lessonIdx");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_courseId_idx" ON "Product"("courseId");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_productId_idx" ON "Purchase"("productId");

-- CreateIndex
CREATE INDEX "idx_retryintent_sourceJobId" ON "RetryIntent"("sourceJobId");

-- CreateIndex
CREATE INDEX "idx_promotioncandidate_scope_ref" ON "PromotionCandidate"("scope", "scopeRefId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCandidate_scope_scopeRefId_outputRef_key" ON "PromotionCandidate"("scope", "scopeRefId", "outputRef");

-- CreateIndex
CREATE INDEX "idx_publishedoutput_scope" ON "PublishedOutput"("scope", "scopeRefId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedOutput_scope_scopeRefId_key" ON "PublishedOutput"("scope", "scopeRefId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedStudyContent_contentHash_key" ON "GeneratedStudyContent"("contentHash");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_topic" ON "GeneratedStudyContent"("topic");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_context" ON "GeneratedStudyContent"("subject", "grade", "board");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_user" ON "GeneratedStudyContent"("generatedBy");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_created" ON "GeneratedStudyContent"("createdAt");

-- CreateIndex
CREATE INDEX "StudentStudyBookmark_userId_createdAt_idx" ON "StudentStudyBookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStudyBookmark_userId_contentType_contentId_key" ON "StudentStudyBookmark"("userId", "contentType", "contentId");

-- AddForeignKey
ALTER TABLE "PhoneOtp" ADD CONSTRAINT "PhoneOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatHistory" ADD CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegenerationOutput" ADD CONSTRAINT "RegenerationOutput_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RegenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_redeemedBy_fkey" FOREIGN KEY ("redeemedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_rewardBadgeId_fkey" FOREIGN KEY ("rewardBadgeId") REFERENCES "Badge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttachment" ADD CONSTRAINT "QuestionAttachment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFlag" ADD CONSTRAINT "QuestionFlag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumePoint" ADD CONSTRAINT "ResumePoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRecommendation" ADD CONSTRAINT "ContentRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLearningProfile" ADD CONSTRAINT "StudentLearningProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStreak" ADD CONSTRAINT "StudentStreak_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDownload" ADD CONSTRAINT "NoteDownload_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDownload" ADD CONSTRAINT "NoteDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "AttemptQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLevel" ADD CONSTRAINT "ClassLevel_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectDef" ADD CONSTRAINT "SubjectDef_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterDef" ADD CONSTRAINT "ChapterDef_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SubjectDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicDef" ADD CONSTRAINT "TopicDef_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "ChapterDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicNote" ADD CONSTRAINT "TopicNote_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedTest" ADD CONSTRAINT "GeneratedTest_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedQuestion" ADD CONSTRAINT "GeneratedQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "GeneratedTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIContentLog" ADD CONSTRAINT "AIContentLog_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAudit" ADD CONSTRAINT "ApprovalAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExecutionLog" ADD CONSTRAINT "JobExecutionLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ExecutionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedStudyContent" ADD CONSTRAINT "GeneratedStudyContent_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStudyBookmark" ADD CONSTRAINT "StudentStudyBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
