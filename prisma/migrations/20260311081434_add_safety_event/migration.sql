-- CreateTable
CREATE TABLE "SafetyEvent" (
    "id" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "sessionId" TEXT,
    "turnId" TEXT,
    "studentId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "SafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyEvent_studentId_idx" ON "SafetyEvent"("studentId");

-- CreateIndex
CREATE INDEX "SafetyEvent_triggerType_idx" ON "SafetyEvent"("triggerType");

-- CreateIndex
CREATE INDEX "SafetyEvent_severity_idx" ON "SafetyEvent"("severity");

-- CreateIndex
CREATE INDEX "SafetyEvent_createdAt_idx" ON "SafetyEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SafetyEvent_resolvedAt_idx" ON "SafetyEvent"("resolvedAt");
