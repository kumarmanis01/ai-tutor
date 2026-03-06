-- CreateTable
CREATE TABLE "HomeworkAnswer" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentAnswer" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkAnswer_assignmentId_idx" ON "HomeworkAnswer"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAnswer_assignmentId_questionId_key" ON "HomeworkAnswer"("assignmentId", "questionId");

-- AddForeignKey
ALTER TABLE "HomeworkAnswer" ADD CONSTRAINT "HomeworkAnswer_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
