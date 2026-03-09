-- CreateTable
CREATE TABLE "HomeRecommendationDecision" (
  "id" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL,
  "ruleId" TEXT NOT NULL,
  "reasonLabel" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "topicId" TEXT,
  "sessionId" TEXT,
  "rawTrace" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HomeRecommendationDecision_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HomeRecommendationDecision"
ADD CONSTRAINT "HomeRecommendationDecision_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "HomeRecommendationDecision_evaluatedAt_idx" ON "HomeRecommendationDecision"("evaluatedAt");
CREATE INDEX "HomeRecommendationDecision_ruleId_evaluatedAt_idx" ON "HomeRecommendationDecision"("ruleId", "evaluatedAt");
CREATE INDEX "HomeRecommendationDecision_studentId_evaluatedAt_idx" ON "HomeRecommendationDecision"("studentId", "evaluatedAt");
CREATE INDEX "HomeRecommendationDecision_topicId_idx" ON "HomeRecommendationDecision"("topicId");
CREATE INDEX "HomeRecommendationDecision_sessionId_idx" ON "HomeRecommendationDecision"("sessionId");

