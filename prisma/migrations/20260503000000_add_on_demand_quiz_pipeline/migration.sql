-- CreateEnum
CREATE TYPE "QuizScope" AS ENUM ('topic', 'chapter', 'subject', 'studied_so_far');

-- CreateEnum
CREATE TYPE "QuizGenStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "OnDemandQuizRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "QuizScope" NOT NULL,
    "topicId" TEXT,
    "chapterId" TEXT,
    "subjectId" TEXT,
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'medium',
    "language" "LanguageCode" NOT NULL DEFAULT 'en',
    "questionCount" INTEGER NOT NULL DEFAULT 10,
    "status" "QuizGenStatus" NOT NULL DEFAULT 'pending',
    "resultJson" JSONB,
    "error" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OnDemandQuizRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnDemandQuizRequest_userId_requestedAt_idx" ON "OnDemandQuizRequest"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "OnDemandQuizRequest_status_idx" ON "OnDemandQuizRequest"("status");

-- AddForeignKey
ALTER TABLE "OnDemandQuizRequest" ADD CONSTRAINT "OnDemandQuizRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
