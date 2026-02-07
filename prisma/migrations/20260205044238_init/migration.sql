/*
  Warnings:

  - A unique constraint covering the columns `[inviteCode]` on the table `ParentStudent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ParentLinkStatus" AS ENUM ('pending', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "DailyTaskType" AS ENUM ('learn', 'practice', 'revise', 'fix_gap', 'confidence');

-- CreateEnum
CREATE TYPE "DailyTaskStatus" AS ENUM ('pending', 'completed', 'skipped', 'expired');

-- CreateEnum
CREATE TYPE "RecoveryNudgeType" AS ENUM ('gentle_nudge', 'easy_task', 'fresh_start');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'parent';

-- AlterTable
ALTER TABLE "GeneratedQuestion" ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "sourceJobId" TEXT;

-- AlterTable
ALTER TABLE "ParentStudent" ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "status" "ParentLinkStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "childSlots" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ParentChildControl" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dailyTimeLimitMin" INTEGER,
    "allowedSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focusMode" TEXT NOT NULL DEFAULT 'balanced',
    "studyHoursStart" TEXT,
    "studyHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentChildControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStudentSummary" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "topicsCovered" INTEGER NOT NULL DEFAULT 0,
    "testsTaken" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "subjectsActive" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyStudentSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectProgressSummary" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "totalTopics" INTEGER NOT NULL DEFAULT 0,
    "topicsCovered" INTEGER NOT NULL DEFAULT 0,
    "averageMastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strongTopics" INTEGER NOT NULL DEFAULT 0,
    "weakTopics" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectProgressSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttentionFlag" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "masteryLevel" "MasteryLevel" NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttentionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessStatus" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "topicsCovered" INTEGER NOT NULL DEFAULT 0,
    "totalTopics" INTEGER NOT NULL DEFAULT 0,
    "coveragePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgMastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "readinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "readinessLabel" TEXT NOT NULL DEFAULT 'not_started',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadinessStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "taskType" "DailyTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topicId" TEXT,
    "subject" TEXT,
    "chapter" TEXT,
    "steps" JSONB,
    "estimatedTimeMin" INTEGER NOT NULL DEFAULT 15,
    "status" "DailyTaskStatus" NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "motivationMessage" TEXT,
    "isRecoveryTask" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "inactiveDays" INTEGER NOT NULL,
    "nudgeType" "RecoveryNudgeType" NOT NULL,
    "dailyTaskId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentChildControl_studentId_idx" ON "ParentChildControl"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentChildControl_parentId_studentId_key" ON "ParentChildControl"("parentId", "studentId");

-- CreateIndex
CREATE INDEX "WeeklyStudentSummary_studentId_idx" ON "WeeklyStudentSummary"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyStudentSummary_studentId_weekStart_key" ON "WeeklyStudentSummary"("studentId", "weekStart");

-- CreateIndex
CREATE INDEX "SubjectProgressSummary_studentId_idx" ON "SubjectProgressSummary"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectProgressSummary_studentId_subject_key" ON "SubjectProgressSummary"("studentId", "subject");

-- CreateIndex
CREATE INDEX "AttentionFlag_studentId_resolved_idx" ON "AttentionFlag"("studentId", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "AttentionFlag_studentId_topicId_key" ON "AttentionFlag"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "ReadinessStatus_studentId_idx" ON "ReadinessStatus"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessStatus_studentId_subject_key" ON "ReadinessStatus"("studentId", "subject");

-- CreateIndex
CREATE INDEX "DailyTask_studentId_status_idx" ON "DailyTask"("studentId", "status");

-- CreateIndex
CREATE INDEX "DailyTask_date_idx" ON "DailyTask"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_studentId_date_key" ON "DailyTask"("studentId", "date");

-- CreateIndex
CREATE INDEX "RecoveryEvent_studentId_createdAt_idx" ON "RecoveryEvent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "RecoveryEvent_nudgeType_idx" ON "RecoveryEvent"("nudgeType");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudent_inviteCode_key" ON "ParentStudent"("inviteCode");

-- CreateIndex
CREATE INDEX "ParentStudent_inviteCode_idx" ON "ParentStudent"("inviteCode");

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryEvent" ADD CONSTRAINT "RecoveryEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
