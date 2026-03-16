-- This migration is not transactional (CREATE TYPE cannot run inside a transaction)

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'QUARANTINED', 'REJECTED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "FlagReason" AS ENUM ('WRONG_ANSWER', 'AMBIGUOUS', 'TYPO', 'OFF_TOPIC', 'TOO_EASY', 'TOO_HARD');

-- AlterTable: add status column to Question (nullable first, then backfill, then make non-null)
ALTER TABLE "Question" ADD COLUMN "status" "QuestionStatus";
UPDATE "Question" SET "status" = 'ACTIVE' WHERE "status" IS NULL;
ALTER TABLE "Question" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Question" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateIndex on Question.status
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateTable
CREATE TABLE "SessionQuestionFlag" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionQuestionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionQuestionFlag_questionId_studentId_key" ON "SessionQuestionFlag"("questionId", "studentId");

-- CreateIndex
CREATE INDEX "SessionQuestionFlag_questionId_idx" ON "SessionQuestionFlag"("questionId");

-- AddForeignKey
ALTER TABLE "SessionQuestionFlag" ADD CONSTRAINT "SessionQuestionFlag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionQuestionFlag" ADD CONSTRAINT "SessionQuestionFlag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
