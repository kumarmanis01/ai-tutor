-- CreateTable
CREATE TABLE "FreeTierUsage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeTierUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreeTierUsage_studentId_key" ON "FreeTierUsage"("studentId");

-- CreateIndex
CREATE INDEX "FreeTierUsage_studentId_periodStart_idx" ON "FreeTierUsage"("studentId", "periodStart");
