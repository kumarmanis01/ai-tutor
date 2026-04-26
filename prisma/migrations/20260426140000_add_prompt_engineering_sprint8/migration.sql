-- AlterTable: Add PromptType and PromptStatus enums
CREATE TYPE "PromptType" AS ENUM ('LESSON_GENERATION', 'CONTENT_ENHANCEMENT', 'DOUBT_SOLVING', 'SIMPLE_EXPLANATION', 'PRACTICE_QUESTIONS', 'DIAGNOSTIC_QUIZ', 'PROGRESSIVE_HINTS', 'CONTENT_TAGGING', 'WEEKLY_REPORT');
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'TESTING', 'ACTIVE', 'DEPRECATED', 'ARCHIVED');

-- CreateTable PromptVersion (PR-1.2)
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "promptType" "PromptType" NOT NULL,
    "version" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "changeNotes" TEXT,
    "createdBy" TEXT,
    "performanceScore" DOUBLE PRECISION DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER,
    "avgTokenUsage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable PromptExample (PR-4.2)
CREATE TABLE "PromptExample" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "inputVars" JSONB,
    "output" TEXT NOT NULL,
    "qualityRating" INTEGER NOT NULL DEFAULT 3,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable AIGenerationLog (PR-3.1)
CREATE TABLE "AIGenerationLog" (
    "id" TEXT NOT NULL,
    "promptType" "PromptType" NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "abTestId" TEXT,
    "abVariant" TEXT,
    "requestVariables" JSONB,
    "requestTokens" INTEGER,
    "responseText" TEXT,
    "responseTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "modelName" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "qualityDetails" JSONB,
    "userId" TEXT,
    "profileId" TEXT,
    "contentId" TEXT,
    "jobId" TEXT,
    "estimatedCostInr" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable ABTest (PR-2.3)
CREATE TABLE "ABTest" (
    "id" TEXT NOT NULL,
    "promptType" "PromptType" NOT NULL,
    "versionA" TEXT NOT NULL,
    "versionB" TEXT NOT NULL,
    "trafficSplitPercent" INTEGER NOT NULL DEFAULT 50,
    "durationHours" INTEGER NOT NULL,
    "successMetric" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "winner" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "ABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable PromptVariableSchema (PR-1.3)
CREATE TABLE "PromptVariableSchema" (
    "id" TEXT NOT NULL,
    "promptType" "PromptType" NOT NULL,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVariableSchema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_promptType_version_key" ON "PromptVersion"("promptType", "version");
CREATE INDEX "PromptVersion_promptType_status_idx" ON "PromptVersion"("promptType", "status");
CREATE INDEX "PromptVersion_status_idx" ON "PromptVersion"("status");
CREATE INDEX "PromptVersion_createdAt_idx" ON "PromptVersion"("createdAt");

-- CreateIndex
CREATE INDEX "PromptExample_promptId_idx" ON "PromptExample"("promptId");

-- CreateIndex
CREATE INDEX "AIGenerationLog_promptType_promptVersion_idx" ON "AIGenerationLog"("promptType", "promptVersion");
CREATE INDEX "AIGenerationLog_promptType_createdAt_idx" ON "AIGenerationLog"("promptType", "createdAt");
CREATE INDEX "AIGenerationLog_success_createdAt_idx" ON "AIGenerationLog"("success", "createdAt");
CREATE INDEX "AIGenerationLog_qualityScore_idx" ON "AIGenerationLog"("qualityScore");
CREATE INDEX "AIGenerationLog_userId_idx" ON "AIGenerationLog"("userId");
CREATE INDEX "AIGenerationLog_abTestId_idx" ON "AIGenerationLog"("abTestId");

-- CreateIndex
CREATE UNIQUE INDEX "ABTest_promptType_versionA_versionB_key" ON "ABTest"("promptType", "versionA", "versionB");
CREATE INDEX "ABTest_promptType_status_idx" ON "ABTest"("promptType", "status");
CREATE INDEX "ABTest_completedAt_idx" ON "ABTest"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVariableSchema_promptType_key" ON "PromptVariableSchema"("promptType");

-- AddForeignKey
ALTER TABLE "PromptExample" ADD CONSTRAINT "PromptExample_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationLog" ADD CONSTRAINT "AIGenerationLog_promptVersion_promptType_fkey" FOREIGN KEY ("promptVersion", "promptType") REFERENCES "PromptVersion"("version", "promptType") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationLog" ADD CONSTRAINT "AIGenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTest" ADD CONSTRAINT "ABTest_versionA_promptType_fkey" FOREIGN KEY ("versionA", "promptType") REFERENCES "PromptVersion"("version", "promptType") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTest" ADD CONSTRAINT "ABTest_versionB_promptType_fkey" FOREIGN KEY ("versionB", "promptType") REFERENCES "PromptVersion"("version", "promptType") ON DELETE RESTRICT ON UPDATE CASCADE;
