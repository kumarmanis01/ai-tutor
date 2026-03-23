-- Migration: schema_audit_cleanup
-- Generated: 2026-03-23
-- Drops 14 dead models + 2 enums, adds DiagnosticSession, adds 3 indexes.

-- DropForeignKey (must precede DROP TABLE on referenced tables)
ALTER TABLE "BadgeShare" DROP CONSTRAINT IF EXISTS "BadgeShare_badgeId_fkey";
ALTER TABLE "BadgeShare" DROP CONSTRAINT IF EXISTS "BadgeShare_recipientId_fkey";
ALTER TABLE "UserBadge" DROP CONSTRAINT IF EXISTS "UserBadge_badgeId_fkey";
ALTER TABLE "UserBadge" DROP CONSTRAINT IF EXISTS "UserBadge_userId_fkey";
ALTER TABLE "Challenge" DROP CONSTRAINT IF EXISTS "Challenge_rewardBadgeId_fkey";
ALTER TABLE "Purchase" DROP CONSTRAINT IF EXISTS "Purchase_productId_fkey";
ALTER TABLE "Purchase" DROP CONSTRAINT IF EXISTS "Purchase_userId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_tenantId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_courseId_fkey";
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_userId_fkey";
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_courseId_fkey";
ALTER TABLE "RoomMember" DROP CONSTRAINT IF EXISTS "RoomMember_roomId_fkey";
ALTER TABLE "RoomMember" DROP CONSTRAINT IF EXISTS "RoomMember_userId_fkey";
ALTER TABLE "QuestionAttachment" DROP CONSTRAINT IF EXISTS "QuestionAttachment_questionId_fkey";
ALTER TABLE "ResumePoint" DROP CONSTRAINT IF EXISTS "ResumePoint_sessionId_fkey";
ALTER TABLE "AnalyticsSignal" DROP CONSTRAINT IF EXISTS "AnalyticsSignal_courseId_fkey";
ALTER TABLE "PublishedOutput" DROP CONSTRAINT IF EXISTS "PublishedOutput_userId_fkey";
ALTER TABLE "StudentMisconception" DROP CONSTRAINT IF EXISTS "StudentMisconception_studentId_fkey";
ALTER TABLE "StudentMisconception" DROP CONSTRAINT IF EXISTS "StudentMisconception_misconceptionId_fkey";

-- Also drop the rewardBadgeId column from Challenge if it still exists
ALTER TABLE "Challenge" DROP COLUMN IF EXISTS "rewardBadgeId";

-- DropTable (leaf tables first, then referenced tables)
DROP TABLE IF EXISTS "BadgeShare";
DROP TABLE IF EXISTS "UserBadge";
DROP TABLE IF EXISTS "StudentMisconception";
DROP TABLE IF EXISTS "QuestionAttachment";
DROP TABLE IF EXISTS "ResumePoint";
DROP TABLE IF EXISTS "RoomMember";
DROP TABLE IF EXISTS "Purchase";
DROP TABLE IF EXISTS "Enrollment";
DROP TABLE IF EXISTS "PublishedOutput";
DROP TABLE IF EXISTS "AnalyticsDailyAggregate";
DROP TABLE IF EXISTS "AnalyticsSignal";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "Tenant";
DROP TABLE IF EXISTS "Badge";

-- DropEnum
DROP TYPE IF EXISTS "SignalType";
DROP TYPE IF EXISTS "SignalSeverity";

-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "DiagnosticSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" "DiagnosticStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,

    CONSTRAINT "DiagnosticSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticSession_studentId_subjectId_key" ON "DiagnosticSession"("studentId", "subjectId");

CREATE INDEX "DiagnosticSession_studentId_idx" ON "DiagnosticSession"("studentId");

-- AddForeignKey
ALTER TABLE "DiagnosticSession" ADD CONSTRAINT "DiagnosticSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosticSession" ADD CONSTRAINT "DiagnosticSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SubjectDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New indexes for query performance
CREATE INDEX "Question_board_grade_subject_status_idx" ON "Question"("board", "grade", "subject", "status");

CREATE INDEX "CurriculumChunk_board_subject_grade_idx" ON "CurriculumChunk"("board", "subject", "grade");

CREATE INDEX "HydrationJob_rootJobId_status_idx" ON "HydrationJob"("rootJobId", "status");
