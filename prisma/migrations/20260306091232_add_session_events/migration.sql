-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('SESSION_STARTED', 'PHASE_STARTED', 'QUESTION_ANSWERED', 'HOMEWORK_SUBMITTED', 'SESSION_COMPLETED');

-- AlterEnum
ALTER TYPE "HomeworkStatus" ADD VALUE 'OVERDUE';

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "SessionEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_idx" ON "SessionEvent"("sessionId");

-- CreateIndex
CREATE INDEX "SessionEvent_eventType_idx" ON "SessionEvent"("eventType");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_eventType_idx" ON "SessionEvent"("sessionId", "eventType");

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StructuredSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
