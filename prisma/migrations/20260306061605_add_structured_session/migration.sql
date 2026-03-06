-- CreateEnum
CREATE TYPE "SessionPhase" AS ENUM ('EXPLANATION', 'PRACTICE', 'TEST', 'HOMEWORK', 'COMPLETE');

-- CreateTable
CREATE TABLE "StructuredSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "state" "SessionPhase" NOT NULL DEFAULT 'EXPLANATION',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "meta" JSONB,

    CONSTRAINT "StructuredSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StructuredSession_studentId_state_idx" ON "StructuredSession"("studentId", "state");

-- CreateIndex
CREATE INDEX "StructuredSession_topicId_idx" ON "StructuredSession"("topicId");

-- AddForeignKey
ALTER TABLE "StructuredSession" ADD CONSTRAINT "StructuredSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredSession" ADD CONSTRAINT "StructuredSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
