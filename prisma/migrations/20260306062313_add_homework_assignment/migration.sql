-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sessionId" TEXT,
    "questions" JSONB NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkAssignment_studentId_status_idx" ON "HomeworkAssignment"("studentId", "status");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_topicId_idx" ON "HomeworkAssignment"("topicId");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_sessionId_idx" ON "HomeworkAssignment"("sessionId");

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StructuredSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
