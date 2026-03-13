-- CreateTable
CREATE TABLE "AITutorTurnLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "tag" TEXT,
    "stage" TEXT,
    "safetyFlagged" BOOLEAN NOT NULL DEFAULT false,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "ragChunksUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frustrationScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITutorTurnLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AITutorTurnLog_sessionId_idx" ON "AITutorTurnLog"("sessionId");

-- CreateIndex
CREATE INDEX "AITutorTurnLog_callType_idx" ON "AITutorTurnLog"("callType");

-- CreateIndex
CREATE INDEX "AITutorTurnLog_createdAt_idx" ON "AITutorTurnLog"("createdAt");
