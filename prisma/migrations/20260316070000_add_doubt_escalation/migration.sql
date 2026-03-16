-- CreateTable
CREATE TABLE "DoubtEscalation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT,
    "doubtText" TEXT NOT NULL,
    "aiAttempts" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolutionType" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoubtEscalation_resolvedAt_createdAt_idx" ON "DoubtEscalation"("resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "DoubtEscalation_studentId_idx" ON "DoubtEscalation"("studentId");

-- CreateIndex
CREATE INDEX "DoubtEscalation_conceptId_createdAt_idx" ON "DoubtEscalation"("conceptId", "createdAt");

-- AddForeignKey
ALTER TABLE "DoubtEscalation" ADD CONSTRAINT "DoubtEscalation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
