-- CreateEnum
CREATE TYPE "SuggestionScope" AS ENUM ('COURSE', 'MODULE', 'LESSON', 'QUIZ');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('LOW_COMPLETION', 'HIGH_RETRY', 'DROP_OFF', 'LOW_ENGAGEMENT', 'CONTENT_CLARITY');

-- CreateEnum
CREATE TYPE "SuggestionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ContentSuggestion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "scope" "SuggestionScope" NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL,
    "severity" "SuggestionSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentSuggestion_courseId_idx" ON "ContentSuggestion"("courseId");
