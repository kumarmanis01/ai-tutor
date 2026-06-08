-- CreateEnum
CREATE TYPE "RecommendationEventType" AS ENUM ('IMPRESSION', 'CLICK', 'DISMISS');

-- CreateTable: RecommendationEvent
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "type" "RecommendationEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserTopicProgress (free-text topic, no FK)
CREATE TABLE "UserTopicProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "correctAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3) NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserTopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationEvent_userId_idx" ON "RecommendationEvent"("userId");
CREATE INDEX "RecommendationEvent_userId_type_idx" ON "RecommendationEvent"("userId", "type");
CREATE INDEX "RecommendationEvent_recommendationId_idx" ON "RecommendationEvent"("recommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopicProgress_userId_topic_key" ON "UserTopicProgress"("userId", "topic");
CREATE INDEX "UserTopicProgress_userId_idx" ON "UserTopicProgress"("userId");
CREATE INDEX "UserTopicProgress_userId_masteryScore_idx" ON "UserTopicProgress"("userId", "masteryScore");

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTopicProgress" ADD CONSTRAINT "UserTopicProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
