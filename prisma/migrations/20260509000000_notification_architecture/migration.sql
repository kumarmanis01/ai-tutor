-- Migration: 20260509000000_notification_architecture
-- Adds: NotificationChannel, NotificationSeverity, NotificationEventType enums
--       NotificationAudit model
--       escalationStatus column on StudentEngagementStats

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "NotificationChannel" AS ENUM (
  'EMAIL',
  'WHATSAPP',
  'PUSH',
  'IN_APP'
);

CREATE TYPE "NotificationSeverity" AS ENUM (
  'INFORMATIONAL',
  'IMPORTANT',
  'CRITICAL'
);

CREATE TYPE "NotificationEventType" AS ENUM (
  'SIGNUP_COMPLETED',
  'DIAGNOSTIC_COMPLETED',
  'PLAN_GENERATED',
  'DAILY_REMINDER',
  'STUDY_COMPLETED',
  'STREAK_MILESTONE',
  'WEAK_TOPIC_SINGLE',
  'WEAK_TOPIC_PATTERN',
  'IMPROVEMENT_DETECTED',
  'CONCEPT_MASTERED',
  'MISSED_ONE_DAY',
  'MISSED_THREE_DAYS',
  'DISENGAGED_CRITICAL',
  'EXAM_COUNTDOWN',
  'REVISION_PLAN_READY',
  'MOCK_TEST_SCHEDULED',
  'MOCK_TEST_COMPLETED',
  'EXAM_RISK_ALERT',
  'CONFUSION_PATTERN',
  'DAILY_DIGEST',
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'TRIAL_ENDING',
  'TRIAL_ENDED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'SECURITY_ALERT',
  'NEW_DEVICE_LOGIN'
);

-- ── escalationStatus on StudentEngagementStats ────────────────────────────────
-- Nullable; set to 'CRITICAL' by the severe-disengagement cron when
-- consecutiveMissedDays >= 7. Cleared (set to NULL) when student resumes.

ALTER TABLE "StudentEngagementStats"
  ADD COLUMN "escalationStatus" TEXT;

-- ── NotificationAudit model ───────────────────────────────────────────────────

CREATE TABLE "NotificationAudit" (
  "id"           TEXT NOT NULL,
  "eventType"    "NotificationEventType" NOT NULL,
  "templateId"   TEXT NOT NULL,
  "recipientId"  TEXT NOT NULL,
  "channel"      "NotificationChannel" NOT NULL,
  "status"       TEXT NOT NULL,
  "errorMessage" TEXT,
  "dryRun"       BOOLEAN NOT NULL DEFAULT false,
  "studentId"    TEXT,
  "parentId"     TEXT,
  "metadata"     JSONB,
  "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationAudit_pkey" PRIMARY KEY ("id")
);

-- Supports: compliance audit queries by recipient + time range
CREATE INDEX "NotificationAudit_recipientId_sentAt_idx" ON "NotificationAudit" ("recipientId", "sentAt");

-- Supports: analytics + frequency cap inspection by event type + time range
CREATE INDEX "NotificationAudit_eventType_sentAt_idx" ON "NotificationAudit" ("eventType", "sentAt");

-- Supports: parent dashboard / admin queries by student
CREATE INDEX "NotificationAudit_studentId_sentAt_idx" ON "NotificationAudit" ("studentId", "sentAt");
