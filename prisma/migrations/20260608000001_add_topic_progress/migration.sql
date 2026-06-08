-- CreateEnum
CREATE TYPE "MasteryState" AS ENUM ('NOT_STARTED', 'DEVELOPING', 'MASTERED');

-- CreateTable
CREATE TABLE "TopicProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "state" "MasteryState" NOT NULL DEFAULT 'NOT_STARTED',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStudiedAt" TIMESTAMP(3),
    "masteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicProgress_userId_topicSlug_subject_grade_board_key" ON "TopicProgress"("userId", "topicSlug", "subject", "grade", "board");

-- CreateIndex
CREATE INDEX "TopicProgress_userId_state_idx" ON "TopicProgress"("userId", "state");

-- CreateIndex
CREATE INDEX "TopicProgress_userId_lastStudiedAt_idx" ON "TopicProgress"("userId", "lastStudiedAt");

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
