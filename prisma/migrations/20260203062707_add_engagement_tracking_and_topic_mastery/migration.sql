-- CreateEnum
CREATE TYPE "MasteryLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- AlterTable
ALTER TABLE "ContentRecommendation" ADD COLUMN     "ignoredAt" TIMESTAMP(3),
ADD COLUMN     "isIgnored" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentTopicMastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "masteryLevel" "MasteryLevel" NOT NULL DEFAULT 'beginner',
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "questionsAttempted" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTopicMastery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTopicMastery_studentId_masteryLevel_idx" ON "StudentTopicMastery"("studentId", "masteryLevel");

-- CreateIndex
CREATE INDEX "StudentTopicMastery_subject_chapter_idx" ON "StudentTopicMastery"("subject", "chapter");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTopicMastery_studentId_topicId_key" ON "StudentTopicMastery"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "ContentRecommendation_userId_isIgnored_idx" ON "ContentRecommendation"("userId", "isIgnored");

-- AddForeignKey
ALTER TABLE "StudentTopicMastery" ADD CONSTRAINT "StudentTopicMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
